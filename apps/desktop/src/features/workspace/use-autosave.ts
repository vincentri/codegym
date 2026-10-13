import { useCallback, useEffect, useState } from "react";
import { Autosaver, type AutosaveState, type SaveFn } from "./autosave";

interface Options {
  initialCode: string;
  initialSavedAt: Date | null;
  intervalSeconds: number;
  save: SaveFn;
}

/**
 * Auto-saves one editor buffer. The owning component is keyed by (problem, language), so a new
 * buffer means a fresh mount; the saver is flushed when it unmounts.
 */
export function useAutosave({ initialCode, initialSavedAt, intervalSeconds, save }: Options) {
  const [state, setState] = useState<AutosaveState>({
    dirty: false,
    saving: false,
    savedAt: initialSavedAt,
    error: null,
  });
  const [saver] = useState(() => new Autosaver(initialCode, save, setState, initialSavedAt));
  useEffect(() => saver.setSaveFn(save), [saver, save]);

  // Flush pending changes when the buffer goes away (problem/language switch, navigation).
  useEffect(
    () => () => {
      saver.stop();
      void saver.flush();
    },
    [saver],
  );

  useEffect(() => {
    saver.start(intervalSeconds);
    return () => saver.stop();
  }, [saver, intervalSeconds]);

  // Save when the window loses focus or the app is closing.
  useEffect(() => {
    const flush = () => void saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("blur", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [saver]);

  return {
    state,
    setCode: useCallback((code: string) => saver.setCode(code), [saver]),
    flush: useCallback(() => saver.flush(), [saver]),
  };
}
