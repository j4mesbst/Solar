import { useState } from "react";
import { Search, RefreshCw, Settings2, Plus, ChevronDown, ChevronRight, Blocks, WandSparkles } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Badge } from "./badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const groups = [
  { title: "Les plus utilisés", items: [
    ["Gmail", "Lire et organiser vos e-mails", "gmail"],
    ["Google Drive", "Drive, Docs, Sheets et Slides", "googledrive"],
    ["GitHub", "Dépôts, issues et pull requests", "github"],
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

export function ExtensionDirectory({ kind, onNavigate }: { kind: "plugins" | "skills"; onNavigate: (kind: "plugins" | "skills") => void }) {
  const [query, setQuery] = useState("");
  const skills = kind === "skills";
  const title = skills ? "Skills" : "Plugins";
  const results = groups.map(group => ({ ...group, items: group.items.filter(([name, description]) => `${name} ${description}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))) }));
  return <div className="extension-layout">
    <aside className="extension-menu">
      <h2>Personnaliser</h2>
      <nav aria-label="Personnalisation">
        <Button variant="ghost" aria-label="Ouvrir les plugins" className={skills ? "" : "selected"} aria-current={skills ? undefined : "page"} onClick={() => onNavigate("plugins")}><Blocks/>Plugins</Button>
        <Button variant="ghost" aria-label="Ouvrir les skills" className={skills ? "selected" : ""} aria-current={skills ? "page" : undefined} onClick={() => onNavigate("skills")}><WandSparkles/>Skills</Button>
      </nav>
      <p>Installés</p><span className="directory-empty-label">Aucune installation</span>
    </aside>
    <section className="extension-directory" aria-label={title}>
      <header className="directory-header"><div><h1>{title}</h1><p>{skills ? "Ajoutez à Solar des compétences spécifiques à chaque tâche." : "Connectez des plugins pour permettre à Solar de travailler avec vos différents outils."}</p></div>
        <div className="directory-toolbar"><label className="directory-search"><Search size={18}/><Input aria-label={`Rechercher des ${skills ? "compétences" : "plugins"}`} placeholder={`Rechercher des ${skills ? "compétences" : "plugins"}`} value={query} onChange={e => setQuery(e.target.value)}/></label><Button variant="ghost" size="icon" aria-label="Actualiser la recherche" title="Actualiser la recherche" onClick={() => setQuery("")}><RefreshCw/></Button><Button variant="ghost" size="icon" disabled aria-label={`Paramètres des ${title} (bientôt)`} title="Bientôt"><Settings2/></Button><Button disabled className="directory-add">Ajouter<ChevronDown/></Button></div>
      </header>
      {skills ? <><section className="skill-empty-section"><h2>Recommandés</h2><div className="skill-empty-space" aria-label="Aucun skill recommandé"/></section><section className="skill-empty-section"><h2>Installés</h2><div className="skill-empty-space" aria-label="Aucun skill installé"/></section></> : <Tabs defaultValue="public"><TabsList className="directory-tabs"><TabsTrigger value="public">Public</TabsTrigger><TabsTrigger value="personal">Personnel</TabsTrigger></TabsList><TabsContent value="public">{results.map(group => group.items.length ? <section className="plugin-group" key={group.title}><h2>{group.title}<ChevronRight size={17}/></h2><div className="plugin-grid">{group.items.map(([name, description, icon]) => <div className="plugin-entry" key={name} aria-disabled="true"><div className="plugin-logo">{icon !== "magicpath" && <img src={`/plugin-icons/${icon}.svg`} alt=""/>}<Blocks className="plugin-fallback" size={22}/></div><div className="plugin-copy"><h3>{name} <Badge variant="secondary">(bientôt)</Badge></h3><p>{description}</p></div><Button variant="ghost" size="icon" disabled aria-label={`Ajouter ${name} (bientôt)`}><Plus/></Button></div>)}</div></section> : null)}{!results.some(g => g.items.length) && <p className="directory-no-results">Aucun plugin ne correspond à cette recherche.</p>}</TabsContent><TabsContent value="personal"><div className="skill-empty-space" aria-label="Aucun plugin personnel"/></TabsContent></Tabs>}
    </section>
  </div>;
}
