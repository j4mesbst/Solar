import { scopedKey } from "./accountScope.ts";
import { invoke } from "@tauri-apps/api/core";
import type { SecretVault } from "./contracts";
import { previewVault } from "./mockStore";
const isNative = () => Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
export const secretVault: SecretVault = {
  get: (key) => isNative() ? invoke<string | null>("secret_get", { key: scopedKey(key) }) : previewVault.get(key),
  set: (key, value) => isNative() ? invoke<void>("secret_set", { key: scopedKey(key), value }) : previewVault.set(key, value),
  delete: (key) => isNative() ? invoke<void>("secret_delete", { key: scopedKey(key) }) : previewVault.delete(key)
};
