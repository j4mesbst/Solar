import { createSolarStore, emptyData, validateStoredData, type StoredData } from "./storageCore";
export const browserDataKey = "solar.data.v3";
const native = () => typeof window !== "undefined" && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
let nativeStore: Awaited<ReturnType<typeof import("@tauri-apps/plugin-store")["load"]>> | undefined;
async function getNativeStore() { return nativeStore ??= await (await import("@tauri-apps/plugin-store")).load("solar.v3.json", { defaults: {}, autoSave: false }); }
const legacy = (): StoredData => {
  const data = emptyData();
  const read = <T>(keys: string[], fallback: T): T => { for (const key of keys) { const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } return fallback; };
  data.providers = read(["solar.providers.v2", "solar.session.providers.v1", "solar.providers.v1"], []);
  data.models = read(["solar.models.v2", "solar.session.models.v1", "solar.models.v1"], []);
  data.conversations = read(["solar.session.conversations.v1", "solar.conversations.v1"], []);
  data.messages = read(["solar.session.messages.v1", "solar.messages.v1"], []);
  data.settings = read(["solar.settings.v2", "solar.session.settings.v1", "solar.settings.v1"], data.settings);
  return data;
};
function recoverDrafts(data: StoredData): StoredData {
  const raw = localStorage.getItem("solar.draft-recovery.v3"); if (!raw) return data;
  const drafts = JSON.parse(raw) as StoredData["drafts"];
  for (const draft of drafts) { if (draft.conversationId !== "new" && !data.conversations.some(c => c.id === draft.conversationId)) continue; const index = data.drafts.findIndex(d => d.conversationId === draft.conversationId); if (index < 0) data.drafts.push(draft); else if (draft.updatedAt >= data.drafts[index].updatedAt) data.drafts[index] = draft; }
  return data;
}
export const solarStore = createSolarStore({
  async read() {
    if (native()) { const store = await getNativeStore(); const data = await store.get<StoredData>("data"); if (data) return validateStoredData(data); const migrated = legacy(); await store.set("data", migrated); await store.save(); return migrated; }
    const raw = localStorage.getItem(browserDataKey); if (raw) { const data = recoverDrafts(validateStoredData(JSON.parse(raw))); localStorage.setItem(browserDataKey, JSON.stringify(data)); localStorage.removeItem("solar.draft-recovery.v3"); return data; }
    const migrated = legacy(); localStorage.setItem(browserDataKey, JSON.stringify(migrated)); return migrated;
  },
  async write(data) {
    if (native()) { const store = await getNativeStore(); await store.set("data", data); await store.save(); }
    else localStorage.setItem(browserDataKey, JSON.stringify(data));
  }
});
