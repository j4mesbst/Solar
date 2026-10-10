import type { Hardware, PerformanceProfile } from "../domain/extensions";
export async function detectHardware(): Promise<Hardware> {
  if (
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  ) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<Hardware>("hardware_info");
  }
  return {
    architecture: navigator.platform,
    os: navigator.userAgent,
    native: false,
  };
}
export function runtimeProfile(profile: PerformanceProfile = "balanced") {
  return profile === "eco"
    ? { keep_alive: "0", options: { num_ctx: 2048 } }
    : profile === "performance"
      ? { keep_alive: "15m", options: { num_ctx: 8192 } }
      : { keep_alive: "5m", options: { num_ctx: 4096 } };
}
export function recommendModels(memory?: number) {
  const gb = memory ? memory / 2 ** 30 : undefined;
  return [
    {
      name: "qwen3:4b",
      downloadGB: 2.6,
      memoryGB: 6,
      use: "Chat et code léger",
      speed: "Rapide",
    },
    {
      name: "qwen3:8b",
      downloadGB: 5.2,
      memoryGB: 10,
      use: "Analyse et code",
      speed: "Équilibré",
    },
  ].filter((m) => !gb || m.memoryGB <= gb * 0.8);
}
