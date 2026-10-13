import { useEffect, useState } from "react";
import { useSettings } from "@/api/hooks";

function systemPrefersDark() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/** The theme actually in effect ("system" resolved against the OS preference). */
export function useResolvedTheme(): "dark" | "light" {
  const { data } = useSettings();
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const theme = data?.theme ?? "dark";
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

/** Keeps the `dark` class on <html> in sync with settings. */
export function ThemeSync() {
  const theme = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  return null;
}
