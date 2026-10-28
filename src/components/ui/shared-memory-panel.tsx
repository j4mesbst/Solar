import { useEffect, useState } from "react";
import { solarAgentStore, type AgentMemory } from "../../services/solarAgentStore";
import { saveSharedMemory } from "../../services/sharedMemory";
import { Button } from "./button";
export function SharedMemoryPanel() {
  const [memories, setMemories] = useState<AgentMemory[]>([]), [settings, setSettings] = useState({ enabled: true, cloud: false });
  const [content, setContent] = useState(""), [editing, setEditing] = useState<AgentMemory>(), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const load = async () => { const data = await solarAgentStore.snapshot(); setMemories(data.memories.filter(item => item.scope === "user")); setSettings(data.memorySettings ?? { enabled: true, cloud: false }); };
  useEffect(() => { void load().catch(() => setError("Lecture de la mémoire impossible.")); }, []);
  const operation = async (run: () => Promise<unknown>) => { setBusy(true); setError(""); try { await run(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); } };
  return <section className="shared-memory-panel"><h3>Mémoire partagée</h3><p>Chat et Atlas retrouvent les souvenirs pertinents que tu ajoutes ici. L’historique complet n’est pas mémorisé automatiquement.</p>
    <label><input type="checkbox" checked={settings.enabled} disabled={busy} onChange={e => void operation(() => solarAgentStore.saveMemorySettings({ ...settings, enabled: e.target.checked }))}/>Utiliser la mémoire</label>
    <label><input type="checkbox" checked={settings.cloud} disabled={busy} onChange={e => void operation(() => solarAgentStore.saveMemorySettings({ ...settings, cloud: e.target.checked }))}/>Autoriser l’envoi des souvenirs pertinents au modèle cloud choisi</label>
    {memories.map(item => <div className="shared-memory-entry" key={item.id}><p>{item.content}</p><small>{item.source} · {new Date(item.updatedAt).toLocaleDateString("fr")}</small><div><Button variant="ghost" disabled={busy} onClick={() => { setEditing(item); setContent(item.content); }}>Modifier</Button><Button variant="ghost" disabled={busy} onClick={() => void operation(() => solarAgentStore.deleteMemory(item.id))}>Supprimer</Button></div></div>)}
    <label>Souvenir à conserver<textarea aria-label="Souvenir à conserver" rows={3} maxLength={2000} value={content} onChange={e => setContent(e.target.value)}/></label><Button disabled={busy || !content.trim()} onClick={() => void operation(async () => { await saveSharedMemory(content, editing); setEditing(undefined); setContent(""); })}>{editing ? "Enregistrer le souvenir" : "Ajouter un souvenir"}</Button>{editing && <Button variant="ghost" onClick={() => { setEditing(undefined); setContent(""); }}>Annuler</Button>}{error && <p role="alert">{error}</p>}
  </section>;
}
