const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const CYCLE_START_MINUTE = 7 * MINUTES_PER_HOUR;

export interface TimeOfDay {
  elapsedMinutes: number;
  minuteOfDay: number;
  hour: number;
  minute: number;
  label: string;
}

export const normalizeScrollProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress));
};

export const getProgressFromLocalTime = (date: Date): number => {
  const minutesSinceMidnight =
    date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
  const elapsedMinutes =
    (minutesSinceMidnight - CYCLE_START_MINUTE + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;

  return elapsedMinutes / MINUTES_PER_DAY;
};

export const mapProgressToTime = (progress: number): TimeOfDay => {
  const normalizedProgress = normalizeScrollProgress(progress);
  // The endpoint adds a full day, then wraps to the same 07:00 clock label.
  const elapsedMinutes = Math.floor(
    normalizedProgress * MINUTES_PER_DAY + 1e-9,
  );
  const minuteOfDay =
    (CYCLE_START_MINUTE + elapsedMinutes) % MINUTES_PER_DAY;
  const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);
  const minute = minuteOfDay % MINUTES_PER_HOUR;

  return {
    elapsedMinutes,
    minuteOfDay,
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
};
