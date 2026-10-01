import { createContext, useContext, type Context } from "react";

export type ThemePref = "light" | "dark" | "system";
export interface ThemeApi { theme: ThemePref; setTheme: (t: ThemePref) => void }
const g = globalThis as unknown as { __dsmTheme?: Context<ThemeApi> };
export const ThemeContext: Context<ThemeApi> =
  g.__dsmTheme ?? (g.__dsmTheme = createContext<ThemeApi>({ theme: "system", setTheme: () => {} }));
export const useTheme = () => useContext(ThemeContext);
