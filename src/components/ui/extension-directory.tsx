import { MarkdownMessage } from "./markdown-message";
import pluginSource from "../../services/pluginConnections.ts?raw";
import { X, Code2, FileText } from "lucide-react";
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

export function ExtensionDirectory({ kind, onNavigate, onImport }: { kind: "plugins" | "skills"; onNavigate: (kind: "plugins" | "skills") => void;onImport:(text:string)=>Promise<void> }) {
  const [detail,setDetail]=useState<{id:string;name:string;description:string;content:string;kind:"skills"|"plugins";brand?:string}|null>(null);
  const [sourceView,setSourceView]=useState(false);
  const detailsRef=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(detail)detailsRef.current?.showModal();else detailsRef.current?.close();},[detail]);
  const openSkill=(skill:BuiltinSkill|PersonalExtension)=>{setSourceView(false);setDetail({...skill,kind:"kind" in skill?skill.kind:"skills",description:"description" in skill?skill.description:"kind" in skill&&skill.kind==="plugins"?"Raccourci personnel · aucun accès API":"Instructions personnelles"});};
  const openPlugin=(name:string,description:string,brand:string)=>{setSourceView(false);setDetail({id:brand,name,description,kind:"plugins",brand,content:brand==="github"?"# GitHub\n\nConnexion avec un jeton personnel. Solar vérifie votre identité, puis lit les dépôts accessibles et leur README. Le contenu sélectionné peut être ajouté au chat.\n\nAucune écriture dans vos dépôts et aucun jeton transmis au modèle. Les secrets sont conservés dans le stockage de credentials de Solar.\n\n## Utilisation\n1. Connecter le compte.\n2. Sélectionner un dépôt.\n3. Importer son README dans un nouveau brouillon.":brand==="gmail"?"# Gmail\n\nConnexion OAuth Google en lecture seule dans le navigateur configuré, ou jeton d’accès en mode natif. L’identité est validée avant lecture.\n\nRecherchez vos e-mails, ouvrez le résultat choisi et importez uniquement ce message dans votre brouillon. Aucun envoi d’e-mail.\n\nLa connexion OAuth exige un client Google configuré ; un jeton expiré doit être renouvelé.":"# "+name+"\n\nCette intégration arrive bientôt. Aucun accès API n’est encore implémenté et aucune connexion n’est simulée."});};
  const [connecting,setConnecting]=useState<PluginId|null>(null);
  const [query, setQuery] = useState("");
  const [items,setItems]=useState<PersonalExtension[]>([]);
  const [tab,setTab]=useState("public");
  const [adding,setAdding]=useState(false);const [name,setName]=useState("");const [content,setContent]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{void listPersonalExtensions().then(setItems).catch(()=>setError("Impossible de lire les éléments enregistrés."));},[]);
  useEffect(()=>{if(adding)dialog.current?.showModal();else dialog.current?.close();},[adding]);
  const save=async(next:PersonalExtension[])=>{await savePersonalExtensions(next);setItems(next);};
  const add=async()=>{setBusy(true);try{await save([...items,validatePersonalExtension(kind,name,content)]);setAdding(false);if(kind==="plugins")setTab("personal");setName("");setContent("");setError("");}catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible.");}finally{setBusy(false);}};
  const install=async(skill:BuiltinSkill)=>{if(busy)return;setBusy(true);setError("");try{await save([...items,{id:skill.id,kind:"skills",name:skill.name,content:skill.content,enabled:true}]);}catch{setError("Installation impossible.");}finally{setBusy(false);}};
  const personal=items.filter(x=>x.kind===kind && x.name.toLowerCase().includes(query.toLowerCase()));
  const personalList=<div className="personal-list">{personal.map(item=><div className="personal-entry" key={item.id}><div><button className="extension-open" onClick={()=>openSkill(item)}><h3>{item.name}</h3></button><p>{kind==="skills"?builtinSkills.find(skill=>skill.id===item.id)?.description??"Instructions personnelles":"Raccourci personnel · aucun accès API"}</p></div>{kind==="skills"?<label><input type="checkbox" aria-label={`Activer ${item.name}`} checked={item.enabled} onChange={e=>void save(items.map(x=>x.id===item.id?{...x,enabled:e.target.checked}:x)).catch(()=>setError("Enregistrement impossible."))}/>Actif</label>:<a href={item.content} target="_blank" rel="noopener noreferrer">Ouvrir</a>}<Button variant="ghost" onClick={()=>void save(items.filter(x=>x.id!==item.id)).catch(()=>setError("Suppression impossible."))} aria-label={`Supprimer ${item.name}`}>Retirer</Button></div>)}</div>;
  const skills = kind === "skills";
  const title = skills ? "Skills" : "Plugins";
  const results = groups.map(group => ({ ...group, items: group.items.filter(([name, description]) => `${name} ${description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))) }));
  return <div className="extension-layout">
    <section className="extension-directory" aria-label={title}>
      <header className="directory-header"><div><h1>{title}</h1><p>{skills ? "Ajoutez à Solar des compétences spécifiques à chaque tâche." : "Connectez des plugins pour permettre à Solar de travailler avec vos différents outils."}</p></div>
        <div className="directory-toolbar"><label className="directory-search"><Search size={18}/><Input aria-label={`Rechercher des ${skills ? "compétences" : "plugins"}`} placeholder={`Rechercher des ${skills ? "compétences" : "plugins"}`} value={query} onChange={e => setQuery(e.target.value)}/></label><Button variant="ghost" size="icon" aria-label="Actualiser la recherche" title="Actualiser la recherche" onClick={() => setQuery("")}><RefreshCw/></Button><Button variant="ghost" size="icon" disabled aria-label={`Paramètres des ${title} (bientôt)`} title="Bientôt"><Settings2/></Button><Button className="directory-add" onClick={()=>{setError("");setAdding(true);}}>Ajouter<Plus/></Button></div>
      </header>
      {skills ? <><section className="skill-empty-section"><h2>Recommandés</h2><div className="recommended-skills">{builtinSkills.filter(skill=>!items.some(item=>item.id===skill.id)&&`${skill.name} ${skill.description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))).map(skill=><article className="recommended-skill" key={skill.id}><div className="skill-mark"><WandSparkles size={22}/></div><div><button className="extension-open" aria-label={`Voir ${skill.name}`} onClick={()=>openSkill(skill)}><h3>{skill.name}</h3></button><p>{skill.description}</p></div><Button variant="ghost" aria-label={`Installer ${skill.name}`} disabled={busy} onClick={()=>void install(skill)}><Plus size={16}/>Installer</Button></article>)}</div></section><section className="skill-empty-section"><h2>Installés</h2>{personal.length?personalList:<div className="skill-empty-space" aria-label="Aucun skill installé"/>}</section></> : <Tabs value={tab} onValueChange={setTab}><TabsList className="directory-tabs"><TabsTrigger value="public">Public</TabsTrigger><TabsTrigger value="personal">Personnel</TabsTrigger></TabsList><TabsContent value="public">{results.map(group => group.items.length ? <section className="plugin-group" key={group.title}><h2>{group.title}<ChevronRight size={17}/></h2><div className="plugin-grid">{group.items.map(([name, description, icon]) => <div className="plugin-entry" key={name}><div className="plugin-logo" data-brand={icon}>{icon !== "magicpath" && <img src={`/plugin-icons/${icon}.svg`} alt=""/>}<Blocks className="plugin-fallback" size={22}/></div><div className="plugin-copy"><h3><button className="extension-open" aria-label={`Voir ${name}`} onClick={()=>openPlugin(name,description,icon)}>{name}</button> <Badge variant="secondary">{icon==="gmail"||icon==="github"?"Disponible":"(bientôt)"}</Badge></h3><p>{description}</p></div><Button variant="ghost" size="icon" disabled={icon!=="gmail"&&icon!=="github"} aria-label={`Ajouter ${name}${icon==="gmail"||icon==="github"?"":" (bientôt)"}`} onClick={()=>{if(icon==="gmail"||icon==="github")setConnecting(icon);}}><Plus/></Button></div>)}</div></section> : null)}{!results.some(g => g.items.length) && <p className="directory-no-results">Aucun plugin ne correspond à cette recherche.</p>}</TabsContent><TabsContent value="personal">{personal.length?personalList:<div className="skill-empty-space" aria-label="Aucun plugin personnel"/>}</TabsContent></Tabs>}
      {error && !adding && <p role="alert" className="form-error">{error}</p>}
      <dialog ref={dialog} className="extension-dialog" onCancel={()=>setAdding(false)} onClose={()=>setAdding(false)} aria-labelledby="extension-dialog-title">
        <h2 id="extension-dialog-title">Ajouter {skills?"un skill":"un plugin personnel"}</h2>
        <p>{skills?"Ces instructions seront utilisées par Solar pour tes prochains messages. Tu peux les désactiver à tout moment.":"Ajoute un raccourci vers ton outil. Gmail et GitHub proposent aussi une connexion dans le catalogue."}</p>
        <label>Nom<Input autoFocus value={name} onChange={e=>setName(e.target.value)} maxLength={80}/></label>
        {skills?<><label>Instructions<textarea value={content} onChange={e=>setContent(e.target.value)} maxLength={16000} rows={8}/></label><label className="skill-import">Importer un fichier Markdown<input type="file" accept=".md,.txt" onChange={async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>64000)throw new Error("Fichier trop volumineux.");setContent(await file.text());if(!name)setName(file.name.replace(/\.(md|txt)$/i,""));setError("");}catch(e){setError(e instanceof Error?e.message:"Import impossible.");}}}/></label></>:<label>Adresse HTTPS<Input type="url" value={content} onChange={e=>setContent(e.target.value)} placeholder="https://…"/></label>}
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="dialog-actions"><Button variant="ghost" onClick={()=>setAdding(false)}>Annuler</Button><Button disabled={busy||!name.trim()||!content.trim()} onClick={()=>void add()}>{busy?"Enregistrement…":"Enregistrer"}</Button></div>
      </dialog>
      <dialog ref={detailsRef} className="extension-detail" onCancel={()=>setDetail(null)} onClose={()=>setDetail(null)} aria-labelledby="extension-detail-title">
        {detail&&<><div className="extension-detail-top"><div className="skill-mark">{detail.brand?<img src={`/plugin-icons/${detail.brand}.svg`} alt=""/>:<WandSparkles size={24}/>}</div><div className="extension-detail-controls">{detail.kind==="skills"&&items.some(x=>x.id===detail.id)&&<label><input type="checkbox" aria-label={`Activer ${detail.name} dans le détail`} checked={items.find(x=>x.id===detail.id)?.enabled??false} onChange={e=>void save(items.map(x=>x.id===detail.id?{...x,enabled:e.target.checked}:x)).catch(()=>setError("Enregistrement impossible."))}/>Actif</label>}<Button variant="ghost" size="icon" aria-label="Fermer le détail" onClick={()=>setDetail(null)}><X/></Button></div></div>
          <h2 id="extension-detail-title">{detail.name}</h2><small>{detail.kind==="skills"?"Skill":"Plugin"}</small><p>{detail.description}</p>
          <div className="extension-detail-tabs"><Button variant="ghost" aria-pressed={!sourceView} onClick={()=>setSourceView(false)}><FileText size={15}/>Instructions</Button><Button variant="ghost" aria-pressed={sourceView} onClick={()=>setSourceView(true)}><Code2 size={15}/>Source</Button></div>
          <div className="extension-detail-document message-content">{sourceView?<MarkdownMessage content={detail.kind==="skills"?"````markdown\n"+detail.content+"\n````":detail.id==="github"||detail.id==="gmail"?"```typescript\n"+pluginSource+"\n```":"Aucun code de connexion disponible pour cette intégration."}/>:<MarkdownMessage content={detail.content}/>}</div>
          <footer>{detail.kind==="skills"?(items.some(x=>x.id===detail.id)?<><Button variant="ghost" className="extension-uninstall" onClick={()=>void save(items.filter(x=>x.id!==detail.id)).then(()=>setDetail(null)).catch(()=>setError("Suppression impossible."))}>Désinstaller</Button><span>Utilisé automatiquement pour les tâches adaptées.</span></>:<Button disabled={busy} onClick={()=>{const skill=builtinSkills.find(x=>x.id===detail.id);if(skill)void install(skill);}}>Installer le skill</Button>):detail.content.startsWith("https://")?<Button asChild><a href={detail.content} target="_blank" rel="noopener noreferrer">Ouvrir l’outil</a></Button>:<Button disabled={detail.id!=="github"&&detail.id!=="gmail"} onClick={()=>{setDetail(null);setConnecting(detail.id as PluginId);}}>Connecter {detail.name}</Button>}</footer>
        </>}
      </dialog>
      {connecting&&<PluginConnectionDialog key={connecting} id={connecting} onClose={()=>setConnecting(null)} onImport={onImport}/>}
    </section>
  </div>;
}
