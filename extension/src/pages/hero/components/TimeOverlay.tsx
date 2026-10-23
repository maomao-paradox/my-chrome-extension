import { useTimeStore } from "../store/useTimeStore";

export const TimeOverlay = () => {
  const timeOfDay = useTimeStore((state) => state.timeOfDay);

  return (
    <aside className="hero-page__time-panel" aria-label="当前时间">
      <p className="hero-page__time-caption">LOCAL TIME</p>
      <time className="hero-page__time" dateTime={timeOfDay.label}>
        {timeOfDay.label}
      </time>
    </aside>
  );
};
