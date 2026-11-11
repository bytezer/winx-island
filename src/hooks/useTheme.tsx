import { createContext, useContext } from "react";
import { DEFAULT_THEME } from "../lib/theme";

export const ThemeContext = createContext(DEFAULT_THEME);

export function useTheme() {
  return useContext(ThemeContext);
}
