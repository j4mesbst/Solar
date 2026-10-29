import {TeamConfigurationControls} from '../components/setup/TeamConfigurationControls';
import {MessengerOnboarding} from '../components/setup/MessengerOnboarding';
import {AgentRoster} from '../components/team/AgentRoster';
import {AgentDetails} from '../components/team/AgentDetails';
import {ApplicationGallery} from '../components/team/ApplicationGallery';
import {roleSummary} from '../services/agentPresentation';
import {latestFinishedReply} from '../services/agentReadState';
import {useSidebarMotion} from '../components/team/useSidebarMotion';
import {AccountPopover} from '../components/team/AccountPopover';
import {SettingsWindow} from '../components/team/SettingsWindow';
import {TeamModelsPage} from '../components/team/ModelsPage';
import {prepareRoleSuggestions} from '../services/teamSuggestions';
import {TeamAccountPage,TeamUsagePage} from '../components/team/AccountPages';
import {prepareContinuations} from '../services/continuationSuggestions';
import {ContinuationSuggestion} from '../components/team/ContinuationSuggestion';
import {RoleSuggestions} from '../components/team/RoleSuggestions';
import {BlocksIcon} from '../components/ui/animated-account-icons';
import {UpdateButton} from '../components/team/UpdateButton';
import {PluginConnectionDialog} from '../components/ui/plugin-connection-dialog';
import {pluginInfo} from '../services/pluginCatalog';
import {AgentAutomationRunner} from "../components/ui/agent-automation-runner";
import{lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState,type CSSProperties}from'react';
import{ArrowUpRight,ChevronDown,PanelLeft,Plus,Search,UserRound}from'lucide-react';
import type{AppSettings,Conversation,Model,Provider}from'../domain/types';
import{solarStore}from'../services/store';
import{solarAgentStore,type AgentData,type MascotId}from'../services/solarAgentStore';
import {developAgentRole} from '../services/developAgentRole';
import{teamCloud}from'../services/teamCloud';
import{appearanceStyle,contrastText,paletteFor}from'../services/appearance';
import{resolveTheme,nextThemeBoundary}from'../services/theme';
import{scopedKey}from'../services/accountScope';
import{authClient}from'../services/auth';
import{AgentMascot,mascotColor}from'../components/team/AgentMascot';
import{AgentProfileDialog}from'../components/team/AgentProfileDialog';
import{AtlasScreen}from'../components/atlas/AtlasScreen';
import{AccessModeSelect}from'../components/ui/access-mode-select';
import{ToolApprovalDialog}from'../components/ui/tool-approval-dialog';
import{AccountDialog}from'../components/ui/account-dialog';
import'../settings-premium.css';import'../styles/conversation-context.css';import'../styles/team.css';import'../styles/apple.css';import'../styles/agent-messenger.css';
const Plugins=lazy(()=>import('../components/ui/extension-directory').then(m=>({default:m.ExtensionDirectory})));
type View='agents'|'plugins'|'models'|'usage'|'account'|'logout';
export function AgentApp(){
 const[data,setData]=useState<AgentData>(),[providers,setProviders]=useState<Provider[]>([]),[models,setModels]=useState<Model[]>([]),[settings,setSettings]=useState<AppSettings>({theme:'dark'}),[conversations,setConversations]=useState<Conversation[]>([]),[view,setView]=useState<View>('agents'),[query,setQuery]=useState(''),[create,setCreate]=useState(false),[editing,setEditing]=useState<string>(),[error,setError]=useState(''),[accountOpen,setAccountOpen]=useState(false),[email,setEmail]=useState(''),[signingOut,setSigningOut]=useState(false),[theme,setTheme]=useState<'light'|'dark'>('dark'),[visited,setVisited]=useState<string[]>([]),[busy,setBusy]=useState<Record<string,boolean>>({});
 const[collapsed,setCollapsed]=useState(()=>{try{return innerWidth<760||localStorage.getItem(scopedKey('solar.team.sidebar'))==='closed';}catch{return innerWidth<760;}});
 const[setupOpen,setSetupOpen]=useState(false),[setupDismissed,setSetupDismissed]=useState(false);
 const[continuationRevision,setContinuationRevision]=useState(0);
 useEffect(()=>{const refresh=()=>setContinuationRevision(v=>v+1);window.addEventListener('solar-continuations-changed',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('solar-continuations-changed',refresh);window.removeEventListener('focus',refresh);};},[]);
 const continuations=useMemo(()=>data?prepareContinuations(data):new Map(),[data,continuationRevision]);
 const[connecting,setConnecting]=useState<string>();
 const[searchOpen,setSearchOpen]=useState(false),[details,setDetails]=useState<string>(),[gallery,setGallery]=useState(false);
 const requestedSelection=useRef<string>(),busyFlags=useRef(new Map<string,boolean>());
 const mainRef=useRef<HTMLElement>(null),sidebarRef=useRef<HTMLElement>(null);
 useSidebarMotion(collapsed,mainRef,sidebarRef);
 useEffect(()=>{const connect=(e:Event)=>{const service=(e as CustomEvent).detail?.service;if(pluginInfo(service))setConnecting(service);};window.addEventListener('solar-team-connect',connect);return()=>window.removeEventListener('solar-team-connect',connect);},[]);
 useEffect(()=>{if(sidebarRef.current)sidebarRef.current.inert=collapsed||view!=='agents';},[collapsed,view]);
 useEffect(()=>{const visibility=()=>document.querySelector('.team-app')?.classList.toggle('is-document-hidden',document.hidden);visibility();document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
 useEffect(()=>{if(mainRef.current)mainRef.current.inert=innerWidth<760&&!collapsed&&view==='agents';},[collapsed,view]);
 useEffect(()=>{
  if(!(window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__)return;
  let frame=0,disposed=false;
  const align=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(()=>{
   const center=18;
   if(!disposed)void import('@tauri-apps/api/core').then(({invoke})=>!disposed&&invoke('window_align_header',{center})).catch(()=>{});
  });});};align();window.addEventListener('resize',align);window.addEventListener('focus',align);
  return()=>{disposed=true;cancelAnimationFrame(frame);window.removeEventListener('resize',align);window.removeEventListener('focus',align);};
 },[]);
 useEffect(()=>{const open=()=>{setView('agents');setSetupDismissed(false);setSetupOpen(true);};window.addEventListener('solar-setup-open',open);return()=>window.removeEventListener('solar-setup-open',open);},[]);
 const cancelRefs=useRef(new Map<string,React.MutableRefObject<((id?:string)=>void)|null>>());
 const reload=useCallback(async()=>{const[p,m,s,c]=await Promise.all([solarStore.listProviders(),solarStore.listModels(),solarStore.getSettings(),solarStore.listConversations()]);const cloud=teamCloud(p,m,s.agent?.defaultModelId);await solarAgentStore.ensureTeam({providerId:cloud?.provider.id??'',modelId:cloud?.model.id??''},c.map(item=>item.id));let next=await solarAgentStore.snapshot();if(next.manager&&!next.configurationNamesVersion)next=await solarAgentStore.normalizeConfigurationNames();if(requestedSelection.current&&next.team?.profiles.some(p=>p.agentId===requestedSelection.current))next.team.selected=requestedSelection.current;setProviders(p);setModels(m);setSettings(s);setConversations(c);setData(next);setVisited(old=>{const ids=old.filter(id=>next.team!.profiles.some(p=>p.agentId===id));return ids.length?ids:next.team!.selected?[next.team!.selected]:[];});},[]);
 useEffect(()=>{let live=true;void reload().catch(e=>{if(live)setError(e instanceof Error?e.message:'Impossible de restaurer Solar.');});void authClient?.auth.getSession().then(({data})=>{if(live)setEmail(data.session?.user.email??'');});return()=>{live=false;};},[reload]);
 useEffect(()=>{const changed=()=>void reload().catch(()=>setError('Impossible d’actualiser les agents.'));window.addEventListener('solar-plugins-changed',changed);window.addEventListener('solar-automations-changed',changed);window.addEventListener('solar-team-missions-updated',changed);return()=>{window.removeEventListener('solar-plugins-changed',changed);window.removeEventListener('solar-automations-changed',changed);window.removeEventListener('solar-team-missions-updated',changed);};},[reload]);
 useEffect(()=>{const refresh=()=>setTheme(resolveTheme(settings.theme));refresh();const timer=setTimeout(refresh,nextThemeBoundary());window.addEventListener('focus',refresh);return()=>{clearTimeout(timer);window.removeEventListener('focus',refresh);};},[settings.theme,theme]);
 useEffect(()=>{const media=matchMedia('(max-width:759px)');const change=()=>{if(media.matches)setCollapsed(true);};media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[]);
 useEffect(()=>{try{localStorage.setItem(scopedKey('solar.team.sidebar'),collapsed?'closed':'open');}catch{}},[collapsed]);
 useEffect(()=>{if(!data||!(window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__)return;void import('@tauri-apps/api/core').then(({invoke})=>invoke('background_mode_set',{enabled:settings.agent?.runInBackground===true})).catch(()=>setError('Le mode arrière-plan n’a pas pu être appliqué.'));},[!!data,settings.agent?.runInBackground]);
 const cloud=useMemo(()=>teamCloud(providers,models,settings.agent?.defaultModelId),[JSON.stringify(providers),JSON.stringify(models),settings.agent?.defaultModelId]);
 const cloudProviders=useMemo(()=>cloud?[cloud.provider]:[],[cloud]),cloudModels=useMemo(()=>cloud?[cloud.model]:[],[cloud]);
 const refs=(id:string)=>{if(!cancelRefs.current.has(id))cancelRefs.current.set(id,{current:null});return cancelRefs.current.get(id)!;};
 const go=(next:View)=>{setView(next);if(innerWidth<760)setCollapsed(true);};
 const select=useCallback(async(id:string)=>{window.dispatchEvent(new CustomEvent('solar-team-agent-selected',{detail:id}));requestedSelection.current=id;try{await solarAgentStore.selectTeamAgent(id);const next=await solarAgentStore.markTeamAgentRead(id);if(requestedSelection.current!==id)return;setData(next);setVisited(old=>old.includes(id)?old:[...old,id]);setView('agents');if(innerWidth<760)setCollapsed(true);}catch(e){setError(e instanceof Error?e.message:'Agent indisponible.');}},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(view!=='agents')return;if(e.key==='Escape'&&innerWidth<760){setCollapsed(true);return;}if(!(e.metaKey||e.ctrlKey))return;if(e.key==='b'){e.preventDefault();setCollapsed(v=>!v);}if(e.key==='n'){e.preventDefault();setCreate(true);}if(e.key==='k'){e.preventDefault();setSearchOpen(true);setCollapsed(false);setTimeout(()=>document.querySelector<HTMLInputElement>('.team-search input')?.focus(),0);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[view]);
 const saveSettings=async(next:AppSettings)=>{await solarStore.saveSettings(next);setSettings(next);};
 const teamIds=useMemo(()=>data?.team?.profiles.map(p=>p.agentId)??[],[data?.team?.profiles.map(p=>p.agentId).join(",")]);
 const modelOverride=useMemo(()=>cloud?{providerId:cloud.provider.id,modelId:cloud.model.id}:undefined,[cloud?.provider.id,cloud?.model.id]);
 const selected=data?.team?.selected;
 useEffect(()=>{if(data&&!setupDismissed&&!settings.onboardingComplete&&!data.team?.profiles.length)setSetupOpen(true);},[!!data,settings.onboardingComplete,data?.team?.profiles.length,setupDismissed]);
 const configuring=!!data&&!setupDismissed&&(setupOpen||(!settings.onboardingComplete&&!data.team?.profiles.length));
 const readingAgent=useRef<string>();readingAgent.current=view==='agents'&&!configuring&&!create&&!editing&&!accountOpen&&!connecting?selected:undefined;
 const acknowledgeVisible=useCallback(async()=>{
  const id=readingAgent.current;if(!id||document.hidden||!document.hasFocus()||busyFlags.current.get(id))return;
  const snapshot=await solarAgentStore.snapshot(),profile=snapshot.team?.profiles.find(p=>p.agentId===id),reply=latestFinishedReply(snapshot.missions,id);
  if(!profile||!reply||profile.lastReadMissionId===reply.id)return;
  await solarAgentStore.markTeamAgentRead(id);await reload();
 },[reload]);
 useEffect(()=>{void acknowledgeVisible().catch(()=>{});},[acknowledgeVisible,data,view,selected,busy[selected??''],create,editing,accountOpen,connecting]);
 useEffect(()=>{const read=()=>void acknowledgeVisible().catch(()=>{});window.addEventListener('focus',read);document.addEventListener('visibilitychange',read);return()=>{window.removeEventListener('focus',read);document.removeEventListener('visibilitychange',read);};},[acknowledgeVisible]);
 const editAgent=data?.agents.find(a=>a.id===editing),editProfile=data?.team?.profiles.find(p=>p.agentId===editing);
 const palette=paletteFor(settings,theme);
 const style={...appearanceStyle(settings,theme),'--team-bg':palette.background,'--team-side':palette.sidebar} as CSSProperties;
 const accountName=settings.profile?.name||email.split('@')[0]||'Mon compte';
 const rows=[...(data?.team?.profiles??[])].map(profile=>({profile,agent:data?.agents.find(a=>a.id===profile.agentId)!})).filter(row=>row.agent&&`${row.agent.name} ${row.profile.role??row.agent.description} ${roleSummary(row.profile.role??row.agent.description)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const dragWindow=(event:React.PointerEvent)=>{if(event.button!==0||!(window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__)return;const target=event.target as HTMLElement;if(!target.closest('[data-tauri-drag-region]')||target.closest('button,input,textarea,a,select,[role=tab]'))return;event.preventDefault();void import('@tauri-apps/api/window').then(({getCurrentWindow})=>getCurrentWindow().startDragging()).catch(()=>setError('Impossible de déplacer la fenêtre. Réessaie depuis le bord supérieur.'));};
 return <div onPointerDownCapture={dragWindow} className={`shell team-app ${collapsed?'sidebar-collapsed':''} `} data-theme={theme} data-native={Boolean((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__)} data-platform={/Win/i.test(navigator.platform)?"windows":"macos"} style={style}>
  <div className="team-window-dragbar" data-tauri-drag-region aria-hidden="true"/>
  {!collapsed&&view==='agents'&&<button className="team-mobile-scrim" aria-label="Fermer la barre latérale" onClick={()=>setCollapsed(true)}/>}
  <aside ref={sidebarRef} style={{transform:collapsed?'translate3d(-100%,0,0)':'translate3d(0,0,0)'}} className="team-sidebar" aria-label="Tes agents" aria-hidden={collapsed||undefined}>
   <div className="team-sidebar-top" data-tauri-drag-region><button className="team-icon-button team-drawer-close" aria-label="Fermer les agents" onClick={()=>setCollapsed(true)}><PanelLeft size={17}/></button><UpdateButton busy={Object.values(busy).some(Boolean)}/><button className="team-icon-button messenger-search-toggle" aria-label="Rechercher un agent" title={/Win/i.test(navigator.platform)?'Rechercher · Ctrl+K':'Rechercher · ⌘K'} aria-expanded={searchOpen} onClick={()=>{setSearchOpen(v=>!v);setTimeout(()=>document.querySelector<HTMLInputElement>('.team-search input')?.focus(),0);}}><Search size={18}/></button><button className="team-icon-button" aria-label="Créer un agent" title={/Win/i.test(navigator.platform)?'Créer un agent · Ctrl+N':'Créer un agent · ⌘N'} onClick={()=>setCreate(true)}><Plus size={21}/></button></div>
   <label className="team-search" hidden={!searchOpen&&!query}><Search size={17}/><input type="search" placeholder="Rechercher" aria-label="Rechercher un agent" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>{/Win/i.test(navigator.platform)?'Ctrl+K':'⌘K'}</kbd></label>
   <AgentRoster data={data} rows={rows} selected={view==='agents'?selected:undefined} busy={busy} reading={readingAgent.current} onSelect={id=>{setDetails(undefined);void select(id);}} onChange={setData} onError={setError}/>
   <div className="messenger-sidebar-footer"><AccountPopover settings={settings} email={email} onSelect={go}/><button className="messenger-plugin-trigger" aria-label="Connecter des applications" title="Plugins" onClick={()=>setGallery(true)}><BlocksIcon size={20}/></button></div>
  </aside>
  <main ref={mainRef} className={`team-main ${details?'has-agent-details':''}`}>
   {view==='agents'&&data&&!data.team?.profiles.length&&<div className="team-first-run"><header className="team-conversation-header" data-tauri-drag-region><button className="team-icon-button" aria-label={collapsed?'Afficher la barre latérale':'Masquer la barre latérale'} onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={19}/></button></header><button className="team-first-orbit" aria-label="Créer mon premier agent" onClick={()=>setCreate(true)}><AgentMascot kind="orbit" size={100} active/><span className="team-first-plus"><Plus size={20}/></span></button><h1>Ton premier agent.</h1><p>Un nom. Une mascotte. La suite se passe dans la conversation.</p><button className="team-primary-button" onClick={()=>setCreate(true)}>Créer mon agent<Plus size={17}/></button></div>}
   <div className="team-agent-stack" >{visited.map(id=>{const p=data?.team?.profiles.find(p=>p.agentId===id),a=data?.agents.find(a=>a.id===id);if(!p||!a)return null;return <div className="team-agent-frame" key={id} style={{'--agent-color':mascotColor(p.mascot,p.color),'--agent-on-color':contrastText(mascotColor(p.mascot,p.color))} as CSSProperties} hidden={selected!==id} onPointerDown={()=>{if(!busy[id]&&latestFinishedReply(data?.missions??[],id)?.id!==p.lastReadMissionId)void solarAgentStore.markTeamAgentRead(id).then(setData).catch(()=>{});}}><AtlasScreen active={selected===id} teamIdentity={{...p,agent:a,name:a.name,onRoleDefined:async role=>{await solarAgentStore.defineTeamAgent(id,{role});await reload();}}} header={<header className="team-conversation-header" data-tauri-drag-region><button className="team-icon-button" aria-label={collapsed?'Afficher la barre latérale':'Masquer la barre latérale'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={19}/></button><button className="team-active-identity" aria-label={`Réglages de ${a.name}`} aria-expanded={details===id} onClick={()=>setDetails(old=>old===id?undefined:id)}><AgentMascot color={p.color} kind={p.mascot} size={29} active busy={busy[id]}/><span>{a.name}</span><ChevronDown size={12}/></button></header>}
   continuationContent={<ContinuationSuggestion suggestion={continuations.get(id)} disabled={busy[id]} onSelect={suggestion=>window.dispatchEvent(new CustomEvent('solar-team-suggestion',{detail:{agentId:id,suggestion}}))}/>}
   suggestionsContent={<RoleSuggestions profile={p} provider={cloud?.provider} model={cloud?.model} disabled={busy[id]} onPrepared={reload} onSelect={suggestion=>window.dispatchEvent(new CustomEvent('solar-team-suggestion',{detail:{agentId:id,suggestion}}))}/>}
   cancelRef={refs(id)} conversationId={p.conversationId} onConversationChange={()=>void reload().catch(()=>setError('La liste des agents n’a pas pu être actualisée.'))} onBusyChange={value=>{setBusy(old=>old[id]===value?old:{...old,[id]:value});const was=busyFlags.current.get(id);busyFlags.current.set(id,value);if(was&&!value)void acknowledgeVisible().then(reload).catch(()=>{});}} providers={cloudProviders} models={cloudModels} settings={{...settings,agent:{...settings.agent,defaultModelId:undefined,defaultEffort:undefined}}} theme={theme} onBack={()=>{}} onPlugins={()=>go('plugins')} onSettings={()=>setEditing(id)}/></div>;})}</div>

   {details&&data&&(()=>{const profile=data.team?.profiles.find(p=>p.agentId===details),agent=data.agents.find(a=>a.id===details);return profile&&agent?<AgentDetails key={details} agent={agent} profile={profile} onClose={()=>{setDetails(undefined);document.querySelector<HTMLButtonElement>('.team-agent-frame:not([hidden]) .team-active-identity')?.focus();}} onEdit={()=>setEditing(details)} onAccess={mode=>{void solarAgentStore.saveAgent({...agent,accessMode:mode,updatedAt:new Date().toISOString()}).then(reload).catch(()=>setError('Impossible de modifier les autorisations.'));}} onRun={text=>{setDetails(undefined);window.dispatchEvent(new CustomEvent('solar-team-import-prompt',{detail:{agentId:agent.id,text,autoSend:true}}));}}/>:null;})()}

  </main>
   <SettingsWindow section={view==='agents'?undefined:view} onSelect={go} onClose={()=>setView('agents')}>{view==='plugins'?<Suspense fallback={<p>Ouverture des plugins…</p>}><Plugins pluginsOnly kind="plugins" settings={settings} updateSettings={saveSettings} onNavigate={()=>{}} onImport={async text=>{setView('agents');window.dispatchEvent(new CustomEvent('solar-team-import-prompt',{detail:{agentId:selected,text}}));}}/></Suspense>:view==='models'?<TeamModelsPage onChange={reload}/>:view==='usage'?<TeamUsagePage/>:view==='account'?<TeamAccountPage settings={settings} email={email} save={saveSettings} missions={data?.missions??[]}/>:<div className="team-logout"><UserRound size={30}/><h1>{email?'Tu pars déjà ?':'Ton compte Solar'}</h1><p>{email?`Tu es connecté avec ${email}. Tes conversations et tes agents restent conservés pour ta prochaine connexion.`:'Tu utilises actuellement Solar sur cet appareil. Connecte-toi pour retrouver ton compte.'}</p>{email?<button className="team-primary-button" disabled={signingOut} onClick={async()=>{if(!authClient)return;setSigningOut(true);setError('');try{for(const ref of cancelRefs.current.values())ref.current?.();const{error}=await authClient.auth.signOut({scope:'local'});if(error)throw error;}catch(e){setError(e instanceof Error?e.message:'Impossible de se déconnecter.');setSigningOut(false);}}}>{signingOut?'Déconnexion…':'Se déconnecter'}<ArrowUpRight size={16}/></button>:<button className="team-primary-button" onClick={()=>setAccountOpen(true)}>Se connecter</button>}</div>}</SettingsWindow>
  {error&&<div className="team-global-error" role="alert">{error}<button aria-label="Fermer l’erreur" onClick={()=>setError('')}>×</button></div>}
  <AgentProfileDialog onDevelop={cloud?(role,signal)=>developAgentRole(role,cloud.provider,cloud.model,signal):undefined} open={create} first={!data?.team?.profiles.length} onClose={()=>setCreate(false)} onSave={async(name,mascot,role,color)=>{const p=await solarAgentStore.createTeamAgent(name,mascot,{providerId:cloud?.provider.id??'',modelId:cloud?.model.id??''},role||undefined);if(color)await solarAgentStore.defineTeamAgent(p.agentId,{color});await reload();await select(p.agentId);}}/>
  <AgentProfileDialog onDevelop={cloud?(role,signal)=>developAgentRole(role,cloud.provider,cloud.model,signal):undefined} nameLocked={false} open={!!editing} onClose={()=>setEditing(undefined)} editing name={editAgent?.name} role={editProfile?.role??editAgent?.instructions} mascot={editProfile?.mascot} color={editProfile?.color} onSave={async(name,mascot,role,color)=>{if(!editing)return;await solarAgentStore.defineTeamAgent(editing,{name,mascot,role,color});await reload();const updated=(await solarAgentStore.snapshot()).team?.profiles.find(p=>p.agentId===editing);if(updated&&cloud)void prepareRoleSuggestions(updated,cloud.provider,cloud.model).then(reload).catch(()=>setError('Impossible de préparer les suggestions.'));window.dispatchEvent(new Event('solar-team-profile-updated'));}}>{editing===data?.manager?.agentId&&<TeamConfigurationControls/>}</AgentProfileDialog>
  {connecting&&<PluginConnectionDialog autoConnect id={connecting} onClose={()=>{const service=connecting;setConnecting(undefined);window.dispatchEvent(new CustomEvent('solar-connection-state',{detail:{service,state:'idle'}}));window.dispatchEvent(new CustomEvent('solar-team-connection-closed',{detail:{service}}));void reload();}} canImport={false} onImport={async()=>{}}/>}
  {data&&cloud&&!configuring&&<AgentAutomationRunner providers={cloudProviders} models={cloudModels} agentIds={teamIds} modelOverride={modelOverride} onReview={()=>{setView('agents');setEditing(selected);}}/>}
  {gallery&&<ApplicationGallery onClose={()=>setGallery(false)} onConnect={id=>{setGallery(false);setConnecting(id);}}/>}
  {configuring&&data&&<MessengerOnboarding providers={providers} models={models} settings={settings} onClose={()=>{setSetupOpen(false);setSetupDismissed(true);}} onDone={async id=>{setSetupOpen(false);setSetupDismissed(true);await reload();if(id)await select(id);}}/>}
  <AccountDialog open={accountOpen} onClose={()=>setAccountOpen(false)}/><ToolApprovalDialog/>
 </div>;
}
