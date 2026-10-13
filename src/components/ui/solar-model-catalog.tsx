import { useEffect, useState } from "react";
import { ArrowUpRight, Download, RefreshCw } from "lucide-react";
import type { Model } from "../../domain/types";
import { Button } from "./button";
import { downloadSolarModel, solarModelCatalog, solarModelIsInstalled, type SolarModelDefinition } from "../../services/solarModels";
import { inspectOllama, startOllama, type OllamaStatus } from "../../services/ollamaNative";
import type { PullProgress } from "../../services/modelInstall";

function readableError(reason: unknown, fallback: string) {
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "string" && reason.trim()) return reason.trim();
  if (reason && typeof reason === "object" && "message" in reason && typeof reason.message === "string") return reason.message;
  return fallback;
}

export function SolarModelCatalog({ models, reload }: { models: Model[]; reload: () => Promise<void> }) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [error, setError] = useState("");
  const [gemmaAccepted, setGemmaAccepted] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = async () => {
    setError("");
    try { setStatus(await inspectOllama("http://127.0.0.1:11434")); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "État du moteur local indisponible."); }
  };
  useEffect(() => { void refresh(); }, []);

  const install = async (definition: SolarModelDefinition) => {
    if (busy || (definition.id === "solar-12b" && !gemmaAccepted)) return;
    setBusy(definition.id); setProgress(null); setError(""); setNotice("");
    const controller = new AbortController();
    try {
      await downloadSolarModel(definition, controller.signal, setProgress);
      setNotice(`${definition.name} est prêt dans Solar.`);
      await reload(); await refresh();
    } catch (reason) { setError(readableError(reason, `Téléchargement de ${definition.name} impossible.`)); }
    finally { setBusy(null); setProgress(null); }
  };

  const start = async () => {
    setBusy("start"); setError("");
    try { await startOllama(); await refresh(); }
    catch (reason) { setError(readableError(reason, "Impossible de démarrer le moteur local.")); }
    finally { setBusy(null); }
  };

  return <section className="solar-model-catalog" aria-labelledby="solar-model-catalog-title">
    <div className="section-title"><div><h2 id="solar-model-catalog-title">Modèles Solar</h2><p>Des modèles locaux à télécharger et utiliser sans compte API.</p></div><Button variant="outline" className="small-button" onClick={() => void refresh()} disabled={busy !== null} aria-label="Actualiser l’état des modèles locaux"><RefreshCw size={14} className={busy === "refresh" ? "spinning" : ""}/>Actualiser</Button></div>
    <div className="solar-runtime-state" role="status"><span className={`status-dot ${status?.running ? "connected" : status?.installed ? "error" : ""}`}/>{!status?.supported ? "Disponible dans l’application macOS" : status.running ? `Moteur local prêt${status.version ? ` · ${status.version}` : ""}` : status.installed ? "Moteur local arrêté" : "Moteur local non installé"}{status?.supported && status.installed && !status.running && <Button variant="ghost" className="text-button" onClick={() => void start()} disabled={busy !== null}>{busy === "start" ? "Démarrage…" : "Démarrer"}</Button>}</div>
    <div className="solar-model-list">{solarModelCatalog.map(definition => {
      const installed = solarModelIsInstalled(definition, models);
      const downloading = busy === definition.id;
      return <article className="solar-model-row" key={definition.id}>
        <div className="solar-model-copy"><div className="solar-model-title"><strong>{definition.name}</strong>{definition.recommendedForCode && <span>Recommandé pour Solar Code</span>}</div><p>{definition.description}</p><small>Base : {definition.base} · {definition.sizeLabel} · {definition.license}</small>
          {definition.id === "solar-12b" && <label className="solar-license-accept"><input type="checkbox" checked={gemmaAccepted} onChange={event => setGemmaAccepted(event.target.checked)}/><span>J’accepte les conditions de Google après les avoir <a href={definition.sourceUrl} target="_blank" rel="noreferrer">consultées <ArrowUpRight size={12}/></a>.</span></label>}
          {downloading && progress && <div className="solar-download-progress"><span>{progress.status}</span>{progress.total ? <progress max={progress.total} value={progress.completed ?? 0}/> : <span className="ollama-indeterminate"/>}</div>}
        </div>
        <Button variant={installed ? "ghost" : "outline"} className="small-button solar-model-action" disabled={busy !== null || installed || (definition.id === "solar-12b" && !gemmaAccepted) || !status?.supported || !status?.installed} onClick={() => void install(definition)}>{installed ? "Installé" : downloading ? "Téléchargement…" : <><Download size={14}/>Télécharger</>}</Button>
      </article>;
    })}</div>
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <div role="alert" className="form-error"><p>{error}</p><details><summary>Détail technique</summary><code>{error}</code></details></div>}
    <p className="settings-note">Les fichiers restent sur cet appareil. Solar utilise le moteur local présent sur macOS pour les télécharger et les exécuter. Solar 9B et Solar 12B sont marqués comme recommandés pour Solar Code.</p>
  </section>;
}
