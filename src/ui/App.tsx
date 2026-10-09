import { useEffect, useState } from "react";
import { ArrowLeft, Check, FilePlus2, KeyRound, MoreHorizontal, PanelLeftClose, Plus, RefreshCw, Send, Settings2, Trash2, X } from "lucide-react";
import type { Model, Provider } from "../domain/types";
import { mockStore } from "../services/mockStore";
import { providerApi, ProviderError, validateProviderInput } from "../services/providerApi";
import { secretVault } from "../services/nativeVault";

const threads = ["Welcome to Solar"];
type View = "chat" | "settings";
type FormState = { id?: string; name: string; baseUrl: string; protocol: Provider["protocol"]; secret: string };
const emptyForm: FormState = { name: "Gonka Router", baseUrl: "https://api.gonkarouter.io/v1", protocol: "openai-compatible", secret: "" };

export function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [draft, setDraft] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);

  const reload = async () => { setProviders(await mockStore.listProviders()); setModels(await mockStore.listModels()); };
  useEffect(() => { void reload(); }, []);
  const selected = models.find(model => model.id === selectedModel);

  return <main className={collapsed ? "shell collapsed" : "shell"}>
    <aside className="sidebar" aria-label="Conversations">
      <div className="side-top"><button className="icon-button" onClick={() => setCollapsed(true)} aria-label="Masquer la barre latérale"><PanelLeftClose size={17}/></button><span>Solar</span></div>
      <button className="new-thread"><FilePlus2 size={16}/><span>New conversation</span></button>
      <div className="thread-label">Recent</div>
      <nav>{threads.map(thread => <button key={thread} className="thread active"><span>{thread}</span><MoreHorizontal size={16}/></button>)}</nav>
      <button className="settings" onClick={() => setView("settings")}><Settings2 size={16}/><span>Settings</span></button>
    </aside>
    <section className="workspace">
      <header className="header"><button className="reveal icon-button" onClick={() => setCollapsed(false)} aria-label="Afficher la barre latérale"><PanelLeftClose size={17}/></button><span className="title">{view === "chat" ? "Welcome to Solar" : "Settings"}</span><button className="icon-button" aria-label="Menu de la fenêtre"><MoreHorizontal size={18}/></button></header>
      {view === "chat" ? <ChatView draft={draft} setDraft={setDraft} models={models} selectedModel={selectedModel} setSelectedModel={setSelectedModel} selected={selected} onSettings={() => setView("settings")} /> : <SettingsView providers={providers} models={models} editing={editing} setEditing={setEditing} reload={reload} onBack={() => setView("chat")} />}
    </section>
  </main>;
}

function ChatView({ draft, setDraft, models, selectedModel, setSelectedModel, selected, onSettings }: { draft: string; setDraft: (v: string) => void; models: Model[]; selectedModel: string; setSelectedModel: (v: string) => void; selected?: Model; onSettings: () => void }) {
  return <><div className="canvas"><div className="welcome"><p className="eyebrow">SOLAR · FOUNDATION</p><h1>Local-first AI,<br/>without the noise.</h1><p className="intro">Configure a provider to make your first model available here.</p><button className="inline-link" onClick={onSettings}>Configure a model provider <ArrowLeft size={14} className="link-arrow"/></button></div></div>
    <div className="composer-wrap"><div className="composer"><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message Solar…" rows={1}/><div className="composer-footer"><select className="model-control" aria-label="Choisir un modèle" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}><option value="">No model selected</option>{models.filter(model => model.enabled).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select><button className="send" type="button" disabled={!draft.trim() || !selected} aria-label="Envoyer le message"><Send size={16}/></button></div></div><p className="hint">{selected ? `${selected.name} · ready` : "Configure a provider in Settings to select a model."}</p></div></>;
}

function SettingsView({ providers, models, editing, setEditing, reload, onBack }: { providers: Provider[]; models: Model[]; editing: FormState | null; setEditing: (v: FormState | null) => void; reload: () => Promise<void>; onBack: () => void }) {
  return <div className="settings-page"><div className="settings-heading"><div><button className="back-button" onClick={onBack}><ArrowLeft size={15}/> Back to chat</button><p className="eyebrow">SETTINGS · MODEL PROVIDERS</p><h1>Model providers</h1><p className="intro">Connect a compatible API and choose which models Solar can use.</p></div><button className="primary-button" onClick={() => setEditing({ ...emptyForm })}><Plus size={16}/> Add provider</button></div>
    {editing ? <ProviderForm initial={editing} onDone={async () => { setEditing(null); await reload(); }} onCancel={() => setEditing(null)} /> : <ProviderList providers={providers} models={models} setEditing={setEditing} reload={reload} />}</div>;
}

function ProviderList({ providers, models, setEditing, reload }: { providers: Provider[]; models: Model[]; setEditing: (v: FormState) => void; reload: () => Promise<void> }) {
  if (!providers.length) return <div className="empty-card"><KeyRound size={22}/><h2>No providers yet</h2><p>Add Gonka Router or another OpenAI-compatible endpoint to discover models.</p></div>;
  return <div className="provider-list">{providers.map(provider => <ProviderCard key={provider.id} provider={provider} models={models.filter(model => model.providerId === provider.id)} setEditing={setEditing} reload={reload} />)}</div>;
}

function ProviderCard({ provider, models, setEditing, reload }: { provider: Provider; models: Model[]; setEditing: (v: FormState) => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<"test" | "refresh" | null>(null); const [notice, setNotice] = useState(""); const [manual, setManual] = useState("");
  const run = async (kind: "test" | "refresh") => { setBusy(kind); setNotice(""); try { if (kind === "test") { await providerApi.test(provider, secretVault); setNotice("Connection successful."); } else { const found = await providerApi.discoverModels(provider, secretVault); for (const model of found) await mockStore.saveModel(model); await mockStore.saveProvider({ ...provider, connectionState: "connected", lastError: undefined }); await reload(); setNotice(`${found.length} model${found.length === 1 ? "" : "s"} found.`); } } catch (error) { setNotice(error instanceof ProviderError ? error.message : "Une erreur inattendue est survenue."); } finally { setBusy(null); } };
  const addManual = async () => { const id = manual.trim(); if (!id) return; await mockStore.saveModel({ id, providerId: provider.id, name: id, capabilities: [], source: "manual", enabled: true }); setManual(""); await reload(); setNotice("Manual model added."); };
  const remove = async () => { if (window.confirm(`Delete ${provider.name}?`)) { await mockStore.deleteProvider(provider.id); await reload(); } };
  return <article className="provider-card"><div className="provider-head"><div><div className="provider-name"><span className={`status-dot ${provider.connectionState}`}/>{provider.name}</div><p className="provider-meta">{provider.protocol} · {provider.baseUrl}</p></div><div className="card-actions"><button className="small-button" onClick={() => setEditing({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl, protocol: provider.protocol, secret: "" })}>Edit</button><button className="icon-button danger" onClick={remove} aria-label={`Delete ${provider.name}`}><Trash2 size={16}/></button></div></div><div className="model-list">{models.length ? models.map(model => <div className="model-row" key={model.id}><span>{model.name}</span><span className="source-label">{model.source}</span></div>) : <p className="muted">No models discovered yet.</p>}</div><div className="provider-tools"><button className="small-button" onClick={() => void run("test")} disabled={Boolean(busy)}>{busy === "test" ? "Testing…" : "Test connection"}</button><button className="small-button" onClick={() => void run("refresh")} disabled={Boolean(busy)}><RefreshCw size={14}/>{busy === "refresh" ? "Refreshing…" : "Refresh models"}</button><div className="manual-add"><input aria-label="Manual model identifier" value={manual} onChange={e => setManual(e.target.value)} placeholder="model id"/><button className="small-button" onClick={() => void addManual()} disabled={!manual.trim()}><Plus size={14}/> Add manual</button></div></div>{notice && <p className="notice" role="status">{notice}</p>}</article>;
}

function ProviderForm({ initial, onDone, onCancel }: { initial: FormState; onDone: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(initial); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => { const issue = validateProviderInput(form.name, form.baseUrl, form.secret || (form.id ? "existing-secret" : "")); if (issue) { setError(issue); return; } setSaving(true); setError(""); const id = form.id ?? crypto.randomUUID(); const secretRef = `provider:${id}`; const old = form.id ? (await mockStore.listProviders()).find(item => item.id === id) : undefined; if (form.secret) await secretVault.set(secretRef, form.secret); const provider: Provider = { id, name: form.name.trim(), baseUrl: form.baseUrl.trim().replace(/\/$/, ""), protocol: form.protocol, secretRef, enabled: true, connectionState: old?.connectionState ?? "unknown" }; await mockStore.saveProvider(provider); setSaving(false); await onDone(); };
  return <div className="form-card"><div className="form-head"><div><p className="eyebrow">PROVIDER CONFIGURATION</p><h2>{form.id ? "Edit provider" : "Add provider"}</h2></div><button className="icon-button" onClick={onCancel} aria-label="Close"><X size={18}/></button></div><label>Provider name<input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Gonka Router" autoFocus/></label><label>Base URL<input value={form.baseUrl} onChange={e => update("baseUrl", e.target.value)} placeholder="https://api.example.com/v1" inputMode="url"/></label><label>Protocol<select value={form.protocol} onChange={e => update("protocol", e.target.value)}><option value="openai-compatible">OpenAI-compatible</option><option value="ollama">Ollama (prepared)</option></select></label><label>API key / secret<input type="password" value={form.secret} onChange={e => update("secret", e.target.value)} placeholder={form.id ? "Leave empty to keep current key" : "sk-…"} autoComplete="new-password"/><small><KeyRound size={13}/> Stored only in the system secure vault when running as the native app.</small></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="small-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : <><Check size={15}/> Save provider</>}</button></div></div>;
}
