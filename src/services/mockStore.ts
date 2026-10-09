export { solarStore as mockStore } from "./store";

// Browser preview: persist a key for this browser + Solar address. Native builds
// keep using the macOS Keychain through nativeVault instead.
const previewVaultKey = "solar.preview-vault.v2";
const readPreviewSecrets = (): Record<string, string> => {
  try { let raw = localStorage.getItem(previewVaultKey); if (!raw) { raw = sessionStorage.getItem("solar.preview-vault.v1"); if (raw) localStorage.setItem(previewVaultKey, raw); } return JSON.parse(raw ?? "{}") as Record<string, string>; }
  catch { return {}; }
};
const writePreviewSecrets = (secrets: Record<string, string>) => localStorage.setItem(previewVaultKey, JSON.stringify(secrets));
export const previewVault = {
  async get(key: string) { return readPreviewSecrets()[key] ?? null; },
  async set(key: string, value: string) { const secrets = readPreviewSecrets(); secrets[key] = value; writePreviewSecrets(secrets); },
  async delete(key: string) { const secrets = readPreviewSecrets(); delete secrets[key]; writePreviewSecrets(secrets); }
};
