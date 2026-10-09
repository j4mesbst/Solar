import { useEffect, useRef, useState } from "react";
import { Sun, Moon, Monitor, Database, Heart, SlidersHorizontal, Globe, Brain, Image, Paperclip, Mic, ArrowLeft, ArrowDown, ArrowUp, Home, Blocks, WandSparkles, Bookmark, Pin, MoreHorizontal, Clock3, Check, ChevronDown, Copy, FilePlus2, KeyRound, PanelLeft, Pencil, Plus, RefreshCw, Search, Settings2, Square, Trash2, X } from "lucide-react";
import type { AppSettings, Conversation, Effort, Message, Model, Provider } from "../domain/types";
import { solarStore } from "../services/store";
import { ChatError, streamChat } from "../services/chatApi";
import { providerApi, ProviderError, validateProviderInput } from "../services/providerApi";
import { secretVault } from "../services/nativeVault";
import { MarkdownMessage } from "../components/ui/markdown-message";
import { SearchPalette } from "../components/ui/search-palette";
import { PastedContents } from "../components/ui/pasted-content";
import { SelectionToolbar, SelectionResult } from "../components/ui/selection-actions";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDraft } from "../hooks/useDraft";
import { useModelPreparation } from "../hooks/useModelPreparation";
import { useTextActions } from "../hooks/useTextActions";
import { draftMessage, pastedContent, shouldCompactPaste } from "../services/pastedContent";
import { refreshOllama, reconcileModels } from "../services/ollama";
import { conversationTitle, exportConversations, saveExport } from "../services/conversationTools";
import { RailIcon } from "../components/ui/rail-icon";
import { resolveTheme, nextThemeBoundary } from "../services/theme";
import { AnimatedTextarea } from "../components/ui/animated-textarea";
import { AppearancePanel } from "../components/ui/appearance-panel";
import { appearanceStyle } from "../services/appearance";
import { fileAttachment } from "../services/fileAttachment";
import { generateLabel, modelLabel, shortModelName } from "../services/aiLabels";
import { ToolGroup } from "../components/ui/tool-group";

type SettingsSection = "providers" | "models" | "appearance" | "storage" | "preferences";
type FormState = { id?: string; name: string; baseUrl: string; protocol: Provider["protocol"]; secret: string };
const emptyForm: FormState = { name: "", baseUrl: "", protocol: "openai-compatible", secret: "" };
const now = () => new Date().toISOString();
const effortLabels: Record<Effort, string> = { low: "Faible", medium: "Moyen", high: "Élevé", ultra: "Ultra" };

export function App() {
  const [collapsed, setCollapsed] = useState(() => { try { return window.innerWidth < 800 || localStorage.getItem("solar.sidebar.collapsed") !== "false"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("solar.sidebar.collapsed", String(collapsed)); } catch { /* Navigation remains usable when preferences cannot be stored. */ } }, [collapsed]);
  const [view, setView] = useState<"chat" | "settings" | "plugins" | "skills" | "favorites">("chat");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const cancelRequest = useRef<((conversationId?: string) => void) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ theme: "dark", sendOnEnter: true });
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timeout); setResolvedTheme(resolveTheme(settings.theme)); if (settings.theme === "system") timeout = setTimeout(refresh, nextThemeBoundary()); };
    refresh(); const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    const clockCheck = settings.theme === "system" ? setInterval(refresh, 60_000) : undefined;
    return () => { clearTimeout(timeout); clearInterval(clockCheck); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [settings.theme]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | undefined>();
  const [chatBusy, setChatBusy] = useState(false);
  const [appError, setAppError] = useState("");
  const reload = async () => {
    const [p, m, c, s] = await Promise.all([solarStore.listProviders(), solarStore.listModels(), Promise.all([solarStore.listConversations(), solarStore.listTemporaryConversations()]).then(([a,b]) => [...b,...a]), solarStore.getSettings()]);
    setProviders(p); setModels(m); setConversations(c); conversationsRef.current = c; setSettings(s);
  };
  useEffect(() => {
    if (chatBusy) return;
    const target = models.find(m => m.enabled && m.available !== false && m.displayNameSource !== m.name && providers.some(p => p.id === m.providerId && p.enabled));
    if (!target) return;
    const provider = providers.find(p => p.id === target.providerId)!; const controller = new AbortController();
    const timer = setTimeout(() => { void (async () => {
      let label = shortModelName(target.name);
      try { label = await generateLabel(provider, target, secretVault, "model", target.name, controller.signal); } catch { if (controller.signal.aborted) return; }
      if (controller.signal.aborted) return;
      await solarStore.saveModelLabel(target.id, target.name, label); setModels(await solarStore.listModels());
    })().catch(() => {}); }, 2500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [models, providers, chatBusy]);
  const selectConversation = (id: string | null) => { setTargetMessageId(undefined); currentIdRef.current = id; setCurrentId(id); setSelectionRevision(value => value + 1); setMessages([]); setView("chat"); if (window.innerWidth < 800) setCollapsed(true); };
  const current = conversations.find(item => item.id === currentId) ?? null;
  const updateConversation = async (value: Conversation) => {
    await solarStore.saveConversation(value);
    const list = [...await solarStore.listTemporaryConversations(), ...await solarStore.listConversations()]; conversationsRef.current = list; setConversations(list);
  };
  const createConversation = async (temporary = false) => {
    const list = conversationsRef.current;
    const latest = list.find(item => item.id === currentIdRef.current && item.modelId) ?? list.find(item => item.modelId);
    const fallback = models.find(model => model.id === settings.defaultModelId && model.enabled);
    const conversation: Conversation = { id: `${temporary ? "temp:" : ""}${crypto.randomUUID()}`, temporary, title: "Nouveau chat", providerId: latest?.providerId ?? fallback?.providerId, modelId: latest?.modelId ?? fallback?.id, effort: latest?.effort ?? "medium", createdAt: now(), updatedAt: now() };
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
  }, [currentId, selectionRevision]);
  const updateMessages = (id: string, value: Message[]) => { if (currentIdRef.current === id) setMessages(value); };
  const updateSettings = async (next: AppSettings) => { await solarStore.saveSettings(next); setSettings(next); };
  const rename = async (conversation: Conversation) => {
    const title = window.prompt("Nom de la conversation", conversation.title)?.trim();
    if (title) await updateConversation({ ...conversation, title, titleManuallyEdited: true, updatedAt: now() });
  };
  const remove = async (conversation: Conversation) => {
    if (!conversation.temporary && !window.confirm(`Supprimer « ${conversation.title} » ?`)) return;
    cancelRequest.current?.(conversation.id); await solarStore.deleteConversation(conversation.id); await reload(); if (conversation.id === currentIdRef.current) selectConversation(conversationsRef.current[0]?.id ?? null);
  };
  const clearHistory = async () => {
    if (!window.confirm("Supprimer toutes les conversations enregistrées ? Les fournisseurs et les clés seront conservés.")) return;
    cancelRequest.current?.();
    for (const conversation of await solarStore.listConversations()) await solarStore.deleteConversation(conversation.id);
    await reload(); selectConversation(null);
  };
  return <><main className={`shell ${collapsed ? "collapsed" : ""} ${resolvedTheme === "light" ? "" : "dark"}`} data-theme={resolvedTheme} data-theme-mode={settings.theme} style={appearanceStyle(settings, resolvedTheme) as React.CSSProperties}>
    {!collapsed && <button className="sidebar-scrim" aria-label="Fermer la barre latérale" onClick={() => setCollapsed(true)}/>}
    <nav className="app-rail" aria-label="Navigation principale" {...(searchOpen ? { inert: "" } : {})}><RailButton className={`rail-button ${view === "chat" ? "active" : ""}`} aria-label="Accueil" title="Accueil" onClick={() => { setView("chat"); if (window.innerWidth < 800) setCollapsed(true); }}><Home size={20}/></RailButton><RailButton className={`rail-button ${view === "plugins" ? "active" : ""}`} aria-label="Plugins" title="Plugins" onClick={() => { setView("plugins"); if (window.innerWidth < 800) setCollapsed(true); }}><Blocks size={20}/></RailButton><RailButton className={`rail-button ${view === "skills" ? "active" : ""}`} aria-label="Skills" title="Skills" onClick={() => { setView("skills"); if (window.innerWidth < 800) setCollapsed(true); }}><WandSparkles size={20}/></RailButton><RailButton className={`rail-button rail-favorites ${view === "favorites" ? "active" : ""}`} aria-label="Favoris" title="Favoris" onClick={() => { setView("favorites"); if (window.innerWidth < 800) setCollapsed(true); }}><Heart size={20}/></RailButton><RailButton className={`rail-button rail-settings ${view === "settings" ? "active" : ""}`} aria-label="Paramètres" title="Paramètres" onClick={() => { setView("settings"); if (window.innerWidth < 800) setCollapsed(true); }}><Settings2 size={20}/></RailButton></nav>
    <aside className="sidebar" aria-label="Conversations" {...((collapsed || searchOpen) ? { inert: "" } : {})}>
      <div className="side-top"><span className="history-heading">Conversations</span><button className="icon-button" onClick={() => setCollapsed(true)} aria-label="Masquer la barre latérale"><PanelLeft size={19}/></button></div>
      <div className="new-chat-actions"><button className="new-thread" onClick={() => void createConversation()}><Plus size={17}/><span>Nouveau chat</span></button><details className="new-chat-menu"><summary aria-label="Options du nouveau chat"><ChevronDown size={14}/></summary><button onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); void createConversation(true); }}><Clock3 size={15}/>Chat temporaire</button></details></div>
      <button className="history-search" onClick={() => setSearchOpen(true)}><Search size={15}/>Rechercher<span>⌘ K</span></button>
      <nav aria-label="Historique">{(["temporary", "pinned", "recent"] as const).map(group => { const list = conversations.filter(c => group === "temporary" ? c.temporary : !c.temporary && Boolean(c.pinned) === (group === "pinned")); return list.length ? <div key={group}><p className="thread-label">{group === "temporary" ? "Cette session" : group === "pinned" ? "Épinglées" : "Récentes"}</p>{list.map(conversation => <div className={`thread-wrap ${conversation.id === currentId && view === "chat" ? "active" : ""}`} key={conversation.id} onContextMenu={event => { event.preventDefault(); const menu = event.currentTarget.querySelector("details"); if (menu) menu.open = true; }}><button className="thread" onClick={() => selectConversation(conversation.id)} aria-current={conversation.id === currentId && view === "chat" ? "page" : undefined}><span>{conversation.title}</span></button><details className="thread-menu" onToggle={event => { const menu = event.currentTarget; if (!menu.open) return; const bounds = menu.querySelector("summary")!.getBoundingClientRect(); const panel = menu.querySelector("div")!; panel.style.left = `${Math.max(8, Math.min(bounds.left - 170, window.innerWidth - 210))}px`; panel.style.top = `${Math.max(8, Math.min(bounds.bottom + 5, window.innerHeight - 150))}px`; }}><summary aria-label={`Actions pour ${conversation.title}`}><MoreHorizontal size={15}/></summary><div onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); }}><button onClick={() => void rename(conversation)}><Pencil size={14}/>Renommer</button>{!conversation.temporary && <button onClick={() => void updateConversation({ ...conversation, pinned: !conversation.pinned })}><Pin size={14}/>{conversation.pinned ? "Désépingler" : "Épingler"}</button>}<button onClick={() => void remove(conversation)}><Trash2 size={14}/>Supprimer</button></div></details><button className="thread-action" onClick={() => void remove(conversation)} aria-label={`Supprimer ${conversation.title}`}><Trash2 size={14}/></button></div>)}</div> : null; })}{!conversations.length && <p className="sidebar-empty">Un nouveau départ.<br/>Tes conversations apparaîtront ici.</p>}</nav>
    </aside>
    <section className="workspace" {...(searchOpen ? { inert: "" } : {})}><header className="header"><div className="header-start">{collapsed && <button className="icon-button" onClick={() => setCollapsed(false)} aria-label="Afficher la barre latérale"><PanelLeft size={18}/></button>}<span className="title wordmark">Solar</span>{view === "chat" && current?.temporary && <span className="temporary-badge">◌ Temporaire</span>}{view === "chat" && current?.temporary && <button className="icon-button" aria-label="Fermer le chat temporaire" onClick={() => void remove(current)}><X size={16}/></button>}</div></header>
      {appError && <p className="global-error" role="alert">{appError}</p>}
      <div className="chat-pane" hidden={view !== "chat"}><ChatView onRefreshConversations={async () => { const list = [...await solarStore.listTemporaryConversations(), ...await solarStore.listConversations()]; conversationsRef.current = list; setConversations(list); }} onBusy={setChatBusy} current={current} messages={messages} providers={providers} models={models} settings={settings} onCreated={() => createConversation()} onConversation={updateConversation} onMessages={updateMessages} onSettings={() => setView("settings")} cancelRequest={cancelRequest} targetMessageId={targetMessageId} onTargetShown={() => setTargetMessageId(undefined)} onRefreshModels={async () => { await refreshOllama(); await reload(); }}/></div>
      {view === "favorites" && <FavoritesView onOpen={(id, messageId) => { selectConversation(id); setTargetMessageId(messageId); }}/>}
      {(view === "plugins" || view === "skills") && <div className="coming-soon-page" key={view}><h1>{view === "plugins" ? "Plugins" : "Skills"}</h1><p>Arrive bientôt</p></div>}
      {view === "settings" && <SettingsView providers={providers} models={models} settings={settings} updateSettings={updateSettings} reload={reload} onBack={() => setView("chat")} clearHistory={clearHistory}/>}
    </section>
  </main>{searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} onOpen={(id, messageId) => { selectConversation(id); setTargetMessageId(messageId); }}/>}</>;
}

function ChatView({ onRefreshConversations, onBusy, current, messages, providers, models, settings, onCreated, onConversation, onMessages, onSettings, cancelRequest, targetMessageId, onTargetShown, onRefreshModels }: {
  onRefreshConversations: () => Promise<void>; onBusy: (busy: boolean) => void; current: Conversation | null; messages: Message[]; providers: Provider[]; models: Model[]; settings: AppSettings;
  onCreated: () => Promise<Conversation>; onConversation: (value: Conversation) => Promise<void>; onMessages: (id: string, value: Message[]) => void;
  targetMessageId?: string; onTargetShown: () => void; onRefreshModels: () => Promise<void>;
  onSettings: () => void; cancelRequest: React.MutableRefObject<((conversationId?: string) => void) | null>;
}) {
  const draftKey = current?.id ?? "new";
  const { draft: savedDraft, appendAttachments, update: updateDraft, clearSent, transfer, error: draftError, ready: draftReady } = useDraft(draftKey);
  const draft = savedDraft.text;
  const setDraft = (text: string) => updateDraft({ text });
  const [error, setError] = useState(""); const [importBusy, setImportBusy] = useState(false); const [dragOver, setDragOver] = useState(false); const importLock = useRef(false); const dragDepth = useRef(0);
  const [activeRequest, setActiveRequest] = useState<{ conversationId: string; started: number } | null>(null);
  const requestRef = useRef<{ controller: AbortController; conversationId: string } | null>(null);
  const locked = useRef(false); const currentRef = useRef(current); currentRef.current = current;
  const [elapsed, setElapsed] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null); const textarea = useRef<HTMLTextAreaElement>(null); const scroll = useRef<HTMLDivElement>(null); const follow = useRef(true); const [following, setFollowing] = useState(true); const lastScroll = useRef(0);
  const selectedModel = models.find(model => model.id === (current?.modelId ?? settings.defaultModelId));
  const provider = providers.find(item => item.id === selectedModel?.providerId);
  const [actionBusy, setActionBusy] = useState(false);
  const preparation = useModelPreparation(provider, selectedModel, Boolean(activeRequest) || actionBusy);
  const actions = useTextActions(current?.id, provider, selectedModel, current?.effort ?? "medium", Boolean(activeRequest) || locked.current, preparation.cancel);
  useEffect(() => { setActionBusy(actions.busy); }, [actions.busy]);
  const [highlighted, setHighlighted] = useState<string>();
  useEffect(() => { if (!targetMessageId || !messages.some(message => message.id === targetMessageId)) return; const element = document.getElementById(`message-${targetMessageId}`); element?.scrollIntoView({ block: "center" }); follow.current = false; setFollowing(false); setHighlighted(targetMessageId); onTargetShown(); }, [targetMessageId, messages]);
  useEffect(() => { if (!highlighted) return; const timer = setTimeout(() => setHighlighted(undefined), 1800); return () => clearTimeout(timer); }, [highlighted]);
  useEffect(() => { onBusy(Boolean(activeRequest)); }, [activeRequest]);
  const activeHere = Boolean(activeRequest && activeRequest.conversationId === current?.id);
  useEffect(() => { cancelRequest.current = id => { if (!id || requestRef.current?.conversationId === id) requestRef.current?.controller.abort(); }; return () => { requestRef.current?.controller.abort(); cancelRequest.current = null; }; }, []);
  useEffect(() => { if (!activeRequest) return; const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - activeRequest.started) / 1000)), 1000); return () => clearInterval(timer); }, [activeRequest]);
  useEffect(() => { setError(""); follow.current = true; setFollowing(true); lastScroll.current = 0; }, [current?.id]);
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
    const snapshot = structuredClone(savedDraft); const content = draftMessage(snapshot); if (importLock.current || !content.trim() || locked.current || actions.busyRef.current) return;
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
      latest = { id: crypto.randomUUID(), conversationId: active.id, role: "assistant", content: "", status: "streaming", createdAt: now(), order: rawHistory.length + 1, modelName: model.name, effort, activity: "connecting", activities: ["Message préparé pour le fournisseur"] };
      history = [...rawHistory, user]; requestRef.current.conversationId = active.id;
      const updated = { ...(currentRef.current?.id === active.id ? currentRef.current : active), title: !active.titleManuallyEdited && ["New conversation", "Nouveau chat"].includes(active.title) ? conversationTitle(snapshot.text, snapshot.attachments.length) : active.title, titleManuallyEdited: active.titleManuallyEdited, updatedAt: now() };
      await onConversation(updated);
      follow.current = true; setFollowing(true); setElapsed(0); setActiveRequest({ conversationId: active.id, started });
      await solarStore.saveMessage(user); await solarStore.saveMessage(latest); onMessages(active.id, [...history, latest]);
      try { await clearSent(draftKey, snapshot); } catch { setError("Le message est envoyé, mais le brouillon n’a pas pu être effacé."); }
      let lastSaved = 0; let lastRendered = 0;
      await streamChat({ provider: activeProvider, model: model.providerModelId ?? model.id, messages: history, effort, vault: secretVault, signal: controller.signal, onActivity: activity => {
        const labels = { connecting: "Connexion au fournisseur", waiting: "Demande acceptée · attente du modèle", thinking: "Phase de réflexion signalée par le modèle", writing: "Réception de la réponse" };
        const label = activity ? labels[activity] : ""; latest = { ...latest!, activity, activities: [...new Set([...(latest!.activities ?? []), label].filter(Boolean))] }; onMessages(active!.id, [...history, latest]);
      }, onDelta: delta => {
        latest = { ...latest!, content: latest!.content + delta }; if (Date.now() - lastRendered > 100) { lastRendered = Date.now(); onMessages(active!.id, [...history, latest]); }
        if (Date.now() - lastSaved > 250) { lastSaved = Date.now(); void solarStore.saveMessage(latest).catch(() => setError("La réponse s’affiche, mais son enregistrement a échoué.")); }
      } });
      latest = { ...latest, status: "completed", durationSeconds: Math.round((Date.now() - started) / 1000) };
      await solarStore.saveMessage(latest); onMessages(active.id, [...history, latest]);
      if (rawHistory.length === 0 && !active.titleManuallyEdited && !active.titleGenerated) {
        const id = active.id; const text = snapshot.text || snapshot.attachments.map(a => a.title).join(", ");
        void generateLabel(activeProvider, model, secretVault, "title", text).then(async title => { await solarStore.saveAutomaticTitle(id, title); await onRefreshConversations(); }).catch(() => {});
      }
    } catch (reason) {
      const normalized = reason instanceof ChatError ? reason : new ChatError("Impossible de terminer la réponse ou de l’enregistrer. Réessaie après avoir vérifié le stockage.", "provider");
      if (latest && active) {
        latest = { ...latest, status: normalized.code === "interrupted" ? "interrupted" : "error", durationSeconds: Math.round((Date.now() - started) / 1000), error: normalized.code === "interrupted" ? undefined : normalized.message };
        try { await solarStore.saveMessage(latest); } catch { /* Display the error even if persistence fails. */ }
        onMessages(active.id, [...history, latest]);
      } else setError(normalized.message);
    } finally { requestRef.current = null; locked.current = false; setActiveRequest(null); }
  };
  const attachFiles = async (files: FileList | File[] | null) => {
    if (!files?.length || importLock.current) return;
    importLock.current = true; setImportBusy(true);
    try {
      const items = await Promise.all([...files].map(fileAttachment));
      appendAttachments(items); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de lire ce fichier."); }
    finally { importLock.current = false; setImportBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  return <><div className="chat-toolbar"><ChatOptions onNew={() => void onCreated()} onSettings={onSettings}/></div><div ref={scroll} className={`chat-scroll ${messages.length ? "has-messages" : ""}`} onWheel={event => { if (event.deltaY < 0) { follow.current = false; setFollowing(false); } }} onTouchMove={() => { follow.current = false; setFollowing(false); }} onKeyDown={event => { if (["PageUp", "Home", "ArrowUp"].includes(event.key)) { follow.current = false; setFollowing(false); } }} onScroll={() => { const el = scroll.current; if (!el) return; if (el.scrollTop < lastScroll.current - 2) { follow.current = false; setFollowing(false); } else if (el.scrollTop > lastScroll.current && el.scrollHeight - el.scrollTop - el.clientHeight < 12) { follow.current = true; setFollowing(true); } lastScroll.current = el.scrollTop; }}>
    {!messages.length ? <div className="canvas"><div className="welcome"><h1>Local AI.</h1><p>Un espace calme pour tes idées.</p>{!selectedModel && <button className="inline-link" onClick={onSettings}>Connecter un modèle <ArrowUp size={14}/></button>}</div></div> : <div className="message-list">{messages.filter(message => message.role !== "system").map(message => <article id={`message-${message.id}`} data-message-id={message.id} className={`message ${message.role} ${highlighted === message.id ? "highlighted" : ""}`} key={message.id}>
      {message.role === "user" ? <><div className="user-bubble">{message.displayText ?? message.content}</div>{message.attachments && <PastedContents items={message.attachments}/>}</> : <><ToolGroup defaultOpen={false} state={message.status === "streaming" ? "pending" : message.status === "completed" ? "completed" : "interrupted"} completeLabel="Réponse terminée" shimmerLabel={message.activity === "thinking" ? "Réflexion en cours" : message.activity === "writing" || message.content ? "Rédaction de la réponse" : message.activity === "waiting" ? "En attente du modèle" : "Connexion au modèle"} interruptedLabel={message.status === "error" ? "Réponse non terminée" : "Réponse interrompue"} elapsedTime={`${message.status === "streaming" && activeHere ? elapsed : message.durationSeconds ?? 0} s`} nestedTools={(message.activities ?? ["Message préparé pour le fournisseur"]).map(title => ({ category: "generic" as const, title })).concat(message.status === "completed" ? [{ category: "generic" as const, title: "Réponse reçue et enregistrée" }] : [])} className="generation-status"/>

      <div className={`message-content response-body ${message.status === "completed" ? "response-completed" : ""}`}><MarkdownMessage content={message.content}/></div>
      {message.status === "completed" && message.content && <div className="response-actions"><CopyMessage content={message.content}/>{!current?.temporary && <button className={`copy-message ${message.favorite ? "saved" : ""}`} aria-label={message.favorite ? "Retirer des réponses enregistrées" : "Enregistrer la réponse"} onClick={async () => { const next = { ...message, favorite: !message.favorite }; await solarStore.saveMessage(next); onMessages(message.conversationId, messages.map(item => item.id === message.id ? next : item)); }}><Bookmark size={14} fill={message.favorite ? "currentColor" : "none"}/><span>{message.favorite ? "Enregistré" : "Enregistrer"}</span></button>}</div>}</>}
      {actions.result?.messageId === message.id && <SelectionResult result={actions.result} busy={actions.busy} onStop={actions.cancel} onClose={actions.close} onInsert={text => { setDraft(draft ? `${draft}\n\n${text}` : text); textarea.current?.focus(); }}/>}
      {message.error && <p className="message-error" role="alert">{message.error}</p>}
    </article>)}</div>}
  </div>{actions.selection && <SelectionToolbar selection={actions.selection} disabled={Boolean(activeRequest) || actions.busy} onAction={action => void actions.run(action)}/>}<div className="composer-wrap">{draftError && <p className="composer-error" role="alert">{draftError}</p>}{error && <p className="composer-error" role="alert">{error}</p>}<div className={`composer ${dragOver ? "drag-over" : ""}`} onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); dragDepth.current++; setDragOver(true); } }} onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragOver(false); }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragOver(false); void attachFiles(event.dataTransfer.files); }}>{dragOver && <div className="file-drop-hint"><Paperclip size={28}/><strong>Dépose tes fichiers ici</strong><span>Relâche pour les joindre au message</span></div>}{savedDraft.attachments.length > 0 && <PastedContents items={savedDraft.attachments} onRemove={id => updateDraft({ attachments: savedDraft.attachments.filter(item => item.id !== id) })} onExpand={id => { const item = savedDraft.attachments.find(item => item.id === id); if (item) updateDraft({ text: draft ? `${draft}\n\n${item.content}` : item.content, attachments: savedDraft.attachments.filter(item => item.id !== id) }); }}/>}<input className="sr-only" ref={fileInput} type="file" multiple aria-label="Joindre un fichier" accept="image/png,image/jpeg,image/webp,.pdf,.docx,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.log,.yaml,.yml,.xml,.sh,.rs,.sql" onChange={event => void attachFiles(event.target.files)}/><div className="composer-input-row"><AnimatedTextarea ref={textarea} readOnly={!draftReady} aria-busy={!draftReady} aria-label="Message à Solar" value={draft} onChange={event => setDraft(event.target.value)} onPaste={event => { const images = [...event.clipboardData.files].filter(file => file.type.startsWith("image/")); if (images.length) { event.preventDefault(); void attachFiles(images); return; } const content = event.clipboardData.getData("text/plain"); if (shouldCompactPaste(content)) { event.preventDefault(); updateDraft({ attachments: [...savedDraft.attachments, pastedContent(content)] }); } }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && settings.sendOnEnter !== false) { event.preventDefault(); void send(); } }} placeholder={activeRequest ? "Prépare ton prochain message…" : "Pose ta question à Solar…"} rows={1}/></div>
    <div className="composer-inline-actions"><button className="composer-icon add-context" type="button" aria-label="Ajouter un fichier" title="Joindre un fichier" disabled={importBusy} onClick={() => fileInput.current?.click()}><Paperclip size={20}/></button><div className="composer-runtime-controls"><ModelSelector models={models} providers={providers} selected={selectedModel} onSelect={id => void changeSelection(id)} onSettings={onSettings} onRefresh={onRefreshModels} preparation={preparation.state}/><EffortSelector modelName={selectedModel ? modelLabel(selectedModel) : "Choisir un modèle"} value={current?.effort ?? "medium"} onSelect={value => void changeSelection(undefined, value)}/>{activeRequest ? <button className="stop" type="button" onClick={() => requestRef.current?.controller.abort()} aria-label="Arrêter la génération"><Square size={14} fill="currentColor"/></button> : <button className="send" type="button" onClick={() => void send()} disabled={importBusy || (!draft.trim() && !savedDraft.attachments.length) || !selectedModel || selectedModel.available === false || !provider?.enabled || actions.busy} aria-label="Envoyer le message"><ArrowUp size={21}/></button>}</div></div>
    {importBusy && <p className="composer-note" role="status">Préparation du fichier…</p>}
    {selectedModel?.available === false && <p className="composer-note">Ce modèle n’est plus disponible. Actualise Ollama ou choisis un autre modèle.</p>}
  </div>{!following && messages.length > 0 && <button className="jump-latest" onClick={() => { follow.current = true; setFollowing(true); scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }); }} aria-label="Revenir en bas"><ArrowDown size={16}/></button>}{current?.temporary && <p className="temporary-note">Temporaire · rien dans l’historique local. Le fournisseur conserve ses propres règles de données.</p>}<p className="hint">{activeRequest ? "Tu peux écrire et changer les réglages du prochain message." : settings.sendOnEnter === false ? "Utilise le bouton pour envoyer ton message." : "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne"}</p></div></>;
}

function CopyMessage({ content }: { content: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return <button className="copy-message" onClick={async () => { try { await navigator.clipboard.writeText(content); setState("copied"); } catch { setState("error"); } }} aria-label="Copier la réponse">{state === "copied" ? <Check size={14}/> : <Copy size={14}/>}<span>{state === "copied" ? "Copié" : state === "error" ? "Copie indisponible" : "Copier"}</span></button>;
}

function ModelSelector({ models, providers, selected, onSelect, onSettings, onRefresh, preparation }: { models: Model[]; providers: Provider[]; selected?: Model; onSelect: (id: string) => void; onSettings: () => void; onRefresh: () => Promise<void>; preparation: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false); const presence = useAnimatedPresence(open); const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return; input.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }; document.addEventListener("keydown", escape); document.addEventListener("pointerdown", outside); return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const selectedProvider = providers.find(p => p.id === selected?.providerId);
  const local = selectedProvider?.protocol === "ollama";
  const status = !selected?.enabled || selected.available === false || !selectedProvider?.enabled || preparation === "Indisponible" ? "error" : preparation === "Chargement…" ? "preparing" : (local ? preparation === "Prêt" : selectedProvider.connectionState === "connected") ? "ready" : "error";
  const statusLabel = status === "preparing" ? "Préparation du modèle" : status === "ready" ? "Modèle prêt" : "Modèle déconnecté ou indisponible";
  const filtered = models.filter(model => model.enabled && model.available !== false && providers.some(p => p.id === model.providerId && p.enabled) && `${model.name} ${modelLabel(model)} ${providers.find(p => p.id === model.providerId)?.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="control-popover" ref={root} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}><button ref={trigger} className="model-control" aria-label={selected ? modelLabel(selected) : "Choisir un modèle"} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); setOpen(!open); }}><span title={selected?.name}>{selected ? modelLabel(selected) : "Choisir un modèle"}</span><span className={`model-ready-dot ${status}`} role="img" aria-label={statusLabel} title={statusLabel}/><ChevronDown size={13}/></button>
    {presence.mounted && <div className={`model-popover ${presence.closing ? "popover-closing" : ""}`} {...(presence.closing ? { inert: "" } : {})} aria-hidden={presence.closing || undefined} role="dialog" aria-label="Choisir un modèle"><label className="model-search"><Search size={15}/><input ref={input} aria-label="Rechercher un modèle" placeholder="Rechercher un modèle…" value={query} onChange={event => setQuery(event.target.value)}/></label><div className="model-results">{providers.filter(p => p.enabled).map(provider => { const group = filtered.filter(model => model.providerId === provider.id); return group.length ? <div className="model-group" key={provider.id}><p>{provider.name}<span>{provider.protocol === "ollama" ? "Local" : "API"}</span></p>{group.map(model => <button key={model.id} className={`model-option ${selected?.id === model.id ? "selected" : ""}`} onClick={() => { onSelect(model.id); setOpen(false); trigger.current?.focus(); }}><span title={model.name}>{modelLabel(model)}</span>{selected?.id === model.id && <Check size={14}/>}</button>)}</div> : null; })}{!filtered.length && <p className="popover-empty">{models.length ? "Aucun modèle correspondant." : "Ajoute un fournisseur pour choisir un modèle."}</p>}</div><button className="popover-footer" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}>{refreshing ? "Détection…" : "Actualiser Ollama"}<RefreshCw size={14}/></button><button className="popover-footer" onClick={() => { setOpen(false); onSettings(); }}>Gérer les modèles <Settings2 size={14}/></button></div>}
  </div>;
}
function RailButton({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [revision, setRevision] = useState(0); const [hover, setHover] = useState(false); const symbol = useRef<HTMLSpanElement>(null); const press = useRef<Animation>();
  useEffect(() => () => press.current?.cancel(), []);
  return <button {...props} onPointerEnter={e => { setHover(true); setRevision(v => v+1); props.onPointerEnter?.(e); }} onPointerLeave={e => { setHover(false); props.onPointerLeave?.(e); }} onFocus={e => { if(e.currentTarget.matches(":focus-visible")){setHover(true);setRevision(v=>v+1);} props.onFocus?.(e); }} onBlur={e => { setHover(false); props.onBlur?.(e); }} onClick={event => { setHover(false); press.current?.cancel(); if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) press.current=symbol.current?.animate([{transform:"scale(1)"},{transform:"scale(.78)",offset:.23},{transform:"scale(1.16)",offset:.6},{transform:"scale(.98)",offset:.83},{transform:"scale(1)"}],{duration:380,easing:"cubic-bezier(.22,1,.36,1)"}); onClick?.(event); }}><span ref={symbol} className="rail-symbol"><span key={revision} className={hover ? "rail-symbol-animate" : ""}><RailIcon name={props["aria-label"]}/></span></span></button>;
}
function ChatOptions({ onNew, onSettings }: { onNew: () => void; onSettings: () => void }) {
  const [open, setOpen] = useState(false); const presence = useAnimatedPresence(open); const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) return; const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }; document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); }; }, [open]);
  return <div className="chat-options" ref={root}><button className="toolbar-icon" ref={trigger} aria-label="Plus d’options" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}><MoreHorizontal size={21}/></button>{presence.mounted && <div className={`chat-options-menu ${presence.closing ? "popover-closing" : ""}`} {...(presence.closing ? { inert: "" } : {})} aria-hidden={presence.closing || undefined} role="dialog" aria-label="Options de la conversation"><button onClick={() => { setOpen(false); onNew(); }}><Plus size={16}/>Nouveau chat</button><button onClick={() => { setOpen(false); onSettings(); }}><Settings2 size={16}/>Paramètres</button></div>}</div>;
}
function EffortSelector({ modelName, value, onSelect }: { modelName: string; value: Effort; onSelect: (value: Effort) => void }) {
  const [open, setOpen] = useState(false); const presence = useAnimatedPresence(open); const levels = Object.keys(effortLabels) as Effort[]; const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const slider = useRef<HTMLInputElement>(null);
  const dragging = useRef(false); const [preview, setPreview] = useState(levels.indexOf(value)); const valueRef = useRef(value); valueRef.current = value;
  const commit = (index: number) => { if (levels[index] !== valueRef.current) { valueRef.current = levels[index]; onSelect(levels[index]); } };
  useEffect(() => { if (!open) setPreview(levels.indexOf(value)); }, [value, open]);
  useEffect(() => { if (!open) return; slider.current?.focus(); const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }; document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); }; }, [open]);
  return <div ref={root} className={`effort-picker ${value === "ultra" ? "ultra" : ""}`}><button ref={trigger} className="effort-trigger toolbar-icon" aria-label="Niveau d’effort" title={`Effort : ${effortLabels[value]}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => { setPreview(levels.indexOf(value)); setOpen(!open); }}><span className="effort-mini-gauge" aria-hidden="true">{[0,1,2,3].map(i => <i key={i} className={i <= Object.keys(effortLabels).indexOf(value) ? "filled" : ""}/>)}</span><span className="effort-visible-label">{effortLabels[value]}</span></button>{presence.mounted && <div data-level={preview} className={`effort-popover horizontal-effort ${preview === 3 ? "ultra" : ""} ${presence.closing ? "popover-closing" : ""}`} {...(presence.closing ? { inert: "" } : {})} aria-hidden={presence.closing || undefined} role="dialog" aria-label="Choisir le niveau d’effort"><div className="effort-heading"><strong key={preview}>{effortLabels[levels[preview]]}</strong><button className="effort-reset" title="Revenir à Moyen" aria-label="Réinitialiser l’effort" onClick={() => { setPreview(1); commit(1); }}><RefreshCw size={18}/></button><span>{modelName}</span></div><div className="effort-range"><div key={preview} className="effort-particles" aria-hidden="true">{Array.from({length:9}, (_,i)=><i key={i} style={{"--delay":`${i * -0.28}s`, "--particle-x":`${8 + i*10}%`, "--particle-y":`${22+(i%3)*24}%`} as React.CSSProperties}/>)}</div><div className="effort-track" aria-hidden="true"><span style={{ width: `${preview / 3 * 100}%` }}/>{levels.map((level, i) => <i key={level} style={{ left: `${i / 3 * 100}%` }} className={i <= preview ? "filled" : ""}/>)}</div><input ref={slider} type="range" min="0" max="3" step="1" value={preview} style={{"--power":`${preview/3*100}%`} as React.CSSProperties} aria-label="Puissance de réponse" aria-valuetext={effortLabels[levels[preview]]} onChange={event => { const index = Number(event.target.value); setPreview(index); if (!dragging.current) commit(index); }} onPointerDown={() => { dragging.current = true; }} onPointerUp={event => { dragging.current = false; commit(Number(event.currentTarget.value)); }} onPointerCancel={() => { dragging.current = false; commit(preview); }} onBlur={() => { dragging.current = false; commit(preview); }}/></div><div className="effort-levels">{levels.map((level, i) => <button key={level} className={preview === i ? "selected" : ""} onClick={() => { setPreview(i); commit(i); }}>{effortLabels[level]}</button>)}</div><p className="effort-summary">{["Court et rapide", "Complet et équilibré", "Analyse approfondie", "Budget de réponse maximal"][preview]}</p><small className="effort-disclosure">Profil de consigne et budget de sortie.</small></div>}</div>;
}

function FavoritesView({ onOpen }: { onOpen: (id: string, messageId: string) => void }) {
  const [items, setItems] = useState<{ conversation: Conversation; message: Message }[]>([]);
  useEffect(() => { void solarStore.listConversations().then(async conversations => { const groups = await Promise.all(conversations.map(async conversation => (await solarStore.listMessages(conversation.id)).filter(message => message.favorite).map(message => ({ conversation, message })))); setItems(groups.flat()); }); }, []);
  return <div className="settings-page"><h1>Réponses enregistrées</h1>{!items.length && <p className="settings-note">Enregistre une réponse depuis le chat pour la retrouver ici.</p>}{items.map(({ conversation, message }) => <div className="favorite-row" key={message.id}><button onClick={() => onOpen(conversation.id, message.id)}><strong>{conversation.title}</strong><span>{message.content.slice(0, 200)}</span></button><button className="icon-button" aria-label="Retirer la réponse enregistrée" onClick={async () => { await solarStore.saveMessage({ ...message, favorite: false }); setItems(items.filter(item => item.message.id !== message.id)); }}><X size={15}/></button></div>)}</div>;
}
function ExportPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [chosen, setChosen] = useState("all"); const [format, setFormat] = useState<"md" | "txt">("md"); const [notice, setNotice] = useState("");
  useEffect(() => { void solarStore.listConversations().then(setConversations); }, []);
  return <div className="export-panel"><h3>Exporter les conversations</h3><p>Messages et noms des modèles uniquement. Les chats temporaires et les clés sont exclus.</p><div><select aria-label="Conversation à exporter" value={chosen} onChange={event => setChosen(event.target.value)}><option value="all">Toutes les conversations</option>{conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><select aria-label="Format d’export" value={format} onChange={event => setFormat(event.target.value as "md" | "txt")}><option value="md">Markdown</option><option value="txt">Texte brut</option></select><button className="small-button" disabled={!conversations.length} onClick={async () => { try { const entries = await Promise.all(conversations.filter(c => chosen === "all" || c.id === chosen).map(async conversation => ({ conversation, messages: await solarStore.listMessages(conversation.id) }))); const saved = await saveExport(exportConversations(entries, format), format); setNotice(saved ? "Export préparé." : "Export annulé."); } catch { setNotice("L’export a échoué. Réessaie ou vérifie les droits du dossier choisi."); } }}>Exporter</button></div>{notice && <p role="status">{notice}</p>}</div>;
}

function SettingsView({ providers, models, settings, updateSettings, reload, onBack, clearHistory }: { providers: Provider[]; models: Model[]; settings: AppSettings; updateSettings: (next: AppSettings) => Promise<void>; reload: () => Promise<void>; onBack: () => void; clearHistory: () => Promise<void> }) {
  const [query, setQuery] = useState(""); const [section, setSection] = useState<SettingsSection>("providers"); const [editing, setEditing] = useState<FormState | null>(null); const [error, setError] = useState("");
  const sections: [SettingsSection, string][] = [["providers", "Fournisseurs"], ["models", "Modèles"], ["appearance", "Apparence"], ["storage", "Stockage"], ["preferences", "Préférences"]];
  const saveSettings = async (next: AppSettings) => { try { await updateSettings(next); setError(""); } catch { setError("Impossible d’enregistrer les préférences. Vérifie le stockage disponible."); } };
  const sectionIcons = { providers: KeyRound, models: Blocks, appearance: Sun, storage: Database, preferences: Settings2 };
  return <div className="settings-page settings-expanded"><div className="settings-layout"><aside className="settings-menu"><div className="settings-menu-head"><h1>Paramètres</h1><button className="back-button" onClick={onBack} title="Retour au chat"><ArrowLeft size={15}/> Retour au chat</button></div><label className="settings-search"><Search size={18}/><input aria-label="Rechercher dans les paramètres" placeholder="Rechercher" value={query} onChange={event => setQuery(event.target.value)}/></label><p className="settings-category">Personnel</p><nav className="settings-nav" aria-label="Sections des paramètres">{sections.filter(([, name]) => name.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(([id, name]) => { const Icon = sectionIcons[id]; return <button key={id} className={section === id ? "selected" : ""} aria-current={section === id ? "page" : undefined} onClick={() => { setSection(id); setEditing(null); }}><Icon size={20}/><span>{name}</span></button>; })}</nav>{query && !sections.some(([, name]) => name.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))) && <p className="settings-note">Aucun résultat.</p>}</aside><div className="settings-content" key={section}>

    {section === "providers" && <><div className="section-title"><div><h2>Fournisseurs</h2><p>Connecte un modèle local ou une API compatible.</p></div>{!editing && <button className="small-button" onClick={() => setEditing({ ...emptyForm })}><Plus size={15}/> Ajouter</button>}</div>{editing ? <ProviderForm key={editing.id ?? "new"} initial={editing} onDone={async () => { await reload(); setEditing(null); }} onCancel={() => setEditing(null)}/> : <ProviderList providers={providers} models={models} setEditing={setEditing} reload={reload}/>}</>}
    {section === "appearance" && <AppearancePanel settings={settings} onSave={saveSettings}/>}

    {section === "models" && <><div className="section-title"><div><h2>Modèles</h2><p>Seuls les modèles ajoutés ou détectés apparaissent dans le chat.</p></div></div>{models.length ? providers.map(provider => { const list = models.filter(model => model.providerId === provider.id); return list.length ? <div className="settings-model-group" key={provider.id}><h3>{provider.name}</h3>{list.map(model => <div className="settings-model-row" key={model.id}><div><strong title={model.name}>{modelLabel(model)}</strong><p>{model.available === false ? "Modèle supprimé ou indisponible" : model.source === "manual" ? "Ajouté manuellement" : "Détecté auprès du fournisseur"}</p></div><label className="toggle-label"><input type="checkbox" checked={model.enabled} onChange={async event => { await solarStore.saveModel({ ...model, enabled: event.target.checked }); await reload(); }}/><span>Disponible</span></label><button className="icon-button" aria-label={`Supprimer le modèle ${model.name}`} onClick={async () => { await solarStore.deleteModel(model.id); await reload(); }}><Trash2 size={15}/></button></div>)}</div> : null; }) : <div className="empty-card"><h3>Aucun modèle pour le moment</h3><p>Ajoute un fournisseur puis actualise sa liste de modèles.</p><button className="small-button" onClick={() => setSection("providers")}>Configurer un fournisseur</button></div>}<p className="settings-note">Solar est le nom de l’application. Le modèle Solar adaptatif n’est pas encore disponible.</p></>}
    {section === "storage" && <><ExportPanel/><div className="section-title"><div><h2>Stockage</h2><p>Garde le contrôle sur ce que Solar conserve.</p></div></div><div className="preference-row"><div><h3>Conversations</h3><p>Enregistrées localement avec leurs messages et brouillons, puis restaurées à la réouverture de Solar.</p></div><button className="small-button" onClick={() => void clearHistory()}>Effacer</button></div><div className="preference-row"><div><h3>Fournisseurs et clés</h3><p>Conservés sur ce navigateur et à cette adresse. L’application macOS utilise le Trousseau pour les clés ; l’aperçu web utilise le stockage du navigateur.</p></div></div></>}
    {section === "preferences" && <><div className="section-title"><div><h2>Préférences</h2><p>Les petits détails qui rendent le chat plus naturel.</p></div></div><div className="preference-row"><div><h3>Envoyer avec Entrée</h3><p>Maj + Entrée ajoute toujours une nouvelle ligne.</p></div><input aria-label="Envoyer avec Entrée" type="checkbox" checked={settings.sendOnEnter !== false} onChange={event => void saveSettings({ ...settings, sendOnEnter: event.target.checked })}/></div><div className="preference-row"><div><h3>Modèle par défaut</h3><p>Pour la première conversation. Les suivantes reprennent ton dernier choix.</p></div><select aria-label="Modèle par défaut" value={settings.defaultModelId ?? ""} onChange={event => void saveSettings({ ...settings, defaultModelId: event.target.value || undefined })}><option value="">Choisir dans le chat</option>{models.filter(m => m.enabled).map(model => <option key={model.id} value={model.id}>{modelLabel(model)}</option>)}</select></div><div className="preference-row"><div><h3>Niveaux d’effort</h3><p>Bas : réponse courte. Moyen : réponse complète. Élevé et Ultra : réponse plus approfondie avec un budget plus grand. Ces profils ne déclenchent pas de recherche Internet ; les capacités de raisonnement natif ne sont pas déclarées par les fournisseurs.</p></div></div></>}
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
