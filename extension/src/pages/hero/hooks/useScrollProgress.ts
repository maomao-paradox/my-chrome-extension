import { useEffect } from "react";
import Lenis from "lenis";
import { useTimeStore } from "../store/useTimeStore";

const MINUTE_INTERVAL_MS = 60 * 1000;

export const useScrollProgress = () => {
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.08,
      respectReducedMotion: true,
      smoothWheel: true,
    });
    useTimeStore.getState().initializeFromLocalTime(new Date());
    const { scrollProgress } = useTimeStore.getState();
    lenis.scrollTo(scrollProgress * lenis.limit, {
      immediate: true,
      force: true,
    });

    let minuteTimer: number | undefined;
    let syncingScrollPosition = false;

    const scheduleNextMinute = () => {
      window.clearTimeout(minuteTimer);
      minuteTimer = window.setTimeout(advanceClock, MINUTE_INTERVAL_MS);
    };

    const syncScrollToClock = () => {
      const { scrollProgress } = useTimeStore.getState();
      syncingScrollPosition = true;
      lenis.scrollTo(scrollProgress * lenis.limit, {
        immediate: true,
        force: true,
      });
      syncingScrollPosition = false;
    };

    const advanceClock = () => {
      useTimeStore.getState().advanceOneMinute();
      syncScrollToClock();
      scheduleNextMinute();
    };

    const unsubscribe = lenis.on("scroll", () => {
      if (syncingScrollPosition) {
        return;
      }

      useTimeStore.getState().setScrollProgress(lenis.progress);
      scheduleNextMinute();
    });
    let frameId = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(raf);
    };

    frameId = window.requestAnimationFrame(raf);
    scheduleNextMinute();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(minuteTimer);
      unsubscribe();
      lenis.destroy();
    };
  }, []);
};
