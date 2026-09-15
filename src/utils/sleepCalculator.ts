export interface WakeUpTime {
  cycles: number;
  time: string;
  hour: number;
  minute: number;
  hoursOfSleep: number;
  isSuggested: boolean;
}

export function getWakeUpTimes(baseTime?: Date): WakeUpTime[] {
  const FALL_ASLEEP_TIME = 15;
  const CYCLE_DURATION = 90;
  
  // Se recebermos uma baseTime, usamos essa, senão usamos a hora atual (now)
  const now = baseTime ? new Date(baseTime) : new Date();
  
  now.setMinutes(now.getMinutes() + FALL_ASLEEP_TIME);

  const times: WakeUpTime[] = [];

  for (let cycles = 3; cycles <= 6; cycles++) {
    const wakeTime = new Date(now.getTime());
    wakeTime.setMinutes(wakeTime.getMinutes() + (cycles * CYCLE_DURATION));

    times.push({
      cycles: cycles,
      time: wakeTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
      hour: wakeTime.getHours(),
      minute: wakeTime.getMinutes(),
      hoursOfSleep: (cycles * 1.5),
      // Vamos sugerir os 5 e 6 ciclos (7.5h e 9h de sono)
      isSuggested: cycles === 5 || cycles === 6 
    });
  }

  return times.reverse();
}
