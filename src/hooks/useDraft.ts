import { useCallback, useEffect, useRef, useState } from "react";
import { solarStore } from "../services/store";
import type { Draft } from "../domain/types";
const blank = (id: string): Draft => ({ conversationId: id, text: "", attachments: [], updatedAt: new Date().toISOString() });
export function useDraft(id: string) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}); const draftRef = useRef(drafts); const [error, setError] = useState("");
  const loaded = useRef(new Set<string>()); const pending = useRef(new Map<string, Draft>()); const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const flush = useCallback(async (key?: string) => {
    const entries = key ? [[key, pending.current.get(key)] as const] : [...pending.current.entries()];
    for (const [key, value] of entries) { if (!value) continue; clearTimeout(timers.current.get(key)); timers.current.delete(key); try { await solarStore.saveDraft(value); if (pending.current.get(key) === value) pending.current.delete(key); setError(""); } catch { setError("Le brouillon reste visible, mais sa sauvegarde a échoué. Vérifie le stockage disponible."); } }
  }, []);
  useEffect(() => {
    if (!loaded.current.has(id)) void solarStore.getDraft(id).then(value => { loaded.current.add(id); if (!draftRef.current[id]) { const next = { ...draftRef.current, [id]: value ?? blank(id) }; draftRef.current = next; setDrafts(next); } }).catch(() => { setError("Impossible de restaurer le brouillon enregistré. Ton nouveau texte reste utilisable."); if (!draftRef.current[id]) { const next = { ...draftRef.current, [id]: blank(id) }; draftRef.current = next; setDrafts(next); } });
    return () => { void flush(id); };
  }, [id, flush]);
  useEffect(() => {
    const save = () => { if (!(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) { try { localStorage.setItem("solar.draft-recovery.v3", JSON.stringify(Object.values(draftRef.current).filter(draft => !draft.conversationId.startsWith("temp:")))); } catch { setError("Impossible de sauvegarder les brouillons avant la fermeture."); } } void flush(); }; const visibility = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", save); document.addEventListener("visibilitychange", visibility);
    // Native close waits for disk persistence; browser localStorage writes happen synchronously in the driver.
    let unlisten: (() => void) | undefined; let disposed = false;
    if ((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => { const win = getCurrentWindow(); const off = await win.onCloseRequested(async event => { event.preventDefault(); await flush(); if (pending.current.size === 0) await win.destroy(); }); if (disposed) off(); else unlisten = off; });
    return () => { disposed = true; unlisten?.(); window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", visibility); for (const timer of timers.current.values()) clearTimeout(timer); void flush(); };
  }, [flush]);
  const update = (patch: Partial<Pick<Draft, "text" | "attachments">>, key = id) => {
    const value = { ...(draftRef.current[key] ?? blank(key)), ...patch, updatedAt: new Date().toISOString() };
    const next = { ...draftRef.current, [key]: value }; draftRef.current = next; setDrafts(next); pending.current.set(key, value);
    clearTimeout(timers.current.get(key)); timers.current.set(key, setTimeout(() => void flush(key), 250));
  };
  const clearSent = async (key: string, snapshot: Draft) => {
    const value = draftRef.current[key];
    if (value && (value.text !== snapshot.text || JSON.stringify(value.attachments) !== JSON.stringify(snapshot.attachments))) return;
    clearTimeout(timers.current.get(key)); pending.current.delete(key);
    await solarStore.deleteDraft(key); const next = { ...draftRef.current, [key]: blank(key) }; draftRef.current = next; setDrafts(next);
    if (localStorage.getItem("solar.draft-recovery.v3")) localStorage.setItem("solar.draft-recovery.v3", JSON.stringify(Object.values(next).filter(draft => !draft.conversationId.startsWith("temp:"))));
  };
  const transfer = async (from: string, to: string) => { const value = draftRef.current[from]; if (!value) return; update({ text: value.text, attachments: value.attachments }, to); await flush(to); await clearSent(from, value); };
  return { draft: drafts[id] ?? blank(id), ready: Boolean(drafts[id]), update, clearSent, transfer, flush, error };
}
