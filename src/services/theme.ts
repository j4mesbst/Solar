import type { AppSettings } from "../domain/types";
// Browser/native local wall clock: explicit schedule, independent of OS dark mode.
export function resolveTheme(theme: AppSettings["theme"], date = new Date()): "light" | "dark" {
  if (theme !== "system") return theme;
  return date.getHours() >= 6 && date.getHours() < 20 ? "light" : "dark";
}
export function nextThemeBoundary(date = new Date()): number {
  const next = new Date(date);
  if (date.getHours() < 6) next.setHours(6, 0, 0, 0);
  else if (date.getHours() < 20) next.setHours(20, 0, 0, 0);
  else { next.setDate(next.getDate() + 1); next.setHours(6, 0, 0, 0); }
  return Math.max(1, next.getTime() - date.getTime());
}
