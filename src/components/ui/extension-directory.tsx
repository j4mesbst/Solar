import { builtinSkills, type BuiltinSkill } from "../../services/builtinSkills";
import { PluginConnectionDialog } from "./plugin-connection-dialog";
import type { PluginId } from "../../services/pluginConnections";
import { listPersonalExtensions, savePersonalExtensions, validatePersonalExtension, type PersonalExtension } from "../../services/personalExtensions";
import { useState, useEffect, useRef } from "react";
import { Search, RefreshCw, Settings2, Plus, ChevronDown, ChevronRight, Blocks, WandSparkles } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import type { AppSettings } from "../../domain/types";

const groups = [
  { title: "Les plus utilisés", items: [
    ["Gmail", "Rechercher et lire vos e-mails", "gmail"],
    ["Google Drive", "Drive, Docs, Sheets et Slides", "googledrive"],
    ["GitHub", "Parcourir vos dépôts et lire leur README", "github"],
    ["Supabase", "Gérer et interroger vos bases de données", "supabase"],
    ["Sales", "Des workflows pour vos ventes", "salesforce"],
    ["Outlook Email", "Organiser vos e-mails Outlook", "microsoftoutlook"],
  ] },
  { title: "Nouveautés à découvrir", items: [
    ["Adobe", "Créer, assembler et modifier", "adobe"],
    ["tldraw", "Dessiner et créer des diagrammes", "tldraw"],
    ["Canva", "Créer et modifier vos designs", "canva"],
    ["Figma", "Créer des designs et les transformer en code", "figma"],
    ["Shopify", "Créer et gérer votre boutique", "shopify"],
    ["MagicPath", "Concevoir directement dans Solar", "magicpath"],
  ] },
];

export function ExtensionDirectory({ kind, initialTab="public", onNavigate, onImport, settings, updateSettings }: { kind: "plugins" | "skills"; initialTab?: "public"|"personal"; onNavigate: (kind: "plugins" | "skills", tab?: "public"|"personal") => void;onImport:(text:string)=>Promise<void>;settings:AppSettings;updateSettings:(settings:AppSettings)=>Promise<void> }) {
  const [connecting,setConnecting]=useState<PluginId|null>(null);
  const [query, setQuery] = useState("");
  const [items,setItems]=useState<PersonalExtension[]>([]);
  const [tab,setTab]=useState<"public"|"personal">(initialTab);
  const [adding,setAdding]=useState(false);const [name,setName]=useState("");const [content,setContent]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{void listPersonalExtensions().then(setItems).catch(()=>setError("Impossible de lire les éléments enregistrés."));},[]);
  useEffect(()=>{if(adding)dialog.current?.showModal();else dialog.current?.close();},[adding]);
  useEffect(()=>{if(!error)return;const timeout=window.setTimeout(()=>setError(""),3000);return()=>window.clearTimeout(timeout);},[error]);
  const save=async(next:PersonalExtension[])=>{await savePersonalExtensions(next);setItems(next);};
  const add=async()=>{setBusy(true);try{await save([...items,validatePersonalExtension(kind,name,content)]);setAdding(false);if(kind==="plugins")setTab("personal");setName("");setContent("");setError("");}catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible.");}finally{setBusy(false);}};
  const install=async(skill:BuiltinSkill)=>{if(busy)return;setBusy(true);setError("");try{await save([...items,{id:skill.id,kind:"skills",name:skill.name,content:skill.content,enabled:true}]);}catch{setError("Installation impossible.");}finally{setBusy(false);}};
  const personal=items.filter(x=>x.kind===kind && x.name.toLowerCase().includes(query.toLowerCase()) && !(kind==="skills"&&builtinSkills.some(skill=>skill.bundled&&skill.id===x.id)));
  const personalList=<div className="personal-list">{personal.map(item=><div className="personal-entry" key={item.id}><div><h3>{item.name}</h3><p>{kind==="skills"?builtinSkills.find(skill=>skill.id===item.id)?.description??"Instructions personnelles":"Raccourci personnel · aucun accès API"}</p></div>{kind==="skills"?<label><input type="checkbox" aria-label={`Activer ${item.name}`} checked={item.enabled} onChange={e=>void save(items.map(x=>x.id===item.id?{...x,enabled:e.target.checked}:x)).catch(()=>setError("Enregistrement impossible."))}/>Actif</label>:<a href={item.content} target="_blank" rel="noopener noreferrer">Ouvrir</a>}<Button variant="ghost" onClick={()=>void save(items.filter(x=>x.id!==item.id)).catch(()=>setError("Suppression impossible."))} aria-label={`Supprimer ${item.name}`}>Retirer</Button></div>)}</div>;
  const skills = kind === "skills";
  const title = skills ? "Skills" : "Plugins";
  const results = groups.map(group => ({ ...group, items: group.items.filter(([name, description]) => `${name} ${description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))) }));
  return <div className="extension-layout">
    <section className="extension-directory" aria-label={title}>
      <header className="directory-header"><div><h1>{title}</h1><p>{skills ? "Ajoutez à Solar des compétences spécifiques à chaque tâche." : "Connectez des plugins pour permettre à Solar de travailler avec vos différents outils."}</p></div>
        <div className="directory-toolbar"><label className="directory-search"><Search size={18}/><Input aria-label={`Rechercher des ${skills ? "compétences" : "plugins"}`} placeholder={`Rechercher des ${skills ? "compétences" : "plugins"}`} value={query} onChange={e => setQuery(e.target.value)}/></label><Button variant="ghost" size="icon" aria-label="Actualiser la recherche" title="Actualiser la recherche" onClick={() => setQuery("")}><RefreshCw/></Button><Button variant="ghost" size="icon" disabled aria-label={`Paramètres des ${title} (bientôt)`} title="Bientôt"><Settings2/></Button><Button className="directory-add" onClick={()=>{setError("");setAdding(true);}}>Ajouter<Plus/></Button></div>
      </header>
      {skills ? <>
        <Tabs value="skills"><TabsList className="directory-tabs"><TabsTrigger value="public" onClick={() => onNavigate("plugins","public")}>Public</TabsTrigger><TabsTrigger value="skills">Skills</TabsTrigger><TabsTrigger value="personal" onClick={() => onNavigate("plugins","personal")}>Installés</TabsTrigger></TabsList></Tabs>
        <div className="skill-mode-switch" role="group" aria-label="Mode de sélection des Skills"><span>Utilisation</span><Button variant={settings.skillsMode!=="manual"?"secondary":"ghost"} aria-pressed={settings.skillsMode!=="manual"} onClick={()=>void updateSettings({...settings,skillsMode:"auto"})}>Auto</Button><Button variant={settings.skillsMode==="manual"?"secondary":"ghost"} aria-pressed={settings.skillsMode==="manual"} onClick={()=>void updateSettings({...settings,skillsMode:"manual",manualSkillIds:settings.manualSkillIds??[]})}>Manuel</Button><small>{settings.skillsMode==="manual"?"Les Skills cochés sont utilisés.":"Solar choisit les Skills utiles à chaque tâche."}</small></div>
        <section className="skill-empty-section"><h2>Skills Solar</h2><div className="recommended-skills">{builtinSkills.filter(skill=>skill.bundled&&`${skill.name} ${skill.description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(skill=>{const saved=items.find(item=>item.id===skill.id&&item.kind==="skills");const enabled=saved?.enabled??true;const selected=(settings.manualSkillIds??[]).includes(skill.id);return <article className="recommended-skill solar-bundled-skill" key={skill.id}><div className="skill-mark"><WandSparkles size={19}/></div><div className="solar-skill-copy"><h3>{skill.name} <Badge variant="secondary">{skill.version}</Badge></h3><p>{skill.description}</p><details><summary>Détails du Skill</summary><p>Catégorie : {skill.category} · Priorité : {skill.id.includes("software-engineer")||skill.id.includes("debugging")||skill.id.includes("artifact-builder")?"critique":"élevée"}</p><p>Déclencheurs : {skill.triggers?.join(" · ")}</p>{(skill.compatibleSkills??[]).length>0&&<p>Complète : {(skill.compatibleSkills??[]).map(id=>id.replace("solar.","").replaceAll("-"," ")).join(" · ")}</p>}<pre>{skill.content}</pre></details></div><label className="skill-enabled-toggle"><input type="checkbox" aria-label={`Activer ${skill.name}`} checked={enabled} onChange={event=>{const next=items.filter(item=>item.id!==skill.id);next.push({id:skill.id,kind:"skills",name:skill.name,content:skill.content,enabled:event.target.checked});void save(next).catch(()=>setError("Enregistrement impossible."));}}/>Actif</label>{settings.skillsMode==="manual"&&<label className="skill-enabled-toggle"><input type="checkbox" aria-label={`Utiliser ${skill.name} en mode manuel`} checked={selected} disabled={!enabled} onChange={event=>void updateSettings({...settings,manualSkillIds:event.target.checked?[...new Set([...(settings.manualSkillIds??[]),skill.id])]:((settings.manualSkillIds??[]).filter(id=>id!==skill.id))})}/>Utiliser</label>}</article>;})}</div></section>
        <section className="skill-empty-section"><h2>À installer</h2><div className="recommended-skills">{builtinSkills.filter(skill=>!skill.bundled&&!items.some(item=>item.id===skill.id)&&`${skill.name} ${skill.description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(skill=><article className="recommended-skill" key={skill.id}><div className="skill-mark"><WandSparkles size={22}/></div><div><h3>{skill.name}</h3><p>{skill.description}</p></div><Button variant="ghost" aria-label={`Installer ${skill.name}`} disabled={busy} onClick={()=>void install(skill)}><Plus size={16}/>Installer</Button></article>)}</div></section>
        <section className="skill-empty-section"><h2>Skills personnels installés</h2>{personal.length?personalList:<div className="skill-empty-space" aria-label="Aucun skill personnel installé"/>}</section>
      </> : <Tabs value={tab} onValueChange={value=>setTab(value as "public"|"personal")}><TabsList className="directory-tabs"><TabsTrigger value="public">Public</TabsTrigger><TabsTrigger value="skills" onClick={() => onNavigate("skills")}>Skills</TabsTrigger><TabsTrigger value="personal">Installés</TabsTrigger></TabsList><TabsContent value="public">{results.map(group => group.items.length ? <section className="plugin-group" key={group.title}><h2>{group.title}<ChevronRight size={17}/></h2><div className="plugin-grid">{group.items.map(([name, description, icon]) => <div className="plugin-entry" key={name}><div className="plugin-logo" data-brand={icon}>{icon !== "magicpath" && <img src={`/plugin-icons/${icon}.svg`} alt=""/>}<Blocks className="plugin-fallback" size={22}/></div><div className="plugin-copy"><h3>{name} <Badge variant="secondary">{icon==="gmail"||icon==="github"?"Disponible":"(bientôt)"}</Badge></h3><p>{description}</p></div><Button variant="ghost" size="icon" disabled={icon!=="gmail"&&icon!=="github"} aria-label={`Ajouter ${name}${icon==="gmail"||icon==="github"?"":" (bientôt)"}`} onClick={()=>{if(icon==="gmail"||icon==="github")setConnecting(icon);}}><Plus/></Button></div>)}</div></section> : null)}{!results.some(g => g.items.length) && <p className="directory-no-results">Aucun plugin ne correspond à cette recherche.</p>}</TabsContent><TabsContent value="personal">{personal.length?personalList:<div className="skill-empty-space" aria-label="Aucun plugin personnel"/>}</TabsContent></Tabs>}
      {error && !adding && <p role="alert" className="form-error">{error}</p>}
      <dialog ref={dialog} className="extension-dialog" onCancel={()=>setAdding(false)} onClose={()=>setAdding(false)} aria-labelledby="extension-dialog-title">
        <h2 id="extension-dialog-title">Ajouter {skills?"un skill":"un plugin personnel"}</h2>
        <p>{skills?"Ces instructions seront utilisées par Solar pour tes prochains messages. Tu peux les désactiver à tout moment.":"Ajoute un raccourci vers ton outil. Gmail et GitHub proposent aussi une connexion dans le catalogue."}</p>
        <label>Nom<Input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
        {skills?<><label>Instructions<textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={16000} rows={8}/></label><label className="skill-import">Importer un fichier Markdown<input type="file" accept=".md,.txt" onChange={async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>64000)throw new Error("Fichier trop volumineux.");setContent(await file.text());if(!name)setName(file.name.replace(/\.(md|txt)$/i,""));setError("");}catch(e){setError(e instanceof Error?e.message:"Import impossible.");}}}/></label></>:<label>Adresse HTTPS<Input type="url" value={content} onChange={e=>setContent(e.target.value)} placeholder="https://…"/></label>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="dialog-actions"><Button variant="ghost" onClick={()=>setAdding(false)}>Annuler</Button><Button disabled={busy||!name.trim()||!content.trim()} onClick={()=>void add()}>{busy?"Enregistrement…":"Enregistrer"}</Button></div>
      </dialog>
      {connecting&&<PluginConnectionDialog key={connecting} id={connecting} onClose={()=>setConnecting(null)} onImport={onImport}/>}
    </section>
  </div>;
}
