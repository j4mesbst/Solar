import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, Copy, FilePlus2, KeyRound, PanelLeft, Pencil, Plus, RefreshCw, Search, Settings2, Square, Trash2, X } from "lucide-react";
import type { AppSettings, Conversation, Effort, Message, Model, Provider } from "../domain/types";
import { solarStore } from "../services/store";
import { ChatError, streamChat } from "../services/chatApi";
import { providerApi, ProviderError, validateProviderInput } from "../services/providerApi";
import { secretVault } from "../services/nativeVault";
import { MarkdownMessage } from "../components/ui/markdown-message";
import { SearchPalette } from "../components/ui/search-palette";
import { PastedContents } from "../components/ui/pasted-content";
import { SelectionToolbar, SelectionResult } from "../components/ui/selection-actions";
import { useDraft } from "../hooks/useDraft";
import { useModelPreparation } from "../hooks/useModelPreparation";
import { useTextActions } from "../hooks/useTextActions";
import { draftMessage, pastedContent, shouldCompactPaste } from "../services/pastedContent";
import { refreshOllama, reconcileModels } from "../services/ollama";
import { ToolGroup } from "../components/ui/tool-group";

type SettingsSection = "providers" | "models" | "appearance" | "storage" | "preferences";
type FormState = { id?: string; name: string; baseUrl: string; protocol: Provider["protocol"]; secret: string };
const emptyForm: FormState = { name: "", baseUrl: "", protocol: "openai-compatible", secret: "" };
const now = () => new Date().toISOString();
const effortLabels: Record<Effort, string> = { low: "Bas", medium: "Moyen", high: "Élevé", ultra: "Ultra" };

export function App() {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 800);
  const [view, setView] = useState<"chat" | "settings">("chat");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const cancelRequest = useRef<(() => void) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ theme: "dark", sendOnEnter: true });
  const [searchOpen, setSearchOpen] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | undefined>();
  const [appError, setAppError] = useState("");
  const reload = async () => {
    const [p, m, c, s] = await Promise.all([solarStore.listProviders(), solarStore.listModels(), solarStore.listConversations(), solarStore.getSettings()]);
    setProviders(p); setModels(m); setConversations(c); conversationsRef.current = c; setSettings(s);
  };
  const selectConversation = (id: string | null) => { setTargetMessageId(undefined); currentIdRef.current = id; setCurrentId(id); setMessages([]); setView("chat"); if (window.innerWidth < 800) setCollapsed(true); };
  const current = conversations.find(item => item.id === currentId) ?? null;
  const updateConversation = async (value: Conversation) => {
    await solarStore.saveConversation(value);
    const list = await solarStore.listConversations(); conversationsRef.current = list; setConversations(list);
  };
  const createConversation = async () => {
    const list = conversationsRef.current;
    const latest = list.find(item => item.id === currentIdRef.current && item.modelId) ?? list.find(item => item.modelId);
    const fallback = models.find(model => model.id === settings.defaultModelId && model.enabled);
    const conversation: Conversation = { id: crypto.randomUUID(), title: "Nouveau chat", providerId: latest?.providerId ?? fallback?.providerId, modelId: latest?.modelId ?? fallback?.id, effort: latest?.effort ?? "medium", createdAt: now(), updatedAt: now() };
    await updateConversation(conversation); selectConversation(conversation.id); return conversation;
  };
  useEffect(() => {
    let live = true;
    void reload().then(() => { if (live && conversationsRef.current[0]) selectConversation(conversationsRef.current[0].id); void refreshOllama().then(() => { if (live) void reload(); }); }).catch(() => setAppError("Impossible de lire les données enregistrées."));
    const media = window.matchMedia("(max-width: 799px)");
    const resize = () => { if (media.matches) setCollapsed(true); };
    media.addEventListener("change", resize);
    return () => { live = false; media.removeEventListener("change", resize); cancelRequest.current?.(); };
  }, []);
  useEffect(() => { const toggle = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(open => !open); } }; window.addEventListener("keydown", toggle); return () => window.removeEventListener("keydown", toggle); }, []);
  useEffect(() => {
    let live = true;
    if (currentId) void solarStore.listMessages(currentId).then(value => { if (live) setMessages(value); });
    return () => { live = false; };
  }, [currentId]);
  const updateMessages = (id: string, value: Message[]) => { if (currentIdRef.current === id) setMessages(value); };
  const updateSettings = async (next: AppSettings) => { await solarStore.saveSettings(next); setSettings(next); };
  const rename = async (conversation: Conversation) => {
    const title = window.prompt("Nom de la conversation", conversation.title)?.trim();
    if (title) await updateConversation({ ...conversation, title, updatedAt: now() });
  };
  const remove = async (conversation: Conversation) => {
    if (!window.confirm(`Supprimer « ${conversation.title} » ?`)) return;
    cancelRequest.current?.(); await solarStore.deleteConversation(conversation.id); await reload(); selectConversation(conversationsRef.current[0]?.id ?? null);
  };
  const clearHistory = async () => {
    if (!window.confirm("Supprimer toutes les conversations enregistrées ? Les fournisseurs et les clés seront conservés.")) return;
    cancelRequest.current?.();
    for (const conversation of await solarStore.listConversations()) await solarStore.deleteConversation(conversation.id);
    await reload(); selectConversation(null);
  };
  return <><main className={`shell ${collapsed ? "collapsed" : ""} ${settings.theme === "light" ? "" : "dark"}`} data-theme={settings.theme}>
    {!collapsed && <button className="sidebar-scrim" aria-label="Fermer la barre latérale" onClick={() => setCollapsed(true)}/>}
    <aside className="sidebar" aria-label="Conversations" {...((collapsed || searchOpen) ? { inert: "" } : {})}>
      <div className="side-top"><span className="wordmark">Solar</span><button className="icon-button" onClick={() => setCollapsed(true)} aria-label="Masquer la barre latérale"><PanelLeft size={18}/></button></div>
      <button className="new-thread" onClick={() => void createConversation()}><FilePlus2 size={17}/><span>Nouveau chat</span></button>
      <nav aria-label="Historique"><p className="thread-label">Conversations</p>{conversations.length ? conversations.map(conversation => <div className={`thread-wrap ${conversation.id === currentId && view === "chat" ? "active" : ""}`} key={conversation.id}><button className="thread" onClick={() => selectConversation(conversation.id)} aria-current={conversation.id === currentId && view === "chat" ? "page" : undefined}><span>{conversation.title}</span></button><button className="thread-action" onClick={() => void rename(conversation)} aria-label={`Renommer ${conversation.title}`}><Pencil size={13}/></button></div>) : <p className="sidebar-empty">Tes conversations apparaîtront ici.</p>}</nav>
      <button className={`settings ${view === "settings" ? "active" : ""}`} onClick={() => { setView("settings"); if (window.innerWidth < 800) setCollapsed(true); }}><Settings2 size={17}/><span>Paramètres</span></button>
    </aside>
    <section className="workspace" {...(searchOpen ? { inert: "" } : {})}><header className="header"><div className="header-start">{collapsed && <button className="icon-button" onClick={() => setCollapsed(false)} aria-label="Afficher la barre latérale"><PanelLeft size={18}/></button>}<span className="title">{collapsed ? "Solar" : view === "settings" ? "Paramètres" : current?.title ?? "Nouveau chat"}</span></div>{view === "chat" && current && <button className="icon-button" onClick={() => void remove(current)} aria-label="Supprimer la conversation"><Trash2 size={16}/></button>}</header>
      {appError && <p className="global-error" role="alert">{appError}</p>}
      <div className="chat-pane" hidden={view !== "chat"}><ChatView current={current} messages={messages} providers={providers} models={models} settings={settings} onCreated={createConversation} onConversation={updateConversation} onMessages={updateMessages} onSettings={() => setView("settings")} cancelRequest={cancelRequest} targetMessageId={targetMessageId} onTargetShown={() => setTargetMessageId(undefined)} onRefreshModels={async () => { await refreshOllama(); await reload(); }}/></div>
      {view === "settings" && <SettingsView providers={providers} models={models} settings={settings} updateSettings={updateSettings} reload={reload} onBack={() => setView("chat")} clearHistory={clearHistory}/>}
    </section>
  </main>{searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} onOpen={(id, messageId) => { selectConversation(id); setTargetMessageId(messageId); }}/>}</>;
}

function ChatView({ current, messages, providers, models, settings, onCreated, onConversation, onMessages, onSettings, cancelRequest, targetMessageId, onTargetShown, onRefreshModels }: {
  current: Conversation | null; messages: Message[]; providers: Provider[]; models: Model[]; settings: AppSettings;
  onCreated: () => Promise<Conversation>; onConversation: (value: Conversation) => Promise<void>; onMessages: (id: string, value: Message[]) => void;
  targetMessageId?: string; onTargetShown: () => void; onRefreshModels: () => Promise<void>;
  onSettings: () => void; cancelRequest: React.MutableRefObject<(() => void) | null>;
}) {
  const draftKey = current?.id ?? "new";
  const { draft: savedDraft, update: updateDraft, clearSent, transfer, error: draftError, ready: draftReady } = useDraft(draftKey);
  const draft = savedDraft.text;
  const setDraft = (text: string) => updateDraft({ text });
  const [error, setError] = useState("");
  const [activeRequest, setActiveRequest] = useState<{ conversationId: string; started: number } | null>(null);
  const requestRef = useRef<{ controller: AbortController; conversationId: string } | null>(null);
  const locked = useRef(false); const currentRef = useRef(current); currentRef.current = current;
  const [elapsed, setElapsed] = useState(0);
  const textarea = useRef<HTMLTextAreaElement>(null); const scroll = useRef<HTMLDivElement>(null); const follow = useRef(true);
  const selectedModel = models.find(model => model.id === (current?.modelId ?? settings.defaultModelId));
  const provider = providers.find(item => item.id === selectedModel?.providerId);
  const [actionBusy, setActionBusy] = useState(false);
  const preparation = useModelPreparation(provider, selectedModel, Boolean(activeRequest) || actionBusy);
  const actions = useTextActions(current?.id, provider, selectedModel, current?.effort ?? "medium", Boolean(activeRequest) || locked.current, preparation.cancel);
  useEffect(() => { setActionBusy(actions.busy); }, [actions.busy]);
  const [highlighted, setHighlighted] = useState<string>();
  useEffect(() => { if (!targetMessageId || !messages.some(message => message.id === targetMessageId)) return; const element = document.getElementById(`message-${targetMessageId}`); element?.scrollIntoView({ block: "center" }); follow.current = false; setHighlighted(targetMessageId); onTargetShown(); }, [targetMessageId, messages]);
  useEffect(() => { if (!highlighted) return; const timer = setTimeout(() => setHighlighted(undefined), 1800); return () => clearTimeout(timer); }, [highlighted]);
  const activeHere = Boolean(activeRequest && activeRequest.conversationId === current?.id);
  useEffect(() => { cancelRequest.current = () => requestRef.current?.controller.abort(); return () => { requestRef.current?.controller.abort(); cancelRequest.current = null; }; }, []);
  useEffect(() => { if (!activeRequest) return; const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - activeRequest.started) / 1000)), 1000); return () => clearInterval(timer); }, [activeRequest]);
  useEffect(() => { setError(""); follow.current = true; }, [current?.id]);
  useEffect(() => { if (scroll.current && follow.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages]);
  useEffect(() => { if (textarea.current) { textarea.current.style.height = "auto"; textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 200)}px`; } }, [draft]);
  const changeSelection = async (modelId?: string, effort?: Effort) => {
    try {
      const creating = !currentRef.current;
      const base = currentRef.current ?? await onCreated();
      if (creating) await transfer("new", base.id);
      const model = models.find(item => item.id === modelId);
      const next = { ...base, ...(model ? { modelId: model.id, providerId: model.providerId } : {}), ...(effort ? { effort } : {}), updatedAt: now() };
      currentRef.current = next; await onConversation(next);
    } catch { setError("Impossible d’enregistrer ce choix. Vérifie le stockage disponible."); }
  };
  const send = async () => {
    const snapshot = structuredClone(savedDraft); const content = draftMessage(snapshot); if (!content.trim() || locked.current || actions.busyRef.current) return;
    preparation.cancel();
    locked.current = true; setError("");
    const controller = new AbortController(); const started = Date.now();
    let active: Conversation | null = null; let latest: Message | null = null; let history: Message[] = [];
    requestRef.current = { controller, conversationId: current?.id ?? "" };
    try {
      active = currentRef.current ?? await onCreated();
      const model = models.find(item => item.id === (active!.modelId ?? settings.defaultModelId));
      const activeProvider = providers.find(item => item.id === model?.providerId && item.enabled);
      if (!model?.enabled || model.available === false || !activeProvider) throw new ChatError("Sélectionne un modèle connecté dans les paramètres pour commencer.", "model");
      // Snapshot model, effort and history once. Changes made during streaming affect the next turn.
      const effort = active.effort; const rawHistory = await solarStore.listMessages(active.id);
      const user: Message = { id: crypto.randomUUID(), conversationId: active.id, role: "user", content, displayText: snapshot.text, attachments: snapshot.attachments, status: "completed", createdAt: now(), order: rawHistory.length };
      latest = { id: crypto.randomUUID(), conversationId: active.id, role: "assistant", content: "", status: "streaming", createdAt: now(), order: rawHistory.length + 1, modelName: model.name, effort };
      history = [...rawHistory, user]; requestRef.current.conversationId = active.id;
      const updated = { ...(currentRef.current?.id === active.id ? currentRef.current : active), title: ["New conversation", "Nouveau chat"].includes(active.title) ? content.slice(0, 48) : active.title, updatedAt: now() };
      await onConversation(updated);
      setElapsed(0); setActiveRequest({ conversationId: active.id, started });
      await solarStore.saveMessage(user); await solarStore.saveMessage(latest); onMessages(active.id, [...history, latest]);
      try { await clearSent(draftKey, snapshot); } catch { setError("Le message est envoyé, mais le brouillon n’a pas pu être effacé."); }
      let lastSaved = 0;
      await streamChat({ provider: activeProvider, model: model.providerModelId ?? model.id, messages: history, effort, vault: secretVault, signal: controller.signal, onDelta: delta => {
        latest = { ...latest!, content: latest!.content + delta }; onMessages(active!.id, [...history, latest]);
        if (Date.now() - lastSaved > 250) { lastSaved = Date.now(); void solarStore.saveMessage(latest).catch(() => setError("La réponse s’affiche, mais son enregistrement a échoué.")); }
      } });
      latest = { ...latest, status: "completed", durationSeconds: Math.round((Date.now() - started) / 1000) };
      await solarStore.saveMessage(latest); onMessages(active.id, [...history, latest]);
    } catch (reason) {
      const normalized = reason instanceof ChatError ? reason : new ChatError("Impossible de terminer la réponse ou de l’enregistrer. Réessaie après avoir vérifié le stockage.", "provider");
      if (latest && active) {
        latest = { ...latest, status: normalized.code === "interrupted" ? "interrupted" : "error", error: normalized.code === "interrupted" ? undefined : normalized.message };
        try { await solarStore.saveMessage(latest); } catch { /* Display the error even if persistence fails. */ }
        onMessages(active.id, [...history, latest]);
      } else setError(normalized.message);
    } finally { requestRef.current = null; locked.current = false; setActiveRequest(null); }
  };
  return <><div ref={scroll} className={`chat-scroll ${messages.length ? "has-messages" : ""}`} onScroll={() => { const el = scroll.current; if (el) follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
    {!messages.length ? <div className="canvas"><div className="welcome"><h1>Local AI.</h1><p>Un espace calme pour tes idées.</p>{!selectedModel && <button className="inline-link" onClick={onSettings}>Connecter un modèle <ArrowUp size={14}/></button>}</div></div> : <div className="message-list">{messages.filter(message => message.role !== "system").map(message => <article id={`message-${message.id}`} data-message-id={message.id} className={`message ${message.role} ${highlighted === message.id ? "highlighted" : ""}`} key={message.id}>
      {message.role === "user" ? <><div className="user-bubble">{message.displayText ?? message.content}</div>{message.attachments && <PastedContents items={message.attachments}/>}</> : <><div className="message-role">Solar <span>{message.modelName}</span></div><div className="message-content"><MarkdownMessage content={message.content}/></div>
      {(message.status === "streaming" || message.status === "interrupted") && <ToolGroup state={message.status === "streaming" ? "pending" : "interrupted"} completeLabel="Réponse terminée" shimmerLabel={message.content ? "Réponse en cours…" : "Préparation de la réponse…"} interruptedLabel="Réponse interrompue" elapsedTime={activeHere ? `${elapsed} s` : undefined} className="generation-status"/>}
      {message.status === "completed" && message.content && <CopyMessage content={message.content}/>}</>}
      {actions.result?.messageId === message.id && <SelectionResult result={actions.result} busy={actions.busy} onStop={actions.cancel} onClose={actions.close} onInsert={text => { setDraft(draft ? `${draft}\n\n${text}` : text); textarea.current?.focus(); }}/>}
      {message.error && <p className="message-error" role="alert">{message.error}</p>}
    </article>)}</div>}
  </div>{actions.selection && <SelectionToolbar selection={actions.selection} disabled={Boolean(activeRequest) || actions.busy} onAction={action => void actions.run(action)}/>}<div className="composer-wrap">{draftError && <p className="composer-error" role="alert">{draftError}</p>}{error && <p className="composer-error" role="alert">{error}</p>}<div className="composer">{savedDraft.attachments.length > 0 && <PastedContents items={savedDraft.attachments} onRemove={id => updateDraft({ attachments: savedDraft.attachments.filter(item => item.id !== id) })} onExpand={id => { const item = savedDraft.attachments.find(item => item.id === id); if (item) updateDraft({ text: draft ? `${draft}\n\n${item.content}` : item.content, attachments: savedDraft.attachments.filter(item => item.id !== id) }); }}/>}<textarea ref={textarea} readOnly={!draftReady} aria-busy={!draftReady} aria-label="Message à Solar" value={draft} onChange={event => setDraft(event.target.value)} onPaste={event => { const content = event.clipboardData.getData("text/plain"); if (shouldCompactPaste(content)) { event.preventDefault(); updateDraft({ attachments: [...savedDraft.attachments, pastedContent(content)] }); } }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && settings.sendOnEnter !== false) { event.preventDefault(); void send(); } }} placeholder={activeRequest ? "Prépare ton prochain message…" : "Message à Solar…"} rows={2}/>
    {selectedModel?.available === false && <p className="composer-note">Ce modèle n’est plus disponible. Actualise Ollama ou choisis un autre modèle.</p>}<div className="composer-footer"><div className="composer-controls"><ModelSelector models={models} providers={providers} selected={selectedModel} onSelect={id => void changeSelection(id)} onSettings={onSettings} onRefresh={onRefreshModels} preparation={preparation.state}/><EffortSelector value={current?.effort ?? "medium"} onSelect={value => void changeSelection(undefined, value)}/></div>{activeRequest ? <button className="stop" type="button" onClick={() => requestRef.current?.controller.abort()} aria-label="Arrêter la génération"><Square size={13} fill="currentColor"/></button> : <button className="send" type="button" onClick={() => void send()} disabled={(!draft.trim() && !savedDraft.attachments.length) || !selectedModel || selectedModel.available === false || !provider?.enabled || actions.busy} aria-label="Envoyer le message"><ArrowUp size={20}/></button>}</div>
  </div><p className="hint">{activeRequest ? "Tu peux écrire et changer les réglages du prochain message." : settings.sendOnEnter === false ? "Utilise le bouton pour envoyer ton message." : "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne"}</p></div></>;
}

function CopyMessage({ content }: { content: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return <button className="copy-message" onClick={async () => { try { await navigator.clipboard.writeText(content); setState("copied"); } catch { setState("error"); } }} aria-label="Copier la réponse">{state === "copied" ? <Check size={14}/> : <Copy size={14}/>}<span>{state === "copied" ? "Copié" : state === "error" ? "Copie indisponible" : "Copier"}</span></button>;
}

function ModelSelector({ models, providers, selected, onSelect, onSettings, onRefresh, preparation }: { models: Model[]; providers: Provider[]; selected?: Model; onSelect: (id: string) => void; onSettings: () => void; onRefresh: () => Promise<void>; preparation: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false); const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return; input.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside); return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const filtered = models.filter(model => model.enabled && model.available !== false && providers.some(p => p.id === model.providerId && p.enabled) && `${model.name} ${providers.find(p => p.id === model.providerId)?.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="control-popover" ref={root} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}><button ref={trigger} className="model-control" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); setOpen(!open); }}><span>{selected?.name ?? "Choisir un modèle"}</span>{preparation && <small className="preparation-state">{preparation}</small>}<ChevronDown size={13}/></button>
    {open && <div className="model-popover" role="dialog" aria-label="Choisir un modèle"><label className="model-search"><Search size={15}/><input ref={input} aria-label="Rechercher un modèle" placeholder="Rechercher un modèle…" value={query} onChange={event => setQuery(event.target.value)}/></label><div className="model-results">{providers.filter(p => p.enabled).map(provider => { const group = filtered.filter(model => model.providerId === provider.id); return group.length ? <div className="model-group" key={provider.id}><p>{provider.name}<span>{provider.protocol === "ollama" ? "Local" : "API"}</span></p>{group.map(model => <button key={model.id} className={`model-option ${selected?.id === model.id ? "selected" : ""}`} onClick={() => { onSelect(model.id); setOpen(false); trigger.current?.focus(); }}><span>{model.name}</span>{selected?.id === model.id && <Check size={14}/>}</button>)}</div> : null; })}{!filtered.length && <p className="popover-empty">{models.length ? "Aucun modèle correspondant." : "Ajoute un fournisseur pour choisir un modèle."}</p>}</div><button className="popover-footer" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}>{refreshing ? "Détection…" : "Actualiser Ollama"}<RefreshCw size={14}/></button><button className="popover-footer" onClick={() => { setOpen(false); onSettings(); }}>Gérer les modèles <Settings2 size={14}/></button></div>}
  </div>;
}
function EffortSelector({ value, onSelect }: { value: Effort; onSelect: (value: Effort) => void }) {
  return <label className="effort-label" title="Profil de réponse : adapte la consigne et le budget de sortie. Le fournisseur n’indique pas de niveaux de raisonnement natif."><span className="sr-only">Niveau d’effort</span><select className="effort-control" aria-label="Niveau d’effort" value={value} onChange={event => onSelect(event.target.value as Effort)}>{Object.entries(effortLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>;
}

function SettingsView({ providers, models, settings, updateSettings, reload, onBack, clearHistory }: { providers: Provider[]; models: Model[]; settings: AppSettings; updateSettings: (next: AppSettings) => Promise<void>; reload: () => Promise<void>; onBack: () => void; clearHistory: () => Promise<void> }) {
  const [section, setSection] = useState<SettingsSection>("providers"); const [editing, setEditing] = useState<FormState | null>(null); const [error, setError] = useState("");
  const sections: [SettingsSection, string][] = [["providers", "Fournisseurs"], ["models", "Modèles"], ["appearance", "Apparence"], ["storage", "Stockage"], ["preferences", "Préférences"]];
  const saveSettings = async (next: AppSettings) => { try { await updateSettings(next); setError(""); } catch { setError("Impossible d’enregistrer les préférences. Vérifie le stockage disponible."); } };
  return <div className="settings-page"><button className="back-button" onClick={onBack}><ArrowLeft size={15}/> Retour au chat</button><h1>Paramètres</h1><div className="settings-layout"><nav className="settings-nav" aria-label="Sections des paramètres">{sections.map(([id, name]) => <button key={id} className={section === id ? "selected" : ""} aria-current={section === id ? "page" : undefined} onClick={() => { setSection(id); setEditing(null); }}>{name}</button>)}</nav><div className="settings-content">
    {section === "providers" && <><div className="section-title"><div><h2>Fournisseurs</h2><p>Connecte un modèle local ou une API compatible.</p></div>{!editing && <button className="small-button" onClick={() => setEditing({ ...emptyForm })}><Plus size={15}/> Ajouter</button>}</div>{editing ? <ProviderForm key={editing.id ?? "new"} initial={editing} onDone={async () => { await reload(); setEditing(null); }} onCancel={() => setEditing(null)}/> : <ProviderList providers={providers} models={models} setEditing={setEditing} reload={reload}/>}</>}
    {section === "appearance" && <><div className="section-title"><div><h2>Apparence</h2><p>Un espace à ton goût.</p></div></div><div className="theme-options">{(["dark", "light"] as const).map(theme => <button key={theme} className={`theme-card ${settings.theme === theme ? "selected" : ""}`} aria-pressed={settings.theme === theme} onClick={() => void saveSettings({ ...settings, theme })}><span className={`theme-preview ${theme}`}><i/><i/><i/></span><span>{theme === "dark" ? "Sombre" : "Clair"}{settings.theme === theme && <Check size={15}/>}</span></button>)}</div></>}
    {section === "models" && <><div className="section-title"><div><h2>Modèles</h2><p>Seuls les modèles ajoutés ou détectés apparaissent dans le chat.</p></div></div>{models.length ? providers.map(provider => { const list = models.filter(model => model.providerId === provider.id); return list.length ? <div className="settings-model-group" key={provider.id}><h3>{provider.name}</h3>{list.map(model => <div className="settings-model-row" key={model.id}><div><strong>{model.name}</strong><p>{model.available === false ? "Modèle supprimé ou indisponible" : model.source === "manual" ? "Ajouté manuellement" : "Détecté auprès du fournisseur"}</p></div><label className="toggle-label"><input type="checkbox" checked={model.enabled} onChange={async event => { await solarStore.saveModel({ ...model, enabled: event.target.checked }); await reload(); }}/><span>Disponible</span></label><button className="icon-button" aria-label={`Supprimer le modèle ${model.name}`} onClick={async () => { await solarStore.deleteModel(model.id); await reload(); }}><Trash2 size={15}/></button></div>)}</div> : null; }) : <div className="empty-card"><h3>Aucun modèle pour le moment</h3><p>Ajoute un fournisseur puis actualise sa liste de modèles.</p><button className="small-button" onClick={() => setSection("providers")}>Configurer un fournisseur</button></div>}<p className="settings-note">Solar est le nom de l’application. Le modèle Solar adaptatif n’est pas encore disponible.</p></>}
    {section === "storage" && <><div className="section-title"><div><h2>Stockage</h2><p>Garde le contrôle sur ce que Solar conserve.</p></div></div><div className="preference-row"><div><h3>Conversations</h3><p>Enregistrées localement avec leurs messages et brouillons, puis restaurées à la réouverture de Solar.</p></div><button className="small-button" onClick={() => void clearHistory()}>Effacer</button></div><div className="preference-row"><div><h3>Fournisseurs et clés</h3><p>Conservés sur ce navigateur et à cette adresse. L’application macOS utilise le Trousseau pour les clés ; l’aperçu web utilise le stockage du navigateur.</p></div></div></>}
    {section === "preferences" && <><div className="section-title"><div><h2>Préférences</h2><p>Les petits détails qui rendent le chat plus naturel.</p></div></div><div className="preference-row"><div><h3>Envoyer avec Entrée</h3><p>Maj + Entrée ajoute toujours une nouvelle ligne.</p></div><input aria-label="Envoyer avec Entrée" type="checkbox" checked={settings.sendOnEnter !== false} onChange={event => void saveSettings({ ...settings, sendOnEnter: event.target.checked })}/></div><div className="preference-row"><div><h3>Modèle par défaut</h3><p>Pour la première conversation. Les suivantes reprennent ton dernier choix.</p></div><select aria-label="Modèle par défaut" value={settings.defaultModelId ?? ""} onChange={event => void saveSettings({ ...settings, defaultModelId: event.target.value || undefined })}><option value="">Choisir dans le chat</option>{models.filter(m => m.enabled).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></div><div className="preference-row"><div><h3>Niveaux d’effort</h3><p>Bas : réponse courte. Moyen : réponse complète. Élevé et Ultra : réponse plus approfondie avec un budget plus grand. Ces profils ne déclenchent pas de recherche Internet ; les capacités de raisonnement natif ne sont pas déclarées par les fournisseurs.</p></div></div></>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div></div></div>;
}

function ProviderList({ providers, models, setEditing, reload }: { providers: Provider[]; models: Model[]; setEditing: (value: FormState) => void; reload: () => Promise<void> }) {
  return providers.length ? <div className="provider-list">{providers.map(provider => <ProviderCard key={provider.id} provider={provider} models={models.filter(model => model.providerId === provider.id)} setEditing={setEditing} reload={reload}/>)}</div> : <div className="empty-card"><KeyRound size={23}/><h3>Ton premier modèle commence ici.</h3><p>Ollama en local, GonkaRouter ou une autre API compatible.</p></div>;
}
function ProviderCard({ provider, models, setEditing, reload }: { provider: Provider; models: Model[]; setEditing: (value: FormState) => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<"test" | "refresh" | null>(null); const [notice, setNotice] = useState(""); const [manual, setManual] = useState(""); const [failed, setFailed] = useState(false);
  const run = async (kind: "test" | "refresh") => {
    setBusy(kind); setNotice(""); setFailed(false);
    try {
      await solarStore.saveProvider({ ...provider, connectionState: "testing" }); await reload();
      if (kind === "test") { await providerApi.test(provider, secretVault); setNotice("Connexion réussie."); }
      else { const found = await providerApi.discoverModels(provider, secretVault); await reconcileModels(provider, found); setNotice(`${found.length} modèle${found.length > 1 ? "s" : ""} détecté${found.length > 1 ? "s" : ""}.`); }
      await solarStore.saveProvider({ ...provider, connectionState: "connected", lastError: undefined });
    } catch (reason) { const message = reason instanceof ProviderError ? reason.message : "Impossible d’enregistrer ou de joindre le fournisseur."; setNotice(message); setFailed(true); await solarStore.saveProvider({ ...provider, connectionState: "error", lastError: message }).catch(() => {}); }
    finally { setBusy(null); await reload(); }
  };
  const remove = async () => { if (!window.confirm(`Supprimer ${provider.name} et sa clé enregistrée ?`)) return; try { if (await secretVault.get(provider.secretRef)) await secretVault.delete(provider.secretRef); await solarStore.deleteProvider(provider.id); await reload(); } catch { setFailed(true); setNotice("Impossible de supprimer le fournisseur ou sa clé."); } };
  const addManual = async () => { const id = manual.trim(); if (!id) return; try { await solarStore.saveModel({ id: `${provider.id}:${id}`, providerId: provider.id, providerModelId: id, name: id, capabilities: [], source: "manual", enabled: true }); setManual(""); await reload(); setFailed(false); setNotice("Modèle ajouté."); } catch { setFailed(true); setNotice("Impossible d’enregistrer le modèle."); } };
  const stateLabel = { connected: "Connecté", error: "Connexion en erreur", testing: "Test en cours", unknown: "Connexion à tester" }[provider.connectionState];
  return <article className="provider-card"><div className="provider-head"><div><h3 className="provider-name">{provider.name}<span className={`status-dot ${provider.connectionState}`} aria-label={stateLabel} title={stateLabel}/></h3><p className="provider-meta">{provider.baseUrl}</p></div><div className="card-actions"><button className="small-button" onClick={() => setEditing({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl, protocol: provider.protocol, secret: "" })}>Modifier</button><button className="icon-button" onClick={() => void remove()} aria-label={`Supprimer ${provider.name}`}><Trash2 size={15}/></button></div></div><p className="muted">{models.length} modèle{models.length > 1 ? "s" : ""} · {provider.protocol === "ollama" ? "Local" : "API compatible"}</p><div className="provider-tools"><button className="small-button" onClick={() => void run("test")} disabled={Boolean(busy)}>{busy === "test" ? "Test en cours…" : "Tester la connexion"}</button><button className="small-button" onClick={() => void run("refresh")} disabled={Boolean(busy)}><RefreshCw size={14} className={busy === "refresh" ? "spinning" : ""}/>{busy === "refresh" ? "Actualisation…" : "Actualiser les modèles"}</button></div><div className="manual-add"><input aria-label={`Identifiant de modèle pour ${provider.name}`} value={manual} onChange={event => setManual(event.target.value)} placeholder="Identifiant du modèle" onKeyDown={event => { if (event.key === "Enter") void addManual(); }}/><button className="small-button" onClick={() => void addManual()} disabled={!manual.trim()}>Ajouter un modèle</button></div>{notice && <p className={failed ? "form-error" : "notice"} role={failed ? "alert" : "status"}>{notice}</p>}</article>;
}
function ProviderForm({ initial, onDone, onCancel }: { initial: FormState; onDone: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(initial); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState(false); const [checking, setChecking] = useState(Boolean(initial.id)); const [replace, setReplace] = useState(!initial.id);
  useEffect(() => { let live = true; if (initial.id) void (async () => { try { const provider = (await solarStore.listProviders()).find(p => p.id === initial.id); const exists = provider ? Boolean(await secretVault.get(provider.secretRef)) : false; if (live) { setStored(exists); setReplace(!exists); } } catch { if (live) setError("Impossible de vérifier la clé enregistrée."); } finally { if (live) setChecking(false); } })(); return () => { live = false; }; }, [initial.id]);
  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    if (checking || saving) return;
    const issue = validateProviderInput(form.name, form.baseUrl, form.secret || (stored && !replace ? "stored" : ""), form.protocol);
    if (issue) { setError(issue); return; } setSaving(true); setError("");
    try {
      const old = form.id ? (await solarStore.listProviders()).find(item => item.id === form.id) : undefined;
      const id = form.id ?? crypto.randomUUID(); const secretRef = old?.secretRef ?? `provider:${id}`;
      // Masked display is never treated as an actual credential.
      if (form.secret.trim() && replace) await secretVault.set(secretRef, form.secret.trim());
      await solarStore.saveProvider({ id, name: form.name.trim(), baseUrl: form.baseUrl.trim().replace(/\/$/, ""), protocol: form.protocol, secretRef, enabled: true, connectionState: "unknown" });
      await onDone();
    } catch { setError("La configuration n’a pas pu être enregistrée. Vérifie le stockage du navigateur ou l’accès au Trousseau."); }
    finally { setSaving(false); }
  };
  return <form className="form-card" onSubmit={event => { event.preventDefault(); void save(); }}><div className="form-head"><h3>{form.id ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</h3><button type="button" className="icon-button" onClick={onCancel} aria-label="Fermer"><X size={18}/></button></div><label>Nom<input value={form.name} onChange={event => update("name", event.target.value)} autoFocus placeholder="GonkaRouter"/></label><label>Protocole<select value={form.protocol} onChange={event => { update("protocol", event.target.value); if (event.target.value === "ollama" && !form.baseUrl) update("baseUrl", "http://localhost:11434"); }}><option value="openai-compatible">API compatible OpenAI</option><option value="ollama">Ollama · local</option></select></label><label>URL de base<input value={form.baseUrl} onChange={event => update("baseUrl", event.target.value)} inputMode="url" placeholder={form.protocol === "ollama" ? "http://localhost:11434" : "https://api.gonkarouter.io/v1"}/></label>{form.protocol !== "ollama" && <><label>Clé API<input type="password" autoComplete="new-password" value={stored && !replace ? "configured" : form.secret} readOnly={checking || (stored && !replace)} aria-label={stored && !replace ? "Clé API configurée" : "Clé API"} onChange={event => update("secret", event.target.value)} placeholder={checking ? "Vérification…" : "Clé du fournisseur"}/></label>{stored && <div className="key-state"><span><Check size={14}/> Clé enregistrée</span><button type="button" className="text-button" onClick={() => { setReplace(!replace); update("secret", ""); }}>{replace ? "Conserver la clé" : "Remplacer"}</button></div>}<p className="settings-note">La clé reste masquée. Dans l’aperçu web, elle est conservée dans le stockage de ce navigateur ; dans l’app macOS, dans le Trousseau.</p></>}{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="small-button" onClick={onCancel}>Annuler</button><button type="submit" className="primary-button" disabled={saving || checking}>{saving ? "Enregistrement…" : "Enregistrer"}</button></div></form>;
}
