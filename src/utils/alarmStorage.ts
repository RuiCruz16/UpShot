import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
}

const ALARMS_KEY = 'upshot.alarms';

export function createAlarmId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAlarmTime(alarm: Alarm): string {
  const hour = alarm.hour.toString().padStart(2, '0');
  const minute = alarm.minute.toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

export async function loadAlarms(): Promise<Alarm[]> {
  const raw = await AsyncStorage.getItem(ALARMS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Alarm[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

export async function addAlarm(hour: number, minute: number): Promise<Alarm[]> {
  const alarms = await loadAlarms();
  const alarm: Alarm = { id: createAlarmId(), hour, minute, enabled: true };
  const next = [...alarms, alarm].sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  await saveAlarms(next);
  return next;
}

export async function setAlarmEnabled(id: string, enabled: boolean): Promise<Alarm[]> {
  const alarms = await loadAlarms();
  const next = alarms.map((a) => (a.id === id ? { ...a, enabled } : a));
  await saveAlarms(next);
  return next;
}

export async function removeAlarm(id: string): Promise<Alarm[]> {
  const alarms = await loadAlarms();
  const next = alarms.filter((a) => a.id !== id);
  await saveAlarms(next);
  return next;
}