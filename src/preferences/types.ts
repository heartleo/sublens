import type { Locale } from "../i18n";

export type ThemeMode = "system" | "light" | "dark";
export type DefaultView = "home" | "tools";

export interface Preferences {
  version: 1;
  theme: ThemeMode;
  locale: Locale;
  defaultView: DefaultView;
}
