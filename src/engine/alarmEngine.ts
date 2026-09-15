import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { loadAlarms, setAlarmEnabled, type Alarm } from '../utils/alarmStorage';

const ALARM_SOUND = require('../utils/alarms/iphone_alarm.mp3') as number;

const SILENT_VOLUME = 0;
const MAX_VOLUME = 1;
const CLOCK_INTERVAL_MS = 1000;
const RINGING_GRACE_MS = 15 * 60 * 1000; // seconds after the alarm minute that we still re-arm on open

const NOTIFICATION_CHANNEL_ID = 'alarms';
const NOTIFICATION_DATA_TYPE = 'alarm';

type Listener = () => void;

const listeners = new Set<Listener>();

let player: AudioPlayer | null = null;
let clockTimer: ReturnType<typeof setInterval> | null = null;

let cachedAlarms: Alarm[] = [];
let ringingAlarmId: string | null = null;
let lastFiredKey = '';

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isRinging(): boolean {
  return ringingAlarmId !== null;
}

export function getRingingAlarmId(): string | null {
  return ringingAlarmId;
}

function anyEnabled(alarms: Alarm[] = cachedAlarms): boolean {
  return alarms.some((a) => a.enabled);
}

function ensurePlayer(): AudioPlayer {
  if (!player) {
    const created = createAudioPlayer(ALARM_SOUND);
    created.loop = true;
    created.volume = SILENT_VOLUME;
    player = created;
  }
  return player;
}

// While an alarm is armed the loop keeps playing at volume 0 (silent). This
// keeps the iOS audio session active so the JS clock keeps running in the
// background and the ring fires on time. Only while an alarm is ringing does
// it become audible, at full volume.
function refreshLoop() {
  const enabled = anyEnabled();
  if (!player && !enabled) return;
  const current = ensurePlayer();
  if (enabled) {
    if (!current.playing) {
      current.play();
    }
    if (!isRinging()) {
      current.volume = SILENT_VOLUME;
    }
  } else {
    current.volume = SILENT_VOLUME;
    current.pause();
  }
}

function fireAlarm(alarm: Alarm) {
  if (ringingAlarmId !== null) return; // already ringing another alarm
  ringingAlarmId = alarm.id;
  const current = ensurePlayer();
  if (!current.playing) {
    current.play();
  }
  current.volume = MAX_VOLUME;
  emit();
}

function stopRinging() {
  ringingAlarmId = null;
  refreshLoop();
  emit();
}

function currentTimeKey(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function checkClock() {
  if (cachedAlarms.length === 0) return;
  const now = new Date();
  const key = currentTimeKey();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const due = cachedAlarms.find(
    (a) => a.enabled && pad(a.hour) === pad(now.getHours()) && pad(a.minute) === pad(now.getMinutes())
  );
  if (due && lastFiredKey !== key) {
    lastFiredKey = key;
    fireAlarm(due);
  }
  if (!due && key !== lastFiredKey) {
    lastFiredKey = key;
  }
}

function reactivateIfDue() {
  if (ringingAlarmId !== null) return;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const due = cachedAlarms.find(
    (a) =>
      a.enabled &&
      pad(a.hour) === pad(now.getHours()) &&
      pad(a.minute) === pad(now.getMinutes())
  );
  if (due) {
    fireAlarm(due);
    return;
  }
  // Also re-arm when opening the app shortly after the alarm minute (e.g. the
  // process was killed before the interval could fire).
  const late = cachedAlarms.find((a) => {
    if (!a.enabled) return false;
    const alarmDate = new Date();
    alarmDate.setHours(a.hour, a.minute, 0, 0);
    const diff = now.getTime() - alarmDate.getTime();
    return diff > 0 && diff < RINGING_GRACE_MS;
  });
  if (late) {
    fireAlarm(late);
  }
}

function startClock() {
  if (clockTimer) return;
  clockTimer = setInterval(checkClock, CLOCK_INTERVAL_MS);
  reactivateIfDue();
}

async function createAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Alarmes',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/**
 * Sets up the notification behaviour for when the app is in the foreground and
 * the background audio mode for the alarm loop. Call once at startup.
 */
export async function init(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    allowsRecording: false,
    interruptionMode: 'doNotMix',
  });

  await createAndroidChannel();
  startClock();
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

async function scheduleNotifications(alarms: Alarm[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const alarm of alarms.filter((a) => a.enabled)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'UpShot - Alarme',
        body: 'Levanta-te! Para desligares o som, deves fotografar o objeto que escolheste anteriormente.',
        data: { type: NOTIFICATION_DATA_TYPE, alarmId: alarm.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: alarm.hour,
        minute: alarm.minute,
      },
    });
  }
}

/**
 * Re-evaluates the alarm state: reschedules notifications, starts/stops the
 * background loop and re-arms any alarm that is currently due.
 */
export async function refresh(): Promise<Alarm[]> {
  cachedAlarms = await loadAlarms();
  await scheduleNotifications(cachedAlarms);
  refreshLoop();
  startClock();
  emit();
  return cachedAlarms;
}

/**
 * Marks a ringing alarm as successfully verified: stops the sound and disables
 * the alarm so it doesn't fire again tomorrow.
 */
export async function onVerificationSucceeded(alarmId?: string): Promise<void> {
  if (alarmId) {
    await setAlarmEnabled(alarmId, false);
  }
  stopRinging();
  await refresh();
}

export function cancelRingingForTest(): void {
  stopRinging();
}