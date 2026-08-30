import type { ThemeMode } from "./preferences";

export function applyTheme(theme: ThemeMode, animate = true): void {
  const root = document.documentElement;
  if (animate) root.classList.add("theme-changing");
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => root.classList.remove("theme-changing"));
    });
  }
}
