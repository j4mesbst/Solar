import { responseGuidance } from "../services/builtinSkills";
import { AnimatedTextarea } from "../components/ui/animated-textarea";
import { ComposerTools } from "../components/ui/composer-tools";
import { SolarModeMenu } from "../components/ui/solar-mode-menu";
import { useSolarScene } from "../hooks/useSolarScene";
import { ComposerStatus, type ComposerPhase } from "../components/ui/composer-status";
import { AccountDialog } from "../components/ui/account-dialog";
import { authClient } from "../services/auth";
import { ArtifactCard } from "../components/ui/artifact-card";
import { personalSkillInstruction } from "../services/personalExtensions";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ExtensionDirectory } from "../components/ui/extension-directory";
import { SolarModelCatalog } from "../components/ui/solar-model-catalog";
import AnimatedShinyText from "../components/ui/animated-text-01";
import { WebSettingsPanel, PerformancePanel } from "../components/ui/advanced-settings";
import { Onboarding } from "../components/ui/onboarding";
import { WorkSurface, WorkShelf, type WorkBridge } from "../components/ui/work-surface";
import { ArtifactPanel } from "../components/ui/artifact-panel";
import { EffortSlider } from "../components/ui/effort-slider";
import type { Artifact } from "../domain/extensions";
import { extensionStore } from "../services/extensionStore";
import { artifactIntent, smartInstruction } from "../services/solarSmart";
import { searchWeb, needsWeb, sourceContext, effectiveWebSettings } from "../services/solarWeb";
import { artifactInstruction, parseRequestedArtifact, displayAnswer } from "../services/artifacts";
import { runPipeline, type PipelineRunner, type PipelineStage } from "../lib/pipeline";
import { SolarAgentRuntime, modelProfile, recordAgentDiagnostic } from "../lib/agent";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { UserRound, Sun, Moon, Monitor, Database, Heart, SlidersHorizontal, Globe, Brain, Image, Paperclip, Mic, ArrowLeft, ArrowUp, Home, Blocks, WandSparkles, Bookmark, Pin, MoreHorizontal, Clock3, Check, ChevronDown, Copy, FilePlus2, KeyRound, PanelLeft, Pencil, Plus, RefreshCw, Search, Settings2, Square, Trash2, X } from "lucide-react";
import type { AppSettings, Conversation, Effort, Message, Model, Provider } from "../domain/types";
import { solarStore } from "../services/store";
import { ChatError, streamChat } from "../services/chatApi";
import { providerApi, ProviderError, validateProviderInput } from "../services/providerApi";
import { secretVault } from "../services/nativeVault";
import { AiMessage, MarkdownMessage } from "../components/ui/markdown-message";
import { SearchPalette } from "../components/ui/search-palette";
import { PastedContents } from "../components/ui/pasted-content";
import { SelectionToolbar, SelectionResult } from "../components/ui/selection-actions";
import { useAnimatedPresence } from "../hooks/useAnimatedPresence";
import { useDraft } from "../hooks/useDraft";
import { useModelPreparation } from "../hooks/useModelPreparation";
import { useTextActions } from "../hooks/useTextActions";
import { draftMessage, pastedContent, shouldCompactPaste } from "../services/pastedContent";
import { refreshOllama, reconcileModels } from "../services/ollama";
import { inspectOllama, startOllama } from "../services/ollamaNative";
import { pullModel, type PullProgress } from "../services/modelInstall";
import type { OllamaStatus } from "../services/ollamaNative";
import { conversationTitle, exportConversations, saveExport } from "../services/conversationTools";
import { SidebarIcon, type SidebarIconName } from "../components/ui/sidebar-icon";
import { resolveTheme, nextThemeBoundary } from "../services/theme";
import { AppearancePanel } from "../components/ui/appearance-panel";
import { appearanceStyle } from "../services/appearance";
import { fileAttachment } from "../services/fileAttachment";
import { generateLabel, modelLabel, shortModelName } from "../services/aiLabels";
import { ToolGroup } from "../components/ui/tool-group";
import { detectHardware } from "../services/performance";
import { budgetConversation, chooseSolarCodeStrategy } from "../services/solarCodeStrategy";
import { buildIntentQuestions, intentInstruction, summarizeIntent, type IntentQuestion, type IntentResolution } from "../services/intentClarification";
import { IntentClarification } from "../components/ui/intent-clarification";

type SettingsSection = "appearance" | "providers" | "account" | "models" | "storage" | "preferences" | "web" | "performance";
type FormState = { id?: string; name: string; baseUrl: string; protocol: Provider["protocol"]; secret: string };
const emptyForm: FormState = { name: "", baseUrl: "", protocol: "openai-compatible", secret: "" };
const now = () => new Date().toISOString();
const effortLabels: Record<Effort, string> = { low: "Faible", medium: "Moyen", high: "Élevé", ultra: "Ultra" };

export function App() {
  const [newOptions,setNewOptions]=useState<Partial<Conversation>>({});const newOptionsRef=useRef(newOptions);newOptionsRef.current=newOptions;
  const [collapsed, setCollapsed] = useState(() => { try { return window.innerWidth < 800 || localStorage.getItem("solar.sidebar.collapsed") !== "false"; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem("solar.sidebar.collapsed", String(collapsed)); } catch { /* Navigation remains usable when preferences cannot be stored. */ } }, [collapsed]);
  const [view, setView] = useState<"chat" | "work" | "settings" | "plugins" | "skills" | "favorites">("chat");
  const [hubPluginTab, setHubPluginTab] = useState<"public"|"personal">("public");
  const [loaded,setLoaded]=useState(false);const firstLoad=useRef(true);const [showOnboarding,setShowOnboarding]=useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  const messageRevision = useRef(0);
  const liveMessages = useRef<{id:string;value:Message[]} | null>(null);
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
  const workBridge=useRef<WorkBridge|null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState<string | undefined>();
  const [chatBusy, setChatBusy] = useState(false);
  const [appError, setAppError] = useState("");
  useEffect(() => {
    if (!appError) return;
    const timeout = window.setTimeout(() => setAppError(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [appError]);
  const reload = async () => {
    const [p, m, c, s] = await Promise.all([solarStore.listProviders(), solarStore.listModels(), Promise.all([solarStore.listConversations(), solarStore.listTemporaryConversations()]).then(([a,b]) => [...b,...a]), solarStore.getSettings()]);
    if(firstLoad.current){firstLoad.current=false;setShowOnboarding(s.onboardingComplete!==true && (s.onboardingComplete===false||(!p.length&&!c.length)));}
    setProviders(p); setModels(m); setConversations(c); conversationsRef.current = c; setSettings(s); setLoaded(true);
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
  const selectConversation = (id: string | null) => { liveMessages.current=null;messageRevision.current++;setTargetMessageId(undefined); currentIdRef.current = id; setCurrentId(id); setSelectionRevision(value => value + 1); setMessages([]); setView(conversationsRef.current.find(c => c.id === id)?.space === "work" ? "work" : "chat"); if (window.innerWidth < 800) setCollapsed(true); };
  const current = conversations.find(item => item.id === currentId) ?? null;
  const updateConversation = async (value: Conversation) => {
    await solarStore.saveConversation(value);
    if(!currentIdRef.current){currentIdRef.current=value.id;setCurrentId(value.id);}
    const list = [...await solarStore.listTemporaryConversations(), ...await solarStore.listConversations()]; conversationsRef.current = list; setConversations(list);
  };
  const createConversation = async (temporary = false, space: "chat"|"work" = view === "work" ? "work" : "chat") => {
    const list = conversationsRef.current;
    const latest = list.find(item => item.id === currentIdRef.current && item.modelId) ?? list.find(item => item.modelId);
    const fallback = models.find(model => model.id === settings.defaultModelId && model.enabled);
    const pending=newOptionsRef.current;
    const conversation: Conversation = { space, id: `${temporary||pending.temporary ? "temp:" : ""}${crypto.randomUUID()}`, temporary:temporary||pending.temporary, title: "Nouveau chat", providerId: pending.providerId ?? latest?.providerId ?? fallback?.providerId, modelId: pending.modelId ?? latest?.modelId ?? fallback?.id, effort: pending.effort ?? latest?.effort ?? "medium", createdAt: now(), updatedAt: now() };
    return conversation;
  };
  const startNew=(temporary=false,space:"chat"|"work"=view==="work"?"work":view==="chat"?"chat":newOptionsRef.current.space??"chat")=>{
    const recent=conversationsRef.current.find(c=>c.id===currentIdRef.current)??conversationsRef.current.find(c=>c.modelId);
    setNewOptions({modelId:recent?.modelId??settings.defaultModelId,providerId:recent?.providerId,effort:recent?.effort??"medium",temporary,space});
    selectConversation(null);setView(space);window.dispatchEvent(new Event("solar-new-chat"));
  };
  useEffect(() => {
    let live = true;
    void reload().then(() => { if (live && conversationsRef.current[0]) selectConversation(conversationsRef.current[0].id); void refreshOllama().then(() => { if (live) void reload(); }); }).catch(() => setAppError("Impossible de lire les données enregistrées."));
    const media = window.matchMedia("(max-width: 799px)");
    const resize = () => { if (media.matches) setCollapsed(true); };
    media.addEventListener("change", resize);
    return () => { live = false; media.removeEventListener("change", resize); cancelRequest.current?.(); };
  }, []);
  useEffect(() => { const shortcuts = (event: KeyboardEvent) => { if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return; const key = event.key.toLowerCase(); if (key === "k") { event.preventDefault(); setSearchOpen(open => !open); } else if (key === "b") { event.preventDefault(); setCollapsed(open => !open); } }; window.addEventListener("keydown", shortcuts); return () => window.removeEventListener("keydown", shortcuts); }, []);
  useEffect(() => {
    let live = true;
    const revision = messageRevision.current;
    if(liveMessages.current?.id===currentId){setMessages(liveMessages.current.value);return;}
    if (currentId) void solarStore.listMessages(currentId).then(value => { if (live && messageRevision.current === revision) setMessages(value); });
    return () => { live = false; };
  }, [currentId, selectionRevision]);
  const updateMessages = (id: string, value: Message[]) => { if (currentIdRef.current === id) { messageRevision.current++;liveMessages.current={id,value}; setMessages(value); } };
  const updateSettings = async (next: AppSettings) => { await solarStore.saveSettings(next); setSettings(next); };
  const rename = async (conversation: Conversation) => {
    const title = window.prompt("Nom de la conversation", conversation.title)?.trim();
    if (title) await updateConversation({ ...conversation, title, titleManuallyEdited: true, updatedAt: now() });
  };
  const remove = async (conversation: Conversation) => {
    if (!conversation.temporary && !window.confirm(`Supprimer « ${conversation.title} » ?`)) return;
    cancelRequest.current?.(conversation.id); await solarStore.deleteConversation(conversation.id); await extensionStore.clearConversation(conversation.id); await reload(); if (conversation.id === currentIdRef.current) selectConversation(conversationsRef.current[0]?.id ?? null);
  };
  const clearHistory = async () => {
    if (!window.confirm("Supprimer toutes les conversations enregistrées ? Les fournisseurs et les clés seront conservés.")) return;
    cancelRequest.current?.();
    for (const conversation of await solarStore.listConversations()) {await solarStore.deleteConversation(conversation.id);await extensionStore.clearConversation(conversation.id);}
    await reload(); selectConversation(null);
  };
  const sidebarConversations = conversations.filter(c => (c.space === "work") === (view === "work"));
  const sidebarGroups = (["temporary", "pinned", "recent"] as const).map(group => ({ group, items: sidebarConversations.filter(c => group === "temporary" ? c.temporary : !c.temporary && Boolean(c.pinned) === (group === "pinned")) })).filter(({ items }) => items.length > 0);
  const sidebarFxTotal = 6 + sidebarGroups.reduce((total, group) => total + 1 + group.items.length, 0) + (sidebarConversations.length ? 0 : 1);
  let sidebarFxIndex = 0;
  const changeMode=(space:"chat"|"work")=>{if(!current){setNewOptions({...newOptions,space});setView(space);return;}if(!messages.length){void updateConversation({...current,space}).then(()=>setView(space));}else if((current.space??"chat")!==space){startNew(false,space);}else setView(space);};
  return <><main data-native={Boolean((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__)} className={`shell ${collapsed ? "collapsed" : ""} ${resolvedTheme === "light" ? "" : "dark"}`} data-theme={resolvedTheme} data-theme-mode={settings.theme} style={appearanceStyle(settings, resolvedTheme) as React.CSSProperties}>
    {!collapsed && <button className="sidebar-scrim" aria-label="Fermer la barre latérale" onClick={() => setCollapsed(true)}/>}
    <aside id="conversation-sidebar" className="sidebar" aria-label="Conversations" data-open={String(!collapsed)} {...((collapsed || searchOpen) ? { inert: "" } : {})}>
      <div className="sidebar-card">
      <nav className="sidebar-actions" aria-label="Actions Solar">
        <SidebarAction icon="new-chat" label="New Chat" fxIndex={sidebarFxIndex++} fxTotal={sidebarFxTotal} onClick={() => startNew(false,"chat")}/>
        <SidebarAction icon="new-project" label="Solar Code" fxIndex={sidebarFxIndex++} fxTotal={sidebarFxTotal} onClick={() => startNew(false,"work")}/>
        <SidebarAction icon="search" label="Search" fxIndex={sidebarFxIndex++} fxTotal={sidebarFxTotal} onClick={() => setSearchOpen(true)}/>
        <SidebarAction icon="hub" label="Hub" fxIndex={sidebarFxIndex++} fxTotal={sidebarFxTotal} onClick={() => { setView("plugins"); setCollapsed(true); }}/>
        <SidebarAction icon="settings" label="Settings" fxIndex={sidebarFxIndex++} fxTotal={sidebarFxTotal} onClick={() => { setView("settings"); setCollapsed(true); }}/>
      </nav>
      <nav aria-label="Historique"><p className="sidebar-heading fx" style={{ "--i": sidebarFxIndex++, "--n": sidebarFxTotal } as React.CSSProperties}>Conversations</p>{sidebarGroups.map(({ group, items }) => <div key={group}><p className="thread-label fx" style={{ "--i": sidebarFxIndex++, "--n": sidebarFxTotal } as React.CSSProperties}>{group === "temporary" ? "Cette session" : group === "pinned" ? "Épinglées" : "Récentes"}</p>{items.map(conversation => <div className={`thread-wrap fx ${conversation.id === currentId && view === "chat" ? "active" : ""}`} style={{ "--i": sidebarFxIndex++, "--n": sidebarFxTotal } as React.CSSProperties} key={conversation.id} onContextMenu={event => { event.preventDefault(); const menu = event.currentTarget.querySelector("details"); if (menu) menu.open = true; }}><button className="thread" onClick={() => selectConversation(conversation.id)} aria-current={conversation.id === currentId && view === "chat" ? "page" : undefined}><span>{conversation.title}</span></button><details className="thread-menu" onToggle={event => { const menu = event.currentTarget; if (!menu.open) return; const bounds = menu.querySelector("summary")!.getBoundingClientRect(); const panel = menu.querySelector("div")!; panel.style.left = `${Math.max(8, Math.min(bounds.left - 170, window.innerWidth - 210))}px`; panel.style.top = `${Math.max(8, Math.min(bounds.bottom + 5, window.innerHeight - 150))}px`; }}><summary aria-label={`Actions pour ${conversation.title}`}><MoreHorizontal size={15}/></summary><div onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); }}><button onClick={() => void rename(conversation)}><Pencil size={14}/>Renommer</button>{!conversation.temporary && <button onClick={() => void updateConversation({ ...conversation, pinned: !conversation.pinned })}><Pin size={14}/>{conversation.pinned ? "Désépingler" : "Épingler"}</button>}<button onClick={() => void remove(conversation)}><Trash2 size={14}/>Supprimer</button></div></details><button className="thread-action" onClick={() => void remove(conversation)} aria-label={`Supprimer ${conversation.title}`}><Trash2 size={14}/></button></div>)}</div>)}{!sidebarConversations.length && <p className="sidebar-empty fx" style={{ "--i": sidebarFxIndex++, "--n": sidebarFxTotal } as React.CSSProperties}>Un nouveau départ.<br/>Tes conversations apparaîtront ici.</p>}</nav>
      </div>
    </aside>
    <header className="header"><button className="panel-toggle panel-toggle-header" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Afficher la barre latérale" : "Masquer la barre latérale"} aria-expanded={!collapsed} aria-controls="conversation-sidebar"><PanelLeft size={18}/></button></header>
    <section className="workspace" {...(searchOpen ? { inert: "" } : {})}>
      {appError && <p className="global-error" role="alert">{appError}</p>}
      <div className="chat-pane" hidden={view !== "chat" && view !== "work"}><WorkSurface onPlugins={()=>setView("plugins")} active={view === "work"} conversationId={current?.id} provider={providers.find(p=>p.id===models.find(m=>m.id===(current?.modelId??newOptions.modelId??settings.defaultModelId))?.providerId)} bridge={workBridge}><ChatView newOptions={newOptions} onNewOptions={setNewOptions} theme={resolvedTheme} updateSettings={updateSettings} workMode={view === "work"} workBridge={workBridge} onRefreshConversations={async () => { const list = [...await solarStore.listTemporaryConversations(), ...await solarStore.listConversations()]; conversationsRef.current = list; setConversations(list); }} onBusy={setChatBusy} current={current} messages={messages} providers={providers} models={models} settings={settings} onCreated={() => createConversation(Boolean(newOptionsRef.current.temporary))} onConversation={updateConversation} onMessages={updateMessages} onSettings={() => setView("settings")} cancelRequest={cancelRequest} targetMessageId={targetMessageId} onTargetShown={() => setTargetMessageId(undefined)} onRefreshModels={async () => { await refreshOllama(); await reload(); }}/></WorkSurface></div>
      {view === "favorites" && <FavoritesView onOpen={(id, messageId) => { selectConversation(id); setTargetMessageId(messageId); }}/>}
      {(view === "plugins" || view === "skills") && <ExtensionDirectory kind={view} key={`${view}-${hubPluginTab}`} initialTab={hubPluginTab} settings={settings} updateSettings={updateSettings} onNavigate={(next,tab)=>{if(tab)setHubPluginTab(tab);setView(next);}} onImport={async text=>{startNew(false,"chat");setView("chat");window.dispatchEvent(new CustomEvent("solar-import-context",{detail:text}));}}/>}
      {view === "settings" && <SettingsView providers={providers} models={models} settings={settings} updateSettings={updateSettings} reload={reload} workBridge={workBridge} onBack={() => setView((current?.space??newOptions.space) === "work" ? "work" : "chat")} clearHistory={clearHistory}/>}
    </section>
  </main>{searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} onOpen={(id, messageId) => { selectConversation(id); setTargetMessageId(messageId); }}/>}{loaded && showOnboarding && settings.onboardingComplete !== true && <Onboarding settings={settings} providers={providers} models={models} onSave={updateSettings} reload={reload} workBridge={workBridge} renderForm={(preset,onDone)=><ProviderForm initial={{...preset,secret:""}} onDone={async()=>{await reload();onDone();}} onCancel={onDone}/>} renderProviders={onEdit=><ProviderList providers={providers} models={models} reload={reload} setEditing={onEdit}/>}/>}</>;
}

function ChatView({ newOptions, onNewOptions, theme, updateSettings, workMode, workBridge, onRefreshConversations, onBusy, current, messages, providers, models, settings, onCreated, onConversation, onMessages, onSettings, cancelRequest, targetMessageId, onTargetShown, onRefreshModels }: {
  theme:"light"|"dark"; updateSettings: (settings: AppSettings) => Promise<void>; workMode:boolean;workBridge: React.MutableRefObject<WorkBridge|null>; onRefreshConversations: () => Promise<void>; onBusy: (busy: boolean) => void; current: Conversation | null; messages: Message[]; providers: Provider[]; models: Model[]; settings: AppSettings;
  newOptions: Partial<Conversation>;onNewOptions:(value:Partial<Conversation>)=>void;
  onCreated: () => Promise<Conversation>; onConversation: (value: Conversation) => Promise<void>; onMessages: (id: string, value: Message[]) => void;
  targetMessageId?: string; onTargetShown: () => void; onRefreshModels: () => Promise<void>;
  onSettings: () => void; cancelRequest: React.MutableRefObject<((conversationId?: string) => void) | null>;
}) {
  const draftKey = current?.id ?? "new";
  const { draft: savedDraft, appendAttachments, update: updateDraft, clearSent, transfer, reset: resetDraft, error: draftError, ready: draftReady } = useDraft(draftKey);
  const draft = savedDraft.text;
  const setDraft = (text: string) => { updateDraft({ text }); setIntentSummary(""); if(pendingIntent&&pendingIntent.prompt!==text)setPendingIntent(undefined); };
  useEffect(()=>{const clear=()=>{resetDraft("new");setBannerPhase("idle");};const insert=(event:Event)=>{updateDraft({text:"",attachments:[pastedContent((event as CustomEvent<string>).detail)]},"new");};window.addEventListener("solar-new-chat",clear);window.addEventListener("solar-import-context",insert);return()=>{window.removeEventListener("solar-new-chat",clear);window.removeEventListener("solar-import-context",insert);};},[updateDraft,resetDraft]);
  const [artifact,setArtifact]=useState<Artifact>(); const [artifactOpen,setArtifactOpen]=useState(false);
  useEffect(()=>{let live=true;setArtifact(undefined);setArtifactOpen(false);if(current?.id)void extensionStore.listArtifacts(current.id).then(items=>{if(live)setArtifact(items.at(-1));}).catch(()=>{});return()=>{live=false;};},[current?.id]);
  const [error, setError] = useState(""); const [importBusy, setImportBusy] = useState(false); const [dragOver, setDragOver] = useState(false); const importLock = useRef(false); const dragDepth = useRef(0);
  const [pendingIntent,setPendingIntent]=useState<{prompt:string;questions:IntentQuestion[]}>();const [intentSummary,setIntentSummary]=useState("");
  useEffect(() => { if (!error) return; const timeout = window.setTimeout(() => setError(""), 3000); return () => window.clearTimeout(timeout); }, [error]);
  const [activeRequest, setActiveRequest] = useState<{ conversationId: string; started: number } | null>(null);
  const requestRef = useRef<{ controller: AbortController; conversationId: string } | null>(null);
  const agentRuntime = useRef<SolarAgentRuntime | null>(null);
  agentRuntime.current ??= new SolarAgentRuntime();
  const locked = useRef(false); const currentRef = useRef(current); currentRef.current = current;
  const [bannerPhase,setBannerPhase]=useState<ComposerPhase>("idle");const bannerTarget=useRef<string|null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [allowFiles,setAllowFiles]=useState(true);const [allowChanges,setAllowChanges]=useState(true);
  const scene=useSolarScene(current?.id,theme);const composerRef=scene.composerRef;
  const fileInput = useRef<HTMLInputElement>(null); const textarea = useRef<HTMLTextAreaElement>(null); const scroll = useRef<HTMLDivElement>(null); const follow = useRef(true); const lastScroll = useRef(0);
  const selectedModel = models.find(model => model.id === (current?.modelId ?? newOptions.modelId ?? settings.defaultModelId));
  const provider = providers.find(item => item.id === selectedModel?.providerId);
  const [actionBusy, setActionBusy] = useState(false);
  const preparation = useModelPreparation(provider, selectedModel, Boolean(activeRequest) || actionBusy,settings.performanceProfile);
  const actions = useTextActions(current?.id, provider, selectedModel, current?.effort ?? newOptions.effort ?? "medium", Boolean(activeRequest) || locked.current, preparation.cancel);
  useEffect(() => { setActionBusy(actions.busy); }, [actions.busy]);
  const [highlighted, setHighlighted] = useState<string>();
  useEffect(() => { if (!targetMessageId || !messages.some(message => message.id === targetMessageId)) return; const element = document.getElementById(`message-${targetMessageId}`); element?.scrollIntoView({ block: "center" }); follow.current = false; setHighlighted(targetMessageId); onTargetShown(); }, [targetMessageId, messages]);
  useEffect(() => { if (!highlighted) return; const timer = setTimeout(() => setHighlighted(undefined), 1800); return () => clearTimeout(timer); }, [highlighted]);
  useEffect(() => { onBusy(Boolean(activeRequest)); }, [activeRequest]);
  const activeHere = Boolean(activeRequest && activeRequest.conversationId === current?.id);
  useEffect(() => { cancelRequest.current = id => { if (!id || requestRef.current?.conversationId === id) requestRef.current?.controller.abort(); }; return () => { requestRef.current?.controller.abort(); agentRuntime.current?.cancel(); cancelRequest.current = null; }; }, []);
  useEffect(() => { if (!activeRequest) return; const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - activeRequest.started) / 1000)), 1000); return () => clearInterval(timer); }, [activeRequest]);
  useEffect(() => { setError(""); follow.current = true; lastScroll.current = 0; }, [current?.id]);
  useEffect(() => { if (scroll.current && follow.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [messages]);
  useEffect(() => { const el=scroll.current; const content=el?.querySelector(".message-list"); if(!el||!content)return; const resize=new ResizeObserver(()=>{if(follow.current)el.scrollTop=el.scrollHeight;});resize.observe(content);return()=>resize.disconnect(); }, [messages.length === 0]);
  useLayoutEffect(() => { const field=textarea.current;if(field){const prev=field.offsetHeight;field.style.transition="none";field.style.height="auto";const h=Math.min(field.scrollHeight,200);field.style.height=prev+"px";void field.offsetHeight;field.style.transition="";field.style.height=h+"px";} }, [draft]);
  const changeSelection = async (modelId?: string, effort?: Effort) => {
    try {
      if(!currentRef.current){const model=models.find(item=>item.id===modelId);onNewOptions({...newOptions,...(model?{modelId:model.id,providerId:model.providerId}:{}),...(effort?{effort}: {})});return;}
      const creating = !currentRef.current;
      const base = currentRef.current ?? await onCreated();
      if (creating) await transfer("new", base.id);
      const model = models.find(item => item.id === modelId);
      const next = { ...base, ...(model ? { modelId: model.id, providerId: model.providerId } : {}), ...(effort ? { effort } : {}), updatedAt: now() };
      currentRef.current = next; await onConversation(next);
    } catch { setError("Impossible d’enregistrer ce choix. Vérifie le stockage disponible."); }
  };
  const send = async (resolution?:IntentResolution) => {
    const snapshot = structuredClone(savedDraft); const content = draftMessage(snapshot); if (importLock.current || !content.trim() || locked.current || actions.busyRef.current) return;
    if(!resolution){if(pendingIntent?.prompt===snapshot.text)return;const prior=messages.slice(-8).map(message=>`${message.role}: ${message.displayText??message.content.slice(0,600)}`).join("\n");const questions=buildIntentQuestions(snapshot.text,prior,workMode);if(questions.length){setPendingIntent({prompt:snapshot.text,questions});return;}}
    const clarifications=resolution&&resolution.prompt===snapshot.text?intentInstruction(resolution):"";
    setPendingIntent(undefined);setIntentSummary(resolution?summarizeIntent(resolution,pendingIntent?.questions??[]):"");
    const sentContent=content+clarifications;
    if(!allowFiles&&snapshot.attachments.length){setError("Active la lecture de fichiers dans les outils pour envoyer ces pièces jointes.");return;}
    preparation.cancel();
    locked.current = true; setError("");setBannerPhase("thinking");setElapsed(0);bannerTarget.current=currentRef.current?.id??null;
    const controller = new AbortController(); const started = Date.now();
    let sentDraftKey=draftKey;
    let active: Conversation | null = null; let latest: Message | null = null; let history: Message[] = [];
    requestRef.current = { controller, conversationId: current?.id ?? "" };
    try {
      active = currentRef.current ?? await onCreated();bannerTarget.current=active.id;
      const model = models.find(item => item.id === (active!.modelId ?? settings.defaultModelId));
      const activeProvider = providers.find(item => item.id === model?.providerId && item.enabled);
      if (!model?.enabled || model.available === false || !activeProvider) throw new ChatError("Sélectionne un modèle connecté dans les paramètres pour commencer.", "model");
      const workContext=active.space === "work" ? await workBridge.current?.prepare(active.id,controller.signal,{allowChanges}).catch(e=>{throw new ChatError(e instanceof Error?e.message:"Préparation du projet impossible.","model");}) : await workBridge.current?.prepareDefault(snapshot.text,controller.signal);
      if(draftKey==="new"){await transfer("new",active.id);sentDraftKey=active.id;}
      // Snapshot model, effort and history once. Changes made during streaming affect the next turn.
      const effort = active.effort; const rawHistory = await solarStore.listMessages(active.id);
      const user: Message = { id: crypto.randomUUID(), conversationId: active.id, role: "user", content:sentContent, displayText: snapshot.text, attachments: snapshot.attachments, status: "completed", createdAt: now(), order: rawHistory.length };
      latest = { id: crypto.randomUUID(), conversationId: active.id, role: "assistant", content: "", status: "streaming", createdAt: now(), order: rawHistory.length + 1, modelName: model.name, effort, activity: "connecting", activities: ["Message préparé pour le fournisseur"] };
      history = [...rawHistory, user]; requestRef.current.conversationId = active.id;
      const updated = { ...(currentRef.current?.id === active.id ? currentRef.current : active), title: !active.titleManuallyEdited && ["New conversation", "Nouveau chat"].includes(active.title) ? conversationTitle(snapshot.text, snapshot.attachments.length) : active.title, titleManuallyEdited: active.titleManuallyEdited, updatedAt: now() };
      scene.begin(active.id);currentRef.current=updated;await onConversation(updated);
      follow.current = true; setElapsed(0); setActiveRequest({ conversationId: active.id, started });
      await solarStore.saveMessage(user); await solarStore.saveMessage(latest); onMessages(active.id, [...history, latest]);
      try { await clearSent(sentDraftKey, snapshot); } catch { setError("Le message est envoyé, mais le brouillon n’a pas pu être effacé."); }
      let lastSaved = 0; let lastRendered = 0;
      let instruction=smartInstruction(snapshot.text,snapshot.attachments.length>0,settings.smart!==false);
      instruction+=responseGuidance(active.space === "work");
      const compactConversation=rawHistory.slice(-6).map(message=>`${message.role==="user"?"Utilisateur":"Solar"} : ${message.content.slice(0,900)}`).join("\n").slice(-5200);
      instruction+=await personalSkillInstruction({text:snapshot.text,conversationContext:compactConversation,workMode:active.space === "work",artifact:Boolean(artifactIntent(snapshot.text)||(artifact?.conversationId===active.id&&/modifie|corrige|ajoute/i.test(snapshot.text))),attachments:snapshot.attachments.length>0,modelName:model.displayName??model.name,providerProtocol:activeProvider.protocol,skillsMode:settings.skillsMode??"auto",manualSkillIds:settings.manualSkillIds});
      if(workContext){instruction+="\n"+workContext.instruction;latest={...latest,activities:[...(latest.activities??[]),active.space==="work"?"Lecture des fichiers cochés du projet terminée":"Lecture du dossier par défaut",...workContext.activities]};}
      if(snapshot.attachments.length)latest={...latest,activities:[...(latest.activities??[]),...snapshot.attachments.map(a=>`Fichier joint préparé : ${a.title}`)]};
      const kind=artifactIntent(snapshot.text);const previousArtifact=artifact?.conversationId===active.id && (!kind||artifact.kind===kind) && /modifie|corrige|ajoute/i.test(snapshot.text)?artifact:undefined;
      latest={...latest,artifactKind:kind??previousArtifact?.kind};
      if(kind||previousArtifact)instruction+=artifactInstruction(kind??previousArtifact!.kind,previousArtifact);
      let codeContext:ReturnType<typeof budgetConversation>|undefined;
      if(active.space==="work"){
        const hardware=await detectHardware().catch(()=>undefined);
        const strategy=chooseSolarCodeStrategy({prompt:snapshot.text,modelName:model.displayName??model.name,protocol:activeProvider.protocol,availableMemory:hardware?.availableMemory,performanceProfile:settings.performanceProfile,attachments:snapshot.attachments.length});
        codeContext=budgetConversation(history,{modelName:model.displayName??model.name,protocol:activeProvider.protocol,availableMemory:hardware?.availableMemory,performanceProfile:settings.performanceProfile});
        instruction+=`\n${strategy.instruction}`;
        if(codeContext.memory)instruction+=`\n${codeContext.memory}`;
      }
      const web=effectiveWebSettings(settings.web);
      if(web.mode==="on" || (web.mode!=="off" && web.consent && needsWeb(snapshot.text))){
        latest={...latest,activity:"searching",activities:[...(latest.activities??[]),"Recherche Web en cours"]};onMessages(active.id,[...history,latest]);
        try{const found=await searchWeb(web,{text:snapshot.text.slice(0,1500)},secretVault,controller.signal);latest={...latest,sources:found.sources,activities:[...(latest.activities??[]),`${found.sources.length} sources Web récupérées`,...found.sources.map(source=>`Source : ${source.title} · ${source.site}`)]};instruction+=sourceContext(found);}catch(e){if(controller.signal.aborted)throw e;latest={...latest,activities:[...(latest.activities??[]),"Recherche Web indisponible : "+(e instanceof Error?e.message:"Connexion impossible")]};setError(e instanceof Error?e.message:"La recherche Web est indisponible.");instruction+=" La recherche Web a échoué. Ne présente pas les informations comme actuelles.";}
      }
      const generationStarted=Date.now(); let firstTokenMs:number|undefined;

      const localPipeline=activeProvider.protocol==="ollama";
      const pipelineAllowed=localPipeline||settings.pipelineOnline===true;
      const pipelineRunner:PipelineRunner={
        onStage:(stage:PipelineStage)=>{latest={...latest!,activity:"thinking",activities:[...new Set([...(latest!.activities??[]),stage])]};onMessages(active!.id,[...history,latest]);void solarStore.saveMessage(latest).catch(()=>setError("L’étape s’affiche, mais son enregistrement a échoué."));},
        run:async({stage, instruction:stageInstruction,signal,format,final})=>{
          let output="";
          const stageMessages=active!.space==="work"?(final||stage==="Planification"?codeContext?.messages??history:[user]):final||stage==="Planification"?history:[user];
          await streamChat({provider:activeProvider,model:model.providerModelId??model.id,messages:stageMessages,effort,systemInstruction:`${instruction}\n\nÉtape ${stage}: ${stageInstruction}`,performanceProfile:settings.performanceProfile,maxOutputTokens:kind||previousArtifact||workContext?8192:undefined,format:localPipeline?format:undefined,onMetrics:metrics=>{if(final)latest={...latest!,metrics:{...metrics,firstTokenMs}};},vault:secretVault,signal,onActivity:activity=>{const labels={searching:"Recherche Web en cours",connecting:"Connexion au fournisseur",waiting:"Demande acceptée · attente du modèle",thinking:"Réflexion du modèle",writing:final?"Réception de la réponse":"Étape de raisonnement"};const label=activity?labels[activity]:"";latest={...latest!,activity,activities:[...new Set([...(latest!.activities??[]),label].filter(Boolean))]};onMessages(active!.id,[...history,latest]);},onDelta:delta=>{output+=delta;if(!final)return;setBannerPhase("writing");firstTokenMs??=Date.now()-generationStarted;latest={...latest!,content:latest!.content+delta};if(Date.now()-lastRendered>32){lastRendered=Date.now();onMessages(active!.id,[...history,latest]);}if(Date.now()-lastSaved>250){lastSaved=Date.now();void solarStore.saveMessage(latest).catch(()=>setError("La réponse s’affiche, mais son enregistrement a échoué."));}}});
          return output;
        }
      };
      if(active.space==="work" && localPipeline && workContext?.agentProject && !kind && !previousArtifact){
        const hardware=await detectHardware().catch(()=>undefined);
        const detectedProfile=modelProfile(model.providerModelId??model.id,model.displayName??model.name,activeProvider.protocol,hardware?.availableMemory);
        const profile={...detectedProfile,contextWindow:Math.min(detectedProfile.contextWindow,hardware?.availableMemory!==undefined&&hardware.availableMemory<8*2**30?4096:8192)};
        const mode=effort==="low"?"fast":effort==="high"||effort==="ultra"?"deep":undefined;
        const result=await agentRuntime.current!.run({userPrompt:sentContent,conversationId:active.id,model:profile,project:workContext.agentProject,mode,allowChanges,signal:controller.signal,additionalGuidance:responseGuidance(true)},{
          onLog:recordAgentDiagnostic,
          onState:(state,detail)=>{const labels:Record<string,string>={analyzing:"Analyse de la demande",selectingContext:"Sélection des fichiers pertinents",planning:"Planification",generating:detail==="Réponse finale"?"Réception de la réponse":"Génération structurée",applyingChanges:"Préparation des modifications",verifying:"Vérification de la syntaxe et des imports",repairing:"Correction de la proposition",completed:"Proposition prête",failed:"Vérification échouée"};const label=labels[state];latest={...latest!,activity:state==="generating"&&detail==="Réponse finale"?"writing":"thinking",activities:[...new Set([...(latest!.activities??[]),label].filter(Boolean))]};onMessages(active!.id,[...history,latest]);},
          onProposal:async(changes,signal)=>{signal.throwIfAborted();await workContext.propose?.(changes);},
          generate:async(call,signal)=>{let output="";const transient:Message={id:crypto.randomUUID(),conversationId:active!.id,role:"user",content:call.prompt,status:"completed",createdAt:now(),order:0};await streamChat({provider:activeProvider,model:model.providerModelId??model.id,messages:[transient],effort:"low",systemInstruction:call.system,performanceProfile:settings.performanceProfile,localOptions:{temperature:profile.temperature,numCtx:profile.contextWindow},maxOutputTokens:call.maxOutputTokens,format:call.schema,vault:secretVault,signal,onDelta:delta=>{output+=delta;if(!call.visible)return;call.onDelta?.(delta);firstTokenMs??=Date.now()-generationStarted;latest={...latest!,content:latest!.content+delta};if(Date.now()-lastRendered>32){lastRendered=Date.now();onMessages(active!.id,[...history,latest]);}if(Date.now()-lastSaved>250){lastSaved=Date.now();void solarStore.saveMessage(latest).catch(()=>setError("La réponse s’affiche, mais son enregistrement a échoué."));}}});return output;}
        });
        if(!latest.content)latest={...latest,content:result.finalAnswer};
        latest={...latest,metrics:{...latest.metrics,totalMs:result.metrics.totalGenerationMs,firstTokenMs:result.metrics.timeToFirstTokenMs,contextTokens:result.metrics.contextTokenCount,contextFiles:result.metrics.contextFiles,repairIterations:result.metrics.repairIterations,agentMode:result.mode}};
      }
      else if(pipelineAllowed)await runPipeline(effort,pipelineRunner,controller.signal);
      else await pipelineRunner.run({stage:"Réponse finale",instruction:"Réponds directement à la demande, sans pipeline intermédiaire activé.",signal:controller.signal,final:true});
      latest = { ...latest, metrics:{...latest.metrics,totalMs:Date.now()-started,firstTokenMs},status: "completed", durationSeconds: Math.round((Date.now() - started) / 1000) };
      const fullResponseContent=latest.content;
      if(kind||previousArtifact){try{const result=parseRequestedArtifact(latest.content,active.id,kind??previousArtifact!.kind,previousArtifact);if(kind && result.kind!==kind)throw new Error("Le modèle a produit un type d’artefact différent de celui demandé. Réessaie.");await extensionStore.save(result);latest={...latest,artifactId:result.id,content:latest.content.includes("```solar-artifact")?displayAnswer(latest.content):"L’artefact est prêt. Ouvre-le pour consulter son contenu."};if(currentRef.current?.id===active.id){setArtifact(result);setArtifactOpen(true);}}catch(e){setError(String(e));}}
      if(workContext)await workContext.complete(fullResponseContent);
      await solarStore.saveMessage(latest); onMessages(active.id, [...history, latest]);
      if (rawHistory.length === 0 && !active.titleManuallyEdited && !active.titleGenerated) {
        const id = active.id; const text = `${snapshot.text || snapshot.attachments.map(a => a.title).join(", ")}\nRéponse : ${latest.content.slice(0,1200)}`;
        void generateLabel(activeProvider, model, secretVault, "title", text).then(async title => { await solarStore.saveAutomaticTitle(id, title); await onRefreshConversations(); }).catch(() => {});
      }
    } catch (reason) {
      const normalized = controller.signal.aborted ? new ChatError("La génération a été interrompue.","interrupted") : reason instanceof ChatError ? reason : new ChatError(reason instanceof Error && reason.message ? reason.message : "Impossible de terminer la réponse ou de l’enregistrer. Réessaie après avoir vérifié le stockage.", "provider");
      if (latest && active) {
        latest = { ...latest, status: normalized.code === "interrupted" ? "interrupted" : "error", durationSeconds: Math.round((Date.now() - started) / 1000), error: normalized.code === "interrupted" ? undefined : normalized.message };
        try { await solarStore.saveMessage(latest); } catch { /* Display the error even if persistence fails. */ }
        onMessages(active.id, [...history, latest]);
      } else setError(normalized.message);
    } finally {setElapsed(Math.round((Date.now()-started)/1000));setBannerPhase(latest ? latest.status==="completed"?"done":"stopped" : "idle"); requestRef.current = null; locked.current = false; setActiveRequest(null); }
  };
  const activeMessage = activeHere ? messages.findLast(m => m.role === "assistant" && m.status === "streaming") : undefined;
  const toggleWeb = async () => { const web=effectiveWebSettings(settings.web);try{await updateSettings({...settings,web:{...web,consent:true,mode:web.consent && web.mode!=="off"?"off":"on"}});setError("");}catch{setError("Impossible d’enregistrer le mode Web.");} };
  const attachFiles = async (files: FileList | File[] | null) => {
    if(!allowFiles){setError("Active la lecture de fichiers dans les outils.");return;}
    if (!files?.length || importLock.current) return;
    importLock.current = true; setImportBusy(true);
    try {
      const items = await Promise.all([...files].map(fileAttachment));
      appendAttachments(items); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de lire ce fichier."); }
    finally { importLock.current = false; setImportBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  };
  return <div ref={scene.sceneRef} data-theme={theme} data-mode={workMode ? "code" : "chat"} className={`chat-layout solar-scene scene intro ${!scene.revealed?"sky-pending":"sky-chatting"} ${artifactOpen && artifact ? "has-artifact" : ""}`}><canvas ref={scene.canvasRef} className="sky-canvas" aria-hidden="true"/><div ref={scene.veilRef} className="veil" aria-hidden="true"/><div className="conversation-area"><div ref={scroll} className={`chat-scroll ${messages.length ? "has-messages" : ""}`} onWheel={event => { if (event.deltaY < 0) { follow.current = false; } }} onTouchMove={() => { follow.current = false; }} onKeyDown={event => { if (["PageUp", "Home", "ArrowUp"].includes(event.key)) { follow.current = false; } }} onScroll={() => { const el = scroll.current; if (!el) return; if (el.scrollTop < lastScroll.current - 2) { follow.current = false; } else if (el.scrollTop > lastScroll.current && el.scrollHeight - el.scrollTop - el.clientHeight < 12) { follow.current = true; } lastScroll.current = el.scrollTop; }}>
    {!messages.length ? <div className="canvas"><div className="welcome"><h1>{workMode ? "Sur quoi souhaitez-vous travailler ?" : "Local AI."}</h1><p>{workMode ? "" : "Un espace calme pour tes idées."}</p>{!selectedModel && <button className="inline-link" onClick={onSettings}>Connecter un modèle <ArrowUp size={14}/></button>}</div></div> : <div className="message-list">{messages.filter(message => message.role !== "system" && (message.role==="user" || (workMode ? scene.replyRevealed : scene.revealed))).map(message => <article id={`message-${message.id}`} data-message-id={message.id} className={`message ${message.role} ${highlighted === message.id ? "highlighted" : ""}`} key={message.id}>
      {message.role === "user" ? <><div className="user-bubble">{message.displayText ?? message.content}</div>{message.attachments && <PastedContents items={message.attachments}/>}</> : <>{workMode && <ToolGroup defaultOpen={message.status === "streaming"} state={message.status === "streaming" ? "pending" : message.status === "completed" ? "completed" : "interrupted"} completeLabel="Réponse terminée" shimmerLabel="Réponse en cours" interruptedLabel={message.status === "error" ? "Réponse non terminée" : "Réponse interrompue"} elapsedTime={`${message.status === "streaming" && activeHere ? elapsed : message.durationSeconds ?? 0} s`} nestedTools={(message.activities ?? ["Message préparé pour le fournisseur"]).map(title => ({ category: (/fichier/i.test(title) ? "file" : /recherche|source/i.test(title) ? "search" : "generic") as "file"|"search"|"generic", title })).concat(message.status === "completed" ? [{ category: "generic" as const, title: "Réponse reçue et enregistrée" }] : [])} className={`generation-status ${message.status === "streaming" ? "generation-live" : ""}`}/>}
      {!workMode && message.status === "streaming" && (!message.content || message.artifactKind) && <span className="chat-thinking-dot" role="status" aria-label="Solar prépare une réponse"/>}

      <div className="message-content response-body"><AiMessage key={message.id} text={message.artifactKind && message.status === "streaming" ? "" : displayAnswer(message.content)}/></div>
      {message.error && <p className="message-error" role="alert">{message.error}</p>}
      {message.status === "completed" && message.content && <div className="response-actions"><CopyMessage content={message.content}/>{!current?.temporary && <button className={`copy-message ${message.favorite ? "saved" : ""}`} aria-label={message.favorite ? "Retirer des réponses enregistrées" : "Enregistrer la réponse"} onClick={async () => { const next = { ...message, favorite: !message.favorite }; await solarStore.saveMessage(next); onMessages(message.conversationId, messages.map(item => item.id === message.id ? next : item)); }}><Bookmark size={14} fill={message.favorite ? "currentColor" : "none"}/><span>{message.favorite ? "Enregistré" : "Enregistrer"}</span></button>}</div>}</>}
      {actions.result?.messageId === message.id && <SelectionResult result={actions.result} busy={actions.busy} onStop={actions.cancel} onClose={actions.close} onInsert={text => { setDraft(draft ? `${draft}\n\n${text}` : text); textarea.current?.focus(); }}/>}
      {workMode && message.sources?.length ? <div className="source-list" aria-label="Sources Web">{message.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>{source.site}{source.date ? ` · ${source.date}` : ""}</a>)}</div> : null}{(message.artifactId||message.artifactKind&&message.status==="streaming") && <ArtifactCard id={message.artifactId??`pending-${message.id}`} conversationId={message.conversationId} current={message.artifactId?artifact:undefined} busy={message.status==="streaming"} onOpen={a=>{setArtifact(a);setArtifactOpen(true);}}/>}
    </article>)}</div>}
  </div>{actions.selection && <SelectionToolbar selection={actions.selection} disabled={Boolean(activeRequest) || actions.busy} onAction={action => void actions.run(action)}/>}<div ref={composerRef} className={`composer-wrap ${!scene.revealed ? "composer-welcome" : ""}`}>{pendingIntent?.prompt===draft&&!activeRequest&&<IntentClarification prompt={pendingIntent.prompt} questions={pendingIntent.questions} onContinue={resolution=>void send(resolution)} onSkip={()=>void send({prompt:pendingIntent.prompt,answers:{}})}/ >}{intentSummary&&<p className="intent-summary"><strong>Intent ·</strong> {intentSummary}</p>}<div className={`composer bar ${dragOver ? "drag-over" : ""}`} onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); dragDepth.current++; setDragOver(true); } }} onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDragLeave={() => { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragOver(false); }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragOver(false); void attachFiles(event.dataTransfer.files); }}>{workMode && <ComposerStatus phase={bannerTarget.current && current?.id!==bannerTarget.current?"idle":bannerPhase} model={activeMessage?.modelName??(selectedModel?modelLabel(selectedModel):"Solar")} elapsed={elapsed} activity={activeMessage?.activity} onStop={()=>{requestRef.current?.controller.abort();scene.stop();}}/>}
{dragOver && <div className="file-drop-hint"><Paperclip size={28}/><strong>Dépose tes fichiers ici</strong><span>Relâche pour les joindre au message</span></div>}{savedDraft.attachments.length > 0 && <PastedContents items={savedDraft.attachments} onRemove={id => updateDraft({ attachments: savedDraft.attachments.filter(item => item.id !== id) })} onExpand={id => { const item = savedDraft.attachments.find(item => item.id === id); if (item) updateDraft({ text: draft ? `${draft}\n\n${item.content}` : item.content, attachments: savedDraft.attachments.filter(item => item.id !== id) }); }}/>}<input className="sr-only" ref={fileInput} type="file" multiple aria-label="Joindre un fichier" accept="image/png,image/jpeg,image/webp,.pdf,.docx,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.log,.yaml,.yml,.xml,.sh,.rs,.sql" onChange={event => void attachFiles(event.target.files)}/><div className="composer-input-row"><AnimatedTextarea className="field" ref={textarea} readOnly={!draftReady} aria-busy={!draftReady} aria-label="Message à Solar" value={draft} onChange={event => setDraft(event.target.value)} onPaste={event => { const images = [...event.clipboardData.files].filter(file => file.type.startsWith("image/")); if (images.length) { event.preventDefault(); void attachFiles(images); return; } const content = event.clipboardData.getData("text/plain"); if (shouldCompactPaste(content)) { event.preventDefault(); updateDraft({ attachments: [...savedDraft.attachments, pastedContent(content)] }); } }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && settings.sendOnEnter !== false) { event.preventDefault(); void send(); } }} placeholder={activeRequest ? "Prépare ton prochain message…" : workMode ? "Travailler avec Solar" : "Demande quelque chose à Solar…"} rows={1}/></div>
    <div className="composer-inline-actions toolbar"><Button variant="ghost" className="composer-icon add-context round plus" type="button" aria-label="Ajouter un fichier" title="Joindre un fichier" disabled={importBusy||!allowFiles} onClick={() => fileInput.current?.click()}><Plus size={23}/></Button><ComposerTools read={allowFiles} write={allowChanges} web={settings.web?.consent===true&&settings.web.mode!=="off"} workMode={workMode} onRead={()=>setAllowFiles(!allowFiles)} onWrite={()=>setAllowChanges(!allowChanges)} onWeb={()=>void toggleWeb()}/><div className="composer-runtime-controls"><ModelSelector models={models} providers={providers} selected={selectedModel} onSelect={id => void changeSelection(id)} onSettings={onSettings} onRefresh={onRefreshModels} preparation={preparation.state}/><EffortSelector modelName={selectedModel ? modelLabel(selectedModel) : "Choisir un modèle"} value={current?.effort ?? newOptions.effort ?? "medium"} onSelect={value => void changeSelection(undefined, value)}/><Button className="send" data-ready={activeHere && !workMode || !activeRequest && !importBusy && Boolean(draft.trim()||savedDraft.attachments.length) && Boolean(selectedModel&&selectedModel.available!==false&&provider?.enabled)&&!actions.busy} type="button" onClick={() => { if(activeHere && !workMode){requestRef.current?.controller.abort();scene.stop();}else void send(); }} disabled={activeHere && !workMode ? false : Boolean(activeRequest)||importBusy || (!draft.trim() && !savedDraft.attachments.length) || !selectedModel || selectedModel.available === false || !provider?.enabled || actions.busy} aria-label={activeHere && !workMode ? "Arrêter la génération" : "Envoyer le message"}>{activeHere && !workMode ? <Square size={16} fill="currentColor"/> : <ArrowUp size={23}/> }</Button></div></div>
    {importBusy && <p className="composer-note" role="status">Préparation du fichier…</p>}
    {selectedModel?.available === false && <p className="composer-note">Ce modèle n’est plus disponible. Actualise Ollama ou choisis un autre modèle.</p>}
  </div>{workMode && <WorkShelf/>}{current?.temporary && <p className="temporary-note">Temporaire · rien dans l’historique local. Le fournisseur conserve ses propres règles de données.</p>}{!workMode && <p className="hint">{activeRequest ? "Tu peux écrire et changer les réglages du prochain message." : settings.sendOnEnter === false ? "Utilise le bouton pour envoyer ton message." : "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne"}</p>}</div> </div>{artifactOpen && artifact && <ArtifactPanel artifact={artifact} onChange={setArtifact} onClose={()=>setArtifactOpen(false)}/>}</div>;
}

function CopyMessage({ content }: { content: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return <button className="copy-message" onClick={async () => { try { await navigator.clipboard.writeText(content); setState("copied"); } catch { setState("error"); } }} aria-label="Copier la réponse">{state === "copied" ? <Check size={14}/> : <Copy size={14}/>}<span>{state === "copied" ? "Copié" : state === "error" ? "Copie indisponible" : "Copier"}</span></button>;
}

function ModelSelector({ models, providers, selected, onSelect, onSettings, onRefresh, preparation }: { models: Model[]; providers: Provider[]; selected?: Model; onSelect: (id: string) => void; onSettings: () => void; onRefresh: () => Promise<void>; preparation: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [open, setOpen] = useState(false); const presence = useAnimatedPresence(open); const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return; input.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }; document.addEventListener("keydown", escape); document.addEventListener("pointerdown", outside); return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const selectedProvider = providers.find(p => p.id === selected?.providerId);
  const status = !selected?.enabled || selected.available === false || !selectedProvider?.enabled ? "error" : preparation === "Chargement…" ? "preparing" : selectedProvider.connectionState === "connected" ? "ready" : "error";
  const statusLabel = status === "preparing" ? "Préparation du modèle" : status === "ready" ? "Modèle prêt" : "Modèle déconnecté ou indisponible";
  const filtered = models.filter(model => model.enabled && model.available !== false && providers.some(p => p.id === model.providerId && p.enabled) && `${model.name} ${modelLabel(model)} ${providers.find(p => p.id === model.providerId)?.name}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="control-popover" ref={root} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}><button ref={trigger} className="model-control" aria-label={selected ? modelLabel(selected) : "Choisir un modèle"} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setQuery(""); setOpen(!open); }}><span title={selected?.name}>{selected ? modelLabel(selected) : "Choisir un modèle"}</span><span className={`model-ready-dot ${status}`} role="img" aria-label={statusLabel} title={statusLabel}/></button>
    {presence.mounted && <div className={`model-popover ${presence.closing ? "popover-closing" : ""}`} {...(presence.closing ? { inert: "" } : {})} aria-hidden={presence.closing || undefined} role="dialog" aria-label="Choisir un modèle"><label className="model-search"><Search size={15}/><input ref={input} aria-label="Rechercher un modèle" placeholder="Rechercher un modèle…" value={query} onChange={event => setQuery(event.target.value)}/></label><div className="model-results">{providers.filter(p => p.enabled).map(provider => { const group = filtered.filter(model => model.providerId === provider.id); return group.length ? <div className="model-group" key={provider.id}><p>{provider.name}<span>{provider.protocol === "ollama" ? "Local" : "API"}</span></p>{group.map(model => <button key={model.id} className={`model-option ${selected?.id === model.id ? "selected" : ""}`} onClick={() => { onSelect(model.id); setOpen(false); trigger.current?.focus(); }}><span title={model.name}>{modelLabel(model)}</span>{selected?.id === model.id && <Check size={14}/>}</button>)}</div> : null; })}{!filtered.length && <p className="popover-empty">{models.length ? "Aucun modèle correspondant." : "Ajoute un fournisseur pour choisir un modèle."}</p>}</div><button className="popover-footer" disabled={refreshing} onClick={async () => { setRefreshing(true); setRefreshError(""); try { await onRefresh(); } catch (error) { setRefreshError(error instanceof Error ? error.message : "Impossible d’actualiser les modèles Ollama."); } finally { setRefreshing(false); } }}>{refreshing ? "Détection…" : "Actualiser Ollama"}<RefreshCw size={14}/></button>{refreshError && <p className="popover-empty" role="status">{refreshError}</p>}<button className="popover-footer" onClick={() => { setOpen(false); onSettings(); }}>Gérer les modèles <Settings2 size={14}/></button></div>}
  </div>;
}
function SidebarAction({ icon, label, onClick, fxIndex, fxTotal }: { icon: SidebarIconName; label: string; onClick: () => void; fxIndex: number; fxTotal: number }) {
  const [hovered, setHovered] = useState(false);
  return <button className="fx" style={{ "--i": fxIndex, "--n": fxTotal } as React.CSSProperties} onClick={onClick} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}><SidebarIcon name={icon} active={hovered}/><span>{label}</span></button>;
}

function EffortSelector({ modelName, value, onSelect }: { modelName: string; value: Effort; onSelect: (value: Effort) => void }) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const levels = Object.keys(effortLabels) as Effort[];
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState(levels.indexOf(value));
  const valueRef = useRef(value); valueRef.current = value;
  const commit = (index: number) => { if (levels[index] !== valueRef.current) { valueRef.current = levels[index]; onSelect(levels[index]); } };
  useEffect(() => { if (!open) setPreview(levels.indexOf(value)); }, [value, open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div ref={root} className={`effort-picker ${value === "ultra" ? "ultra" : ""}`}>
    <button ref={trigger} className="effort-trigger toolbar-icon" aria-label="Niveau d’effort" title={`Effort : ${effortLabels[value]}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => { setPreview(levels.indexOf(value)); setOpen(!open); }}><span className="effort-visible-label">{effortLabels[value]}</span><ChevronDown size={13}/></button>
    {presence.mounted && <div data-level={preview} className={`effort-popover horizontal-effort ${preview === levels.length - 1 ? "ultra" : ""} ${presence.closing ? "popover-closing" : ""}`} {...(presence.closing ? { inert: "" } : {})} aria-hidden={presence.closing || undefined} role="dialog" aria-label="Choisir le niveau d’effort">
      <EffortSlider levels={levels.map(level => effortLabels[level])} value={preview} defaultIndex={1} onChange={index => { setPreview(index); commit(index); }}/>
      <span className="effort-model-name">{modelName}</span>
    </div>}
  </div>;
}

function FavoritesView({ onOpen }: { onOpen: (id: string, messageId: string) => void }) {
  const [items, setItems] = useState<{ conversation: Conversation; message: Message }[]>([]);
  useEffect(() => { void solarStore.listConversations().then(async conversations => { const groups = await Promise.all(conversations.map(async conversation => (await solarStore.listMessages(conversation.id)).filter(message => message.favorite).map(message => ({ conversation, message })))); setItems(groups.flat()); }); }, []);
  return <div className="settings-page"><h1>Réponses enregistrées</h1>{!items.length && <p className="settings-note">Enregistre une réponse depuis le chat pour la retrouver ici.</p>}{items.map(({ conversation, message }) => <div className="favorite-row" key={message.id}><button onClick={() => onOpen(conversation.id, message.id)}><strong>{conversation.title}</strong><span>{message.content.slice(0, 200)}</span></button><button className="icon-button" aria-label="Retirer la réponse enregistrée" onClick={async () => { await solarStore.saveMessage({ ...message, favorite: false }); setItems(items.filter(item => item.message.id !== message.id)); }}><X size={15}/></button></div>)}</div>;
}
function ExportPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [chosen, setChosen] = useState("all"); const [format, setFormat] = useState<"md" | "txt">("md"); const [notice, setNotice] = useState("");
  useEffect(() => { void solarStore.listConversations().then(setConversations); }, []);
  return <div className="export-panel"><h3>Exporter les conversations</h3><p>Messages et noms des modèles uniquement. Les chats temporaires et les clés sont exclus.</p><div><select aria-label="Conversation à exporter" value={chosen} onChange={event => setChosen(event.target.value)}><option value="all">Toutes les conversations</option>{conversations.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select><select aria-label="Format d’export" value={format} onChange={event => setFormat(event.target.value as "md" | "txt")}><option value="md">Markdown</option><option value="txt">Texte brut</option></select><Button variant="outline" className="small-button" disabled={!conversations.length} onClick={async () => { try { const entries = await Promise.all(conversations.filter(c => chosen === "all" || c.id === chosen).map(async conversation => ({ conversation, messages: await solarStore.listMessages(conversation.id) }))); const saved = await saveExport(exportConversations(entries, format), format); setNotice(saved ? "Export préparé." : "Export annulé."); } catch { setNotice("L’export a échoué. Réessaie ou vérifie les droits du dossier choisi."); } }}>Exporter</Button></div>{notice && <p role="status">{notice}</p>}</div>;
}

function SettingsView({ providers, models, settings, updateSettings, reload, workBridge, onBack, clearHistory }: { providers: Provider[]; models: Model[]; settings: AppSettings; updateSettings: (next: AppSettings) => Promise<void>; reload: () => Promise<void>; workBridge: React.MutableRefObject<WorkBridge|null>; onBack: () => void; clearHistory: () => Promise<void> }) {
  const [section, setSection] = useState<SettingsSection>("appearance"); const [editing, setEditing] = useState<FormState | null>(null); const [error, setError] = useState("");
  const [pendingFolder,setPendingFolder]=useState<NonNullable<Awaited<ReturnType<WorkBridge["chooseDefaultProject"]>>>|null>(null);const [folderBusy,setFolderBusy]=useState(false);const [folderError,setFolderError]=useState("");
  const [,setFolderRevision]=useState(0);useEffect(()=>{const refresh=()=>setFolderRevision(value=>value+1);window.addEventListener("solar-default-folder-change",refresh);return()=>window.removeEventListener("solar-default-folder-change",refresh);},[]);
  useEffect(()=>{if(!error)return;const timer=window.setTimeout(()=>setError(""),3000);return()=>window.clearTimeout(timer);},[error]);
  useEffect(()=>{if(!folderError)return;const timer=window.setTimeout(()=>setFolderError(""),3000);return()=>window.clearTimeout(timer);},[folderError]);
  const sections: [SettingsSection, string][] = [["appearance", "Apparence"], ["providers", "Fournisseurs"], ["account", "Compte"], ["web","Solar Web"],["performance","Performance"], ["models", "Modèles"], ["storage", "Stockage"], ["preferences", "Préférences"]];
  const saveSettings = async (next: AppSettings) => { try { await updateSettings(next); setError(""); } catch { setError("Impossible d’enregistrer les préférences. Vérifie le stockage disponible."); } };
  const sectionIcons = { web:Globe,performance:SlidersHorizontal,providers: KeyRound, account: UserRound, models: Blocks, appearance: Sun, storage: Database, preferences: Settings2 };
  return <div className="settings-page settings-expanded"><div className="settings-layout"><aside className="settings-menu"><div className="settings-menu-head"><h1>Paramètres</h1><Button variant="ghost" className="back-button" onClick={onBack} title="Retour au chat"><ArrowLeft size={15}/> Retour au chat</Button></div><p className="settings-category">Personnel</p><nav className="settings-nav" aria-label="Sections des paramètres">{sections.map(([id, name]) => { const Icon = sectionIcons[id]; return <Button variant="ghost" key={id} className={section === id ? "selected" : ""} aria-current={section === id ? "page" : undefined} onClick={() => { setSection(id); setEditing(null); }}><Icon size={20}/><span>{name}</span></Button>; })}</nav></aside><div className="settings-content" key={section}>

    {section === "providers" && <><div className="section-title"><div><h2>Fournisseurs</h2><p>Connecte une API compatible. Les modèles locaux Solar se téléchargent dans Modèles.</p></div>{!editing && <Button variant="outline" className="small-button" onClick={() => setEditing({ ...emptyForm })}><Plus size={15}/> Ajouter</Button>}</div>{editing ? <ProviderForm key={editing.id ?? "new"} initial={editing} onDone={async () => { await reload(); setEditing(null); }} onCancel={() => setEditing(null)}/> : <ProviderList providers={providers.filter(provider=>provider.id!=="solar:local-runtime")} models={models.filter(model=>model.providerId!=="solar:local-runtime")} setEditing={setEditing} reload={reload}/>}</>}
    {section === "web" && <WebSettingsPanel settings={settings} onSave={saveSettings}/>}
    {section === "performance" && <PerformancePanel settings={settings} models={models} onSave={saveSettings}/>}
    {section === "appearance" && <AppearancePanel settings={settings} onSave={saveSettings}/>}

    {section === "account" && <><div className="section-title"><div><h2>Compte</h2><p>Connecte-toi ou crée ton compte Solar.</p></div><span className={`account-service-state ${authClient ? "ready" : "missing"}`}>{authClient ? "Service configuré" : "Configuration requise"}</span></div><AccountDialog embedded open={false} onClose={()=>{}}/><div className="account-setup-note"><h3>À propos de tes données</h3><p>Le compte gère ton identité et ta session. Les conversations et le dossier que tu choisis restent enregistrés localement sur cet appareil ; ils ne sont pas synchronisés dans le cloud.</p><p>La connexion utilise Supabase Auth par e-mail et mot de passe. La confirmation d’adresse et la récupération du mot de passe dépendent des réglages d’e-mail et des URL de retour du projet.</p></div></>}

    {section === "models" && <><SolarModelCatalog models={models} reload={reload}/><div className="settings-model-separator"><span>Modèles des fournisseurs connectés</span></div>{models.filter(model=>model.providerId!=="solar:local-runtime").length ? providers.filter(provider=>provider.id!=="solar:local-runtime").map(provider => { const list = models.filter(model => model.providerId === provider.id); return list.length ? <div className="settings-model-group" key={provider.id}><h3>{provider.name}</h3>{list.map(model => <div className="settings-model-row" key={model.id}><div><strong title={model.name}>{modelLabel(model)}</strong><p>{model.available === false ? "Modèle supprimé ou indisponible" : model.source === "manual" ? "Ajouté manuellement" : model.capabilities.includes("solar-code-recommended") ? "Téléchargé · recommandé pour Solar Code" : "Détecté auprès du fournisseur"}</p></div><label className="toggle-label"><input type="checkbox" checked={model.enabled} onChange={async event => { await solarStore.saveModel({ ...model, enabled: event.target.checked }); await reload(); }}/><span>Disponible</span></label><button className="icon-button" aria-label={`Supprimer le modèle ${model.name}`} onClick={async () => { await solarStore.deleteModel(model.id); await reload(); }}><Trash2 size={15}/></button></div>)}</div> : null; }) : <p className="settings-note">Aucun modèle d’API ajouté. Tu peux ajouter un fournisseur dans la section Fournisseurs.</p>}</>}
    {section === "storage" && <><ExportPanel/><div className="section-title"><div><h2>Stockage</h2><p>Garde le contrôle sur ce que Solar conserve.</p></div></div><div className="preference-row default-workspace-row"><div><h3>Dossier du chat normal</h3><p>{workBridge.current?.defaultProject()?`Dossier validé : ${workBridge.current.defaultProject()!.name}. Solar l’utilise pour les questions sur tes fichiers. Les fichiers pertinents sont transmis au modèle lorsque tu les évoques.`:"Choisis un dossier puis valide-le une seule fois. Le chemin reste enregistré. En validant, tu autorises l’envoi des extraits pertinents au modèle lorsque ta demande porte sur ce dossier; le chat normal ne modifie pas ses fichiers."}</p>{pendingFolder&&<p className="folder-pending">Dossier sélectionné : {pendingFolder.name}</p>}{folderError&&<p className="form-error" role="alert">{folderError}</p>}</div><div className="folder-actions"><Button variant="outline" className="small-button" disabled={folderBusy} onClick={async()=>{setFolderBusy(true);setFolderError("");try{setPendingFolder(await workBridge.current?.chooseDefaultProject()??null);}catch(e){setFolderError(e instanceof Error?e.message:"Impossible de choisir ce dossier.");}finally{setFolderBusy(false);}}}>{folderBusy?"Ouverture…":"Choisir un dossier"}</Button>{pendingFolder&&<Button className="small-button" disabled={folderBusy} onClick={async()=>{setFolderBusy(true);setFolderError("");try{if(!workBridge.current)throw new Error("Le service de dossiers n’est pas prêt.");await workBridge.current.confirmDefaultProject(pendingFolder);setPendingFolder(null);}catch(e){setFolderError(e instanceof Error?e.message:"Impossible de valider ce dossier.");}finally{setFolderBusy(false);}}}>Valider</Button>}{workBridge.current?.defaultProject()&&<Button variant="ghost" className="small-button" disabled={folderBusy} onClick={async()=>{try{await workBridge.current?.clearDefaultProject();setPendingFolder(null);setFolderError("");}catch(e){setFolderError(e instanceof Error?e.message:"Impossible de retirer ce dossier.");}}}>Retirer</Button>}</div></div><div className="preference-row"><div><h3>Conversations</h3><p>Enregistrées localement avec leurs messages et brouillons, puis restaurées à la réouverture de Solar.</p></div><Button variant="outline" className="small-button" onClick={() => void clearHistory()}>Effacer</Button></div><div className="preference-row"><div><h3>Fournisseurs et clés</h3><p>Conservés sur ce navigateur et à cette adresse. L’application macOS utilise le Trousseau pour les clés ; l’aperçu web utilise le stockage du navigateur.</p></div></div></>}
    {section === "preferences" && <><div className="section-title"><div><h2>Préférences</h2><p>Les petits détails qui rendent le chat plus naturel.</p></div></div><div className="preference-row"><div><h3>Solar Smart</h3><p>Adapte les consignes à la demande, sans changer ton modèle ni ton effort. Les artefacts explicitement demandés restent disponibles.</p></div><input aria-label="Activer Solar Smart" type="checkbox" checked={settings.smart!==false} onChange={e=>void saveSettings({...settings,smart:e.target.checked})}/></div><div className="preference-row"><div><h3>Pipeline pour les fournisseurs en ligne</h3><p>Par défaut, les étapes de raisonnement supplémentaires s’appliquent uniquement à Ollama. Active cette option pour les utiliser aussi avec les fournisseurs en ligne.</p></div><input aria-label="Activer le pipeline pour les fournisseurs en ligne" type="checkbox" checked={settings.pipelineOnline===true} onChange={e=>void saveSettings({...settings,pipelineOnline:e.target.checked})}/></div><div className="preference-row"><div><h3>Envoyer avec Entrée</h3><p>Maj + Entrée ajoute toujours une nouvelle ligne.</p></div><input aria-label="Envoyer avec Entrée" type="checkbox" checked={settings.sendOnEnter !== false} onChange={event => void saveSettings({ ...settings, sendOnEnter: event.target.checked })}/></div><div className="preference-row"><div><h3>Modèle par défaut</h3><p>Pour la première conversation. Les suivantes reprennent ton dernier choix.</p></div><select aria-label="Modèle par défaut" value={settings.defaultModelId ?? ""} onChange={event => void saveSettings({ ...settings, defaultModelId: event.target.value || undefined })}><option value="">Choisir dans le chat</option>{models.filter(m => m.enabled).map(model => <option key={model.id} value={model.id}>{modelLabel(model)}</option>)}</select></div><div className="preference-row"><div><h3>Niveaux d’effort</h3><p>Faible : réponse directe. Moyen : plan court. Élevé : étapes et relecture. Ultra : comparaison de brouillons et critique finale.</p></div></div></>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div></div></div>;
}

function ProviderList({ providers, models, setEditing, reload }: { providers: Provider[]; models: Model[]; setEditing: (value: FormState) => void; reload: () => Promise<void> }) {
  return providers.length ? <div className="provider-list">{providers.map(provider => <ProviderCard key={provider.id} provider={provider} models={models.filter(model => model.providerId === provider.id)} setEditing={setEditing} reload={reload}/>)}</div> : <div className="empty-card"><KeyRound size={23}/><h3>Ton premier fournisseur commence ici.</h3><p>Connecte GonkaRouter ou une autre API compatible. Les modèles locaux Solar se trouvent dans Modèles.</p></div>;
}
function ProviderCard({ provider, models, setEditing, reload }: { provider: Provider; models: Model[]; setEditing: (value: FormState) => void; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<"test" | "refresh" | null>(null); const [notice, setNotice] = useState(""); const [manual, setManual] = useState(""); const [failed, setFailed] = useState(false);
  const run = async (kind: "test" | "refresh") => {
    setBusy(kind); setNotice(""); setFailed(false);
    try {
      await solarStore.saveProvider({ ...provider, connectionState: "testing" }); await reload();
      if (provider.protocol === "ollama") {
        const status = await inspectOllama("http://127.0.0.1:11434");
        if (!status.supported) throw new ProviderError("La connexion Ollama nécessite l’application Solar pour macOS.", "unavailable");
        if (!status.running) throw new ProviderError(status.error || "Ollama ne répond pas sur l’adresse locale. Démarre Ollama puis relance la détection.", "unavailable");
        const found = status.models.map(name => ({ id: `${provider.id}:${name}`, providerId: provider.id, providerModelId: name, name, capabilities: [], source: "remote" as const, enabled: true }));
        await reconcileModels(provider, found);
        setNotice(kind === "test" ? "Connexion Ollama réussie." : `${found.length} modèle${found.length > 1 ? "s" : ""} détecté${found.length > 1 ? "s" : ""}.`);
      } else if (kind === "test") { await providerApi.test(provider, secretVault); setNotice("Connexion réussie."); }
      else { const found = await providerApi.discoverModels(provider, secretVault); await reconcileModels(provider, found); setNotice(`${found.length} modèle${found.length > 1 ? "s" : ""} détecté${found.length > 1 ? "s" : ""}.`); }
      await solarStore.saveProvider({ ...provider, connectionState: "connected", lastError: undefined });
    } catch (reason) { const message = reason instanceof ProviderError ? reason.message : "Impossible d’enregistrer ou de joindre le fournisseur."; setNotice(message); setFailed(true); await solarStore.saveProvider({ ...provider, connectionState: "error", lastError: message }).catch(() => {}); }
    finally { setBusy(null); await reload(); }
  };
  const remove = async () => { if (!window.confirm(`Supprimer ${provider.name} et sa clé enregistrée ?`)) return; try { if (await secretVault.get(provider.secretRef)) await secretVault.delete(provider.secretRef); await solarStore.deleteProvider(provider.id); await reload(); } catch { setFailed(true); setNotice("Impossible de supprimer le fournisseur ou sa clé."); } };
  const addManual = async () => { const id = manual.trim(); if (!id) return; try { await solarStore.saveModel({ id: `${provider.id}:${id}`, providerId: provider.id, providerModelId: id, name: id, capabilities: [], source: "manual", enabled: true }); setManual(""); await reload(); setFailed(false); setNotice("Modèle ajouté."); } catch { setFailed(true); setNotice("Impossible d’enregistrer le modèle."); } };
  const stateLabel = { connected: "Connecté", error: "Connexion en erreur", testing: "Test en cours", unknown: "Connexion à tester" }[provider.connectionState];
  return <article className="provider-card"><div className="provider-head"><div><h3 className="provider-name">{provider.name}<span className={`status-dot ${provider.connectionState}`} aria-label={stateLabel} title={stateLabel}/></h3><p className="provider-meta">{provider.protocol === "ollama" ? "Connexion locale automatique" : provider.baseUrl}</p></div><div className="card-actions"><Button variant="outline" className="small-button" onClick={() => setEditing({ id: provider.id, name: provider.name, baseUrl: provider.baseUrl, protocol: provider.protocol, secret: "" })}>Modifier</Button><button className="icon-button" onClick={() => void remove()} aria-label={`Supprimer ${provider.name}`}><Trash2 size={15}/></button></div></div><p className="muted">{models.length} modèle{models.length > 1 ? "s" : ""} · {provider.protocol === "ollama" ? "Local" : "API compatible"}</p><div className="provider-tools"><Button variant="outline" className="small-button" onClick={() => void run("test")} disabled={Boolean(busy)}>{busy === "test" ? "Test en cours…" : "Tester la connexion"}</Button><Button variant="outline" className="small-button" onClick={() => void run("refresh")} disabled={Boolean(busy)}><RefreshCw size={14} className={busy === "refresh" ? "spinning" : ""}/>{busy === "refresh" ? "Actualisation…" : "Actualiser les modèles"}</Button></div>{provider.protocol === "ollama" && <OllamaHealthCard provider={provider} reload={reload}/>}<div className="manual-add"><input aria-label={`Identifiant de modèle pour ${provider.name}`} value={manual} onChange={event => setManual(event.target.value)} placeholder="Identifiant du modèle" onKeyDown={event => { if (event.key === "Enter") void addManual(); }}/><Button variant="outline" className="small-button" onClick={() => void addManual()} disabled={!manual.trim()}>Ajouter un modèle</Button></div>{notice && <p className={failed ? "form-error" : "notice"} role={failed ? "alert" : "status"}>{notice}</p>}</article>;
}

function OllamaHealthCard({ provider, reload }: { provider: Provider; reload: () => Promise<void> }) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"start" | "pull" | "refresh" | null>(null);
  const [pullOpen, setPullOpen] = useState(false);
  const [modelName, setModelName] = useState("");
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  refreshRef.current = async () => {
    setError("");
    try {
      const next = await inspectOllama(provider.baseUrl);
      setStatus(next);
      const refreshedProvider = {
        ...provider,
        ...(next.supported ? { baseUrl: "http://127.0.0.1:11434" } : {}),
        connectionState: next.running ? "connected" as const : next.supported ? "error" as const : provider.connectionState,
        lastError: next.running ? undefined : next.supported ? next.error ?? "Ollama ne répond pas sur l’adresse locale." : provider.lastError,
      };
      if (next.supported) await solarStore.saveProvider(refreshedProvider);
      if (next.running) {
        await reconcileModels(refreshedProvider, next.models.map(name => ({ id: `${provider.id}:${name}`, providerId: provider.id, providerModelId: name, name, capabilities: [], source: "remote" as const, enabled: true })));
      }
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Échec de la détection Ollama.");
    }
  };

  const refresh = async () => {
    setBusy("refresh");
    try { await refreshRef.current(); }
    finally { setBusy(null); }
  };

  useEffect(() => {
    void refreshRef.current();
    const onFocus = () => void refreshRef.current();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (!status?.running && status?.supported !== false) void refreshRef.current();
    }, 5000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
  }, [provider.id, provider.baseUrl, status?.running, status?.supported]);

  const download = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modelName.trim()) return;
    setBusy("pull"); setError(""); setProgress(null);
    const controller = new AbortController();
    try {
      await pullModel(provider.baseUrl, modelName.trim(), controller.signal, setProgress);
      setModelName(""); setPullOpen(false); await refreshRef.current();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Le téléchargement Ollama a échoué.");
    } finally { setBusy(null); }
  };

  const start = async () => {
    setBusy("start"); setError("");
    try { await startOllama(); await refreshRef.current(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de démarrer Ollama."); }
    finally { setBusy(null); }
  };

  const title = !status?.supported ? "Détection native requise"
    : status.running && !status.models.length ? "Ollama actif, aucun modèle"
      : status.running ? `Ollama actif, ${status.models.length} modèle${status.models.length > 1 ? "s" : ""}`
        : status.installed ? "Ollama installé mais arrêté" : "Ollama non installé";

  return <section className="ollama-health" aria-label="État d’Ollama">
    <div className="ollama-health-head"><div><span className={`ollama-state-dot ${status?.running ? "active" : ""}`}/><strong role="status">{title}</strong>{status?.version && <small>Version {status.version}</small>}</div><Button variant="outline" className="small-button ollama-detect-button" onClick={() => void refresh()} disabled={busy !== null}><RefreshCw size={14} className={busy === "start" || busy === "refresh" ? "spinning" : ""}/>{busy === "refresh" ? "Actualisation…" : "Actualiser Ollama"}</Button></div>
    {status?.running && status.loaded_models.length > 0 && <p className="ollama-loaded">En mémoire : {status.loaded_models.join(", ")}</p>}
    {status && !status.running && status.downloaded_models.length > 0 && <div className="ollama-cached" aria-label="Modèles téléchargés"><small>Modèles téléchargés · démarrer Ollama pour les utiliser</small>{status.downloaded_models.map(name => <span key={name}>{name}<em>Ollama doit démarrer</em></span>)}</div>}
    {status?.supported && !status.running && status.installed && <Button variant="outline" className="small-button" disabled={busy !== null} onClick={() => void start()}>{busy === "start" ? "Démarrage…" : "Démarrer Ollama"}</Button>}
    {status?.supported && status.running && (!status.models.length || pullOpen) && <form className="ollama-pull" onSubmit={event => void download(event)}><label><span>{status.models.length ? "Télécharger un autre modèle" : "Télécharger un modèle"}</span><input value={modelName} onChange={event => setModelName(event.target.value)} placeholder="Ex. qwen3.5:4b" aria-label="Nom du modèle Ollama" disabled={busy !== null}/></label><Button variant="outline" className="small-button" type="submit" disabled={busy !== null || !modelName.trim()}>{busy === "pull" ? "Téléchargement…" : "Télécharger"}</Button>{status.models.length > 0 && <button type="button" className="text-button" onClick={() => setPullOpen(false)}>Fermer</button>}</form>}
    {status?.supported && status.running && status.models.length > 0 && !pullOpen && <button type="button" className="text-button ollama-more" onClick={() => setPullOpen(true)}>Télécharger un modèle</button>}
    {busy === "pull" && progress && <div className="ollama-progress"><span>{progress.status}</span>{progress.total ? <progress max={progress.total} value={progress.completed ?? 0}/> : <span className="ollama-indeterminate"/>}</div>}
    {status?.error && <><p className="ollama-health-note">{status.running ? "Ollama répond, mais certaines informations sont indisponibles." : "Solar n’arrive pas à joindre l’URL Ollama configurée. Vérifie que le serveur est démarré."}</p><details className="ollama-technical"><summary>Détail technique</summary><code>{status.error}</code></details></>}
    {error && <details className="ollama-technical" open><summary role="alert">Erreur — détail technique</summary><code>{error}</code></details>}
    {status && !status.supported && <a className="text-button ollama-download-link" href="https://ollama.com/download/mac" target="_blank" rel="noreferrer">Installer Ollama pour macOS</a>}
  </section>;
}

function ProviderForm({ initial, onDone, onCancel }: { initial: FormState; onDone: () => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [stored, setStored] = useState(false);
  const [checking, setChecking] = useState(Boolean(initial.id));
  const [replace, setReplace] = useState(!initial.id);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [detectingOllama, setDetectingOllama] = useState(false);
  const [ollamaError, setOllamaError] = useState("");

  useEffect(() => {
    let live = true;
    if (initial.id) void (async () => {
      try {
        const provider = (await solarStore.listProviders()).find(item => item.id === initial.id);
        const exists = provider ? Boolean(await secretVault.get(provider.secretRef)) : false;
        if (live) { setStored(exists); setReplace(!exists); }
      } catch { if (live) setError("Impossible de vérifier la clé enregistrée."); }
      finally { if (live) setChecking(false); }
    })();
    return () => { live = false; };
  }, [initial.id]);

  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const detectOllama = async () => {
    setDetectingOllama(true);
    setOllamaError("");
    try {
      const status = await inspectOllama("http://127.0.0.1:11434");
      setOllamaStatus(status);
      if (!status.supported) setOllamaError("La détection nécessite l’application Solar pour macOS.");
      else if (status.error && !status.running) setOllamaError(status.error);
    } catch (reason) {
      setOllamaError(reason instanceof Error ? reason.message : "La détection Ollama a échoué.");
    } finally { setDetectingOllama(false); }
  };

  const save = async () => {
    if (checking || saving) return;
    const baseUrl = form.protocol === "ollama" ? "http://127.0.0.1:11434" : form.baseUrl;
    const issue = validateProviderInput(form.name, baseUrl, form.secret || (stored && !replace ? "stored" : ""), form.protocol);
    if (issue) { setError(issue); return; }
    setSaving(true); setError("");
    try {
      const old = form.id ? (await solarStore.listProviders()).find(item => item.id === form.id) : undefined;
      const id = form.id ?? crypto.randomUUID();
      const secretRef = old?.secretRef ?? `provider:${id}`;
      if (form.secret.trim() && replace) await secretVault.set(secretRef, form.secret.trim());
      const savedProvider: Provider = { id, name: form.name.trim(), baseUrl: baseUrl.trim().replace(/\/$/, ""), protocol: form.protocol, secretRef, enabled: true, connectionState: ollamaStatus?.running && form.protocol === "ollama" ? "connected" : "unknown" };
      await solarStore.saveProvider(savedProvider);
      if (form.protocol === "ollama" && ollamaStatus?.running) {
        await reconcileModels(savedProvider, ollamaStatus.models.map(name => ({ id: `${id}:${name}`, providerId: id, providerModelId: name, name, capabilities: [], source: "remote" as const, enabled: true })));
      }
      await onDone();
    } catch { setError("La configuration n’a pas pu être enregistrée. Vérifie le stockage du navigateur ou l’accès au Trousseau."); }
    finally { setSaving(false); }
  };

  const ollamaLabel = !ollamaStatus?.supported ? "Détection disponible dans l’app macOS"
    : ollamaStatus.running && !ollamaStatus.models.length ? "Ollama actif · aucun modèle"
      : ollamaStatus.running ? `Ollama actif · ${ollamaStatus.models.length} modèle${ollamaStatus.models.length > 1 ? "s" : ""}`
        : ollamaStatus.installed ? "Ollama installé mais arrêté" : "Ollama non installé";

  return <form className="form-card" onSubmit={event => { event.preventDefault(); void save(); }}>
    <div className="form-head"><h3>{form.id ? "Modifier le fournisseur" : "Ajouter le fournisseur"}</h3><button type="button" className="icon-button" onClick={onCancel} aria-label="Fermer"><X size={18}/></button></div>
    <label>Nom<input value={form.name} onChange={event => update("name", event.target.value)} autoFocus placeholder="GonkaRouter"/></label>
    <label>Protocole<select value={form.protocol} onChange={event => setForm(current => ({ ...current, protocol: event.target.value as Provider["protocol"], baseUrl: event.target.value === "ollama" ? (current.baseUrl || "http://127.0.0.1:11434") : current.protocol === "ollama" && current.baseUrl === "http://127.0.0.1:11434" ? "" : current.baseUrl }))}><option value="openai-compatible">API compatible OpenAI</option><option value="ollama" disabled>Ollama · Bientôt</option><option value="anthropic">Anthropic</option></select></label>
    {form.protocol === "ollama" ? <div className="ollama-config-check">
      <Button type="button" variant="outline" className="small-button ollama-detect-button" disabled={detectingOllama} onClick={() => void detectOllama()}><RefreshCw size={14} className={detectingOllama ? "spinning" : ""}/>{detectingOllama ? "Détection en cours…" : "Lancer la détection"}</Button>
      {ollamaStatus && <p className="ollama-config-status" role="status">{ollamaLabel}{ollamaStatus.version ? ` · version ${ollamaStatus.version}` : ""}{ollamaStatus.running && ollamaStatus.models.length > 0 ? ` · ${ollamaStatus.models.join(", ")}` : ""}</p>}
      {ollamaError && <p className="form-error" role="alert">{ollamaError}</p>}
      {ollamaStatus?.error && <details className="ollama-technical"><summary>Détail technique</summary><code>{ollamaStatus.error}</code></details>}
    </div> : <label>URL de base<input value={form.baseUrl} onChange={event => update("baseUrl", event.target.value)} inputMode="url" placeholder="https://api.gonkarouter.io/v1"/></label>}
    {form.protocol !== "ollama" && <><label>Clé API<input type="password" autoComplete="new-password" value={stored && !replace ? "configured" : form.secret} readOnly={checking || (stored && !replace)} aria-label={stored && !replace ? "Clé API configurée" : "Clé API"} onChange={event => update("secret", event.target.value)} placeholder={checking ? "Vérification…" : "Clé du fournisseur"}/></label>{stored && <div className="key-state"><span><Check size={14}/> Clé enregistrée</span><button type="button" className="text-button" onClick={() => { setReplace(!replace); update("secret", ""); }}>{replace ? "Conserver la clé" : "Remplacer"}</button></div>}<p className="settings-note">La clé reste masquée. Dans l’aperçu web, elle est conservée dans le stockage de ce navigateur ; dans l’app macOS, dans le Trousseau.</p></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><Button type="button" variant="outline" className="small-button" onClick={onCancel}>Annuler</Button><Button type="submit" className="primary-button" disabled={saving || checking}>{saving ? "Enregistrement…" : "Enregistrer"}</Button></div>
  </form>;
}
