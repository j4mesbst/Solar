import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Copy, Download, Plus, RefreshCw, X } from "lucide-react";
import type { Model } from "../../domain/types";
import { Button } from "./button";
import { downloadSolarModel, solarModelCatalog, solarModelIsInstalled, solarDownloadCommand, type SolarModelDefinition } from "../../services/solarModels";
import { inspectOllama, startOllama, type OllamaStatus } from "../../services/ollamaNative";
import type { PullProgress } from "../../services/modelInstall";
import { refreshOllama } from "../../services/ollama";
import { SetupModal } from "./setup-modal";

function readableError(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  return fallback;
}

export function SolarModelCatalog({ models, reload, onAdd }: { models: Model[]; reload: () => Promise<void>; onAdd:()=>void }) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [error, setError] = useState("");
  const [gemmaAccepted, setGemmaAccepted] = useState(false);
  const [notice, setNotice] = useState("");
  const [commandId, setCommandId] = useState<string>();
  const [refreshing,setRefreshing]=useState(false);
  const installController = useRef<AbortController>();
  useEffect(()=>()=>installController.current?.abort(),[]);

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try { const next=await inspectOllama("http://127.0.0.1:11434");setStatus(next);if(next.supported){await refreshOllama();await reload();} }
    catch (reason) { setError(reason instanceof Error ? reason.message : "État du moteur local indisponible."); }
    finally{setRefreshing(false);}
  };
  useEffect(() => { void refresh(); }, []);

  const install = async (definition: SolarModelDefinition) => {
    if (busy || (definition.id === "solar-12b" && !gemmaAccepted)) return;
    setBusy(definition.id); setProgress(null); setError(""); setNotice("");
    const controller = new AbortController();
    installController.current=controller;
    try {
      await downloadSolarModel(definition, controller.signal, setProgress);
      setNotice(`${definition.name} est prêt dans Solar.`);
      await reload(); await refresh();
    } catch (reason) { setError(readableError(reason, `Téléchargement de ${definition.name} impossible.`)); }
    finally { setBusy(null); setProgress(null); installController.current=undefined; }
  };

  const start = async () => {
    setBusy("start"); setError("");
    try { await startOllama(); await refresh(); }
    catch (reason) { setError(readableError(reason, "Impossible de démarrer le moteur local.")); }
    finally { setBusy(null); }
  };

  return <section className="solar-model-catalog" aria-labelledby="solar-model-catalog-title">
    <div className="section-title"><div><h2 id="solar-model-catalog-title">Modèles Solar</h2><p>Des modèles locaux à télécharger et utiliser sans compte API.</p></div><div className="model-toolbar"><Button className="directory-add" onClick={onAdd}>Ajouter<Plus size={16}/></Button><Button variant="outline" className="small-button" onClick={() => void refresh()} disabled={busy !== null||refreshing} aria-label="Actualiser l’état des modèles locaux"><RefreshCw size={14} className={refreshing ? "spinning" : ""}/>Actualiser</Button></div></div>
    <div className="solar-runtime-state" role="status"><span className={`status-dot ${status?.running ? "connected" : status?.installed ? "error" : ""}`}/>{!status?.supported ? "Disponible dans l’application macOS" : status.running ? `Moteur local prêt${status.version ? ` · ${status.version}` : ""}` : status.installed ? "Moteur local arrêté" : "Moteur local non installé"}{status?.supported && status.installed && !status.running && <Button variant="ghost" className="text-button" onClick={() => void start()} disabled={busy !== null}>{busy === "start" ? "Démarrage…" : "Démarrer"}</Button>}</div>
    <div className="solar-model-list">{solarModelCatalog.map(definition => {
      const installed = solarModelIsInstalled(definition, models);
      const downloading = busy === definition.id;
      return <article className="solar-model-row" key={definition.id}>
        <div className="solar-model-copy"><div className="solar-model-title"><strong>{definition.name}</strong>{definition.recommendedForCode && <span>Recommandé pour Solar Code</span>}</div><p>{definition.description}</p><small>Base : {definition.base} · {definition.sizeLabel} · {definition.license}</small>
          {definition.id === "solar-12b" && <label className="solar-license-accept"><input type="checkbox" checked={gemmaAccepted} onChange={event => setGemmaAccepted(event.target.checked)}/><span>J’accepte les conditions de Google après les avoir <a href={definition.sourceUrl} target="_blank" rel="noreferrer">consultées <ArrowUpRight size={12}/></a>.</span></label>}
          <SetupModal open={commandId===definition.id} onOpenChange={open=>{if(!open)setCommandId(undefined);}} title={`Installer ${definition.name}`} description={`${definition.description} · ${definition.sizeLabel}`}><div className="setup-info-card"><Download size={21}/><div><strong>{definition.base}</strong><p>{definition.license}<br/>Local · aucune limite d’utilisation.</p></div></div><div className="solar-model-command"><p>Colle cette commande dans Terminal, puis actualise les modèles dans Solar.</p><div className="solar-command-code"><code>{solarDownloadCommand(definition)}</code><Button variant="ghost" className="small-button" aria-label={`Copier la commande ${definition.name}`} onClick={()=>void navigator.clipboard.writeText(solarDownloadCommand(definition)).then(()=>setNotice("Commande copiée.")).catch(()=>setError("Copie impossible. Sélectionne la commande manuellement."))}><Copy size={14}/></Button></div>{definition.id==="solar-12b"&&<label className="solar-license-accept"><input type="checkbox" checked={gemmaAccepted} onChange={event=>setGemmaAccepted(event.target.checked)}/>J’accepte les conditions de Google après les avoir consultées.</label>}<div className="solar-command-actions"><Button className="setup-cta" disabled={busy!==null||!status?.supported||!status?.installed||(definition.id==="solar-12b"&&!gemmaAccepted)} onClick={()=>void install(definition)}>{downloading?"Téléchargement…":"Télécharger dans Solar"}</Button></div>{!status?.supported&&<p className="settings-note">Le téléchargement intégré est disponible dans l’application macOS.</p>}{downloading&&progress&&<div className="solar-download-progress" role="status"><span>{progress.status}</span>{progress.total?<progress max={progress.total} value={progress.completed??0}/>:null}<Button variant="ghost" onClick={()=>installController.current?.abort()}>Annuler le téléchargement</Button></div>}{notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="form-error">{error}</p>}</div></SetupModal>
          {downloading && progress && <div className="solar-download-progress"><span>{progress.status}</span>{progress.total ? <progress max={progress.total} value={progress.completed ?? 0}/> : <span className="ollama-indeterminate"/>}<Button variant="ghost" className="small-button" onClick={()=>installController.current?.abort()}>Annuler</Button></div>}
        </div>
        <Button variant={installed ? "ghost" : "outline"} className="small-button solar-model-action" disabled={busy !== null || installed} aria-expanded={commandId===definition.id} onClick={() => setCommandId(commandId===definition.id?undefined:definition.id)}>{installed ? "Installé" : downloading ? "Téléchargement…" : <><Download size={14}/>Télécharger</>}</Button>
      </article>;
    })}</div>
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <div role="alert" className="form-error"><p>{error}</p><details><summary>Détail technique</summary><code>{error}</code></details></div>}
    <p className="settings-note">Les fichiers restent sur cet appareil. Solar utilise le moteur local présent sur macOS pour les télécharger et les exécuter. Solar 9B et Solar 12B sont marqués comme recommandés pour Solar Code.</p>
  </section>;
}
