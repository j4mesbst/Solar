import type { Hardware, PerformanceProfile } from "../domain/extensions";
let hardwarePromise: Promise<Hardware> | null = null;
export async function detectHardware(refresh=false): Promise<Hardware> {
  if(refresh)hardwarePromise=null;
  if (hardwarePromise) return hardwarePromise;
  hardwarePromise = detectHardwareOnce().catch(error => { hardwarePromise = null; throw error; });
  return hardwarePromise;
}
async function detectHardwareOnce(): Promise<Hardware> {
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
      name: "Solar 4B",
      downloadGB: 2.6,
      memoryGB: 5,
      use: "Chat rapide et code léger",
      speed: "Rapide",
    },
    {
      name: "Solar 9B",
      downloadGB: 6.6,
      memoryGB: 8,
      use: "Code agentique",
      speed: "Recommandé pour Solar Code",
    },
    {
      name: "Solar 12B",
      downloadGB: 8.1,
      memoryGB: 12,
      use: "Chat multimodal et code",
      speed: "Recommandé pour Solar Code",
    },
  ].filter((m) => !gb || m.memoryGB <= gb * 0.8);
}
