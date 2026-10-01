import { useEffect, useState, type ReactNode } from "react";

import { ThemeContext, type ThemePref } from "./theme-store";
const KEY = "dsm-theme";

function apply(pref: ThemePref) {
  const dark =
    pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as ThemePref | null;
      if (saved === "light" || saved === "dark" || saved === "system") setThemeState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => apply("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme]);

  const setTheme = (t: ThemePref) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch {}
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

