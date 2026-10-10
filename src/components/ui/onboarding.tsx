import { Button } from "./button";
import { appearanceStyle } from "../../services/appearance";
import { resolveTheme } from "../../services/theme";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Provider, Model, AppSettings } from "../../domain/types";
import type { Hardware } from "../../domain/extensions";
import { detectHardware, recommendModels } from "../../services/performance";
import { pullModel, type PullProgress } from "../../services/modelInstall";
import { refreshOllama } from "../../services/ollama";
const presets = [
  {
    name: "Ollama",
    protocol: "ollama" as const,
    baseUrl: "http://127.0.0.1:11434",
  },
  {
    name: "GonkaRouter",
    protocol: "openai-compatible" as const,
    baseUrl: "https://api.gonkarouter.io/v1",
  },
  {
    name: "OpenAI",
    protocol: "openai-compatible" as const,
    baseUrl: "https://api.openai.com/v1",
  },
  {
    name: "Anthropic",
    protocol: "anthropic" as const,
    baseUrl: "https://api.anthropic.com/v1",
  },
  {
    name: "Compatible OpenAI",
    protocol: "openai-compatible" as const,
    baseUrl: "",
  },
];
export function Onboarding({
  settings,
  providers,
  models,
  onSave,
  reload,
  renderForm,
  renderProviders,
}: {
  settings: AppSettings;
  providers: Provider[];
  models: Model[];
  onSave: (s: AppSettings) => Promise<void>;
  reload: () => Promise<void>;
  renderForm: (
    preset: (typeof presets)[number] & {id?:string},
    onDone: () => void,
  ) => ReactNode;
  renderProviders: (onEdit:(preset:{id?:string;name:string;protocol:Provider["protocol"];baseUrl:string})=>void) => ReactNode;
}) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [editing, setEditing] = useState<string>();
  const [existingForm,setExistingForm]=useState<((typeof presets)[number] & {id?:string})>();
  const [hardware, setHardware] = useState<Hardware>();
  const [progress, setProgress] = useState<PullProgress>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [download, setDownload] = useState("");
  const controller = useRef<AbortController>();
  useEffect(() => {
    void detectHardware()
      .then(setHardware)
      .catch(() => {});
    return () => controller.current?.abort();
  }, []);
  const finish = async () => {
    try {
      await onSave({ ...settings, onboardingComplete: true });
    } catch (e) {
      setError(String(e));
    }
  };
  const detect = async () => {
    setBusy(true);
    try {
      await refreshOllama();
      await reload();
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const pull = async (name: string) => {
    const local = providers.find((p) => p.protocol === "ollama" && p.enabled);
    if (!local) {
      setError("Installe et démarre Ollama, puis détecte sa connexion.");
      return;
    }
    setBusy(true);
    setDownload(name);
    setError("");
    setProgress(undefined);
    const request = new AbortController();
    controller.current = request;
    try {
      await pullModel(local.baseUrl, name, request.signal, setProgress);
      await detect();
      setDownload("");
    } catch (e) {
      setError(
        request.signal.aborted
          ? "Téléchargement annulé. Tu peux reprendre avec le même modèle."
          : String(e),
      );
    } finally {
      controller.current = undefined;
      setBusy(false);
    }
  };
  return (
    <div
      className="onboarding"
      style={
        appearanceStyle(
          settings,
          resolveTheme(settings.theme),
        ) as React.CSSProperties
      }
      role="dialog"
      aria-modal="true"
      aria-label="Configuration de Solar"
    >
      <div className="onboarding-content">
        <span className="wordmark">Solar</span>
        {step === 0 ? (
          <>
            <h1>Welcome to Solar</h1>
            <p>
              Ton espace pour penser, créer et travailler.
              <br />
              Local ou connecté, sans compte obligatoire.
            </p>
            <Button className="primary-button" onClick={() => setStep(1)}>
              Commencer
            </Button>
            <button className="text-button" onClick={() => void finish()}>
              Configurer plus tard
            </button>
          </>
        ) : step === 1 ? (
          <>
            <h1>À toi de choisir</h1>
            <p>
              Tu peux connecter plusieurs fournisseurs ou continuer sans clé
              API.
            </p>
            <div className="onboarding-providers">
              {presets.map((p) => (
                <label key={p.name}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(p.name)}
                    onChange={(e) =>
                      setChosen((v) =>
                        e.target.checked
                          ? [...v, p.name]
                          : v.filter((x) => x !== p.name),
                      )
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <Button
              className="primary-button"
              onClick={() => {
                setStep(2);
                setEditing(chosen.find((c) => c !== "Ollama"));
              }}
            >
              Continuer
            </Button>
            <button className="text-button" onClick={() => setStep(3)}>
              Ignorer cette étape
            </button>
          </>
        ) : step === 2 ? (
          <>
            <h1>Connectons tes modèles</h1>
            {editing || existingForm ? (
              renderForm(
                presets.find((p) => p.name === editing)!,
                () => {
                  setEditing(undefined);setExistingForm(undefined);
                },
              )
            ) : (
              <>
                <div className="artifact-tools">
                  {chosen
                    .filter((n) => n !== "Ollama")
                    .map((name) => (
                      <Button
                        key={name}
                        className="small-button"
                        onClick={() => setEditing(name)}
                      >
                        Configurer {name}
                      </Button>
                    ))}
                </div>
                {renderProviders(p=>{setExistingForm(p);setEditing(undefined);})}
              </>
            )}
            {chosen.includes("Ollama") && (
              <section>
                <h2>Utilises-tu déjà Ollama ?</h2>
                <p>
                  Ollama fait tourner des modèles sur ton Mac. Il doit être
                  démarré pour que Solar puisse les détecter.
                </p>
                <Button
                  className="small-button"
                  disabled={busy}
                  onClick={() => void detect()}
                >
                  Oui · détecter Ollama
                </Button>
                <a
                  className="small-button"
                  href="https://ollama.com/download/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Installer Ollama
                </a>
                <p className="settings-note">
                  Aucun logiciel n’est installé automatiquement.
                </p>
              </section>
            )}
            <Button className="primary-button" onClick={() => setStep(3)}>
              Continuer
            </Button>
          </>
        ) : step === 3 ? (
          <>
            <h1>Un modèle adapté</h1>
            {models.some((m) => m.enabled && m.available !== false && providers.some(p=>p.id===m.providerId && p.protocol==="ollama")) || !chosen.includes("Ollama") ? (
              <p>
                {
                  models.filter((m) => m.enabled && m.available !== false)
                    .length
                }{" "}
                modèle(s) disponible(s). Tu pourras les changer à tout moment.
              </p>
            ) : (
              <>
                <p>
                  {hardware?.totalMemory
                    ? `Ton appareil dispose de ${(hardware.totalMemory / 2 ** 30).toFixed(0)} Go de mémoire.`
                    : "La mémoire exacte est disponible dans l’app macOS."}{" "}
                  Les tailles et besoins ci-dessous sont des estimations, pas
                  une garantie de vitesse.
                </p>
                {recommendModels(hardware?.totalMemory).map((m) => (
                  <div className="model-recommendation" key={m.name}>
                    <strong>{m.name}</strong>
                    <p>
                      ~{m.downloadGB} Go à télécharger · ~{m.memoryGB} Go de
                      mémoire recommandée
                      <br />
                      {m.use} · {m.speed} selon le matériel
                    </p>
                    <Button
                      className="small-button"
                      disabled={busy}
                      onClick={() => void pull(m.name)}
                    >
                      Télécharger avec Ollama
                    </Button>
                  </div>
                ))}
              </>
            )}
            {progress && (
              <div role="status">
                <p>
                  {download} · {progress.status}
                </p>
                {progress.total && (
                  <>
                    <progress
                      max={progress.total}
                      value={progress.completed ?? 0}
                    />
                    <small>
                      {Math.round(
                        ((progress.completed ?? 0) / progress.total) * 100,
                      )}{" "}
                      % de la couche en cours
                    </small>
                  </>
                )}
                {busy && (
                  <Button
                    className="small-button"
                    onClick={() => controller.current?.abort()}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            )}
            <Button
              className="primary-button"
              disabled={busy}
              onClick={() => setStep(4)}
            >
              Continuer
            </Button>
          </>
        ) : (
          <>
            <h1>
              {models.some((m) => m.enabled && m.available !== false)
                ? "Solar is ready."
                : "Ton espace est prêt."}
            </h1>
            <p>
              {models.some((m) => m.enabled && m.available !== false)
                ? "Choisis un modèle et commence à créer."
                : "Ajoute un fournisseur dans les paramètres pour commencer à discuter."}
            </p>
            <Button className="primary-button" onClick={() => void finish()}>
              Commencer à discuter
            </Button>
          </>
        )}
        {step > 0 && step < 4 && (
          <button className="text-button" onClick={() => setStep((s) => s - 1)}>
            Retour
          </button>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
