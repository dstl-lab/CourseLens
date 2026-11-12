import { useEffect, useState } from "react";
import { useCourseStore } from "../store/courseStore";

/** Returns true when the effective theme is dark (respects system + manual override). */
export function useThemeIsDark(): boolean {
  const themeMode = useCourseStore((s) => s.themeMode);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [themeMode]);

  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return systemDark;
}

/** Reads themeMode from the store and keeps the <html> dark class in sync. */
export function useTheme() {
  const themeMode = useCourseStore((s) => s.themeMode);

  useEffect(() => {
    const html = document.documentElement;
    const apply = (isDark: boolean) => {
      if (isDark) {
        html.classList.add("dark");
      } else {
        html.classList.remove("dark");
      }
    };

    if (themeMode === "dark") {
      apply(true);
      return;
    }
    if (themeMode === "light") {
      apply(false);
      return;
    }

    // "system" — follow prefers-color-scheme
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const listener = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [themeMode]);
}
