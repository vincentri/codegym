import { useEffect, useRef } from "react";
import { api } from "@/api/client";

const HEARTBEAT_SECONDS = 30;
const IDLE_AFTER_SECONDS = 120;

/**
 * Tracks active time on a problem for the solve records (time spent, streaks later).
 * Time counts only while the window is focused and the user typed, ran or clicked recently.
 */
export function usePracticeSession(problemId: string) {
  const lastInput = useRef(0);

  useEffect(() => {
    lastInput.current = Date.now();
    void api.recordActivity({ type: "problem_opened", problemId });
    let active = 0;
    const markActive = () => {
      lastInput.current = Date.now();
    };
    const tick = setInterval(() => {
      const idle = (Date.now() - lastInput.current) / 1000 > IDLE_AFTER_SECONDS;
      if (document.hasFocus() && !idle) active += 1;
      if (active >= HEARTBEAT_SECONDS) {
        void api.recordActivity({ type: "session_heartbeat", problemId, activeSeconds: active });
        active = 0;
      }
    }, 1000);
    window.addEventListener("keydown", markActive);
    window.addEventListener("pointerdown", markActive);
    return () => {
      clearInterval(tick);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("pointerdown", markActive);
      if (active > 0)
        void api.recordActivity({ type: "session_heartbeat", problemId, activeSeconds: active });
      void api.recordActivity({ type: "problem_closed", problemId });
    };
  }, [problemId]);
}
