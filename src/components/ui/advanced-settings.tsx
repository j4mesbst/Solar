import { useEffect, useState } from "react";
import type { AppSettings, Model } from "../../domain/types";
import type { Hardware, Metrics } from "../../domain/extensions";
import { detectHardware } from "../../services/performance";
import { secretVault } from "../../services/nativeVault";
import { solarStore } from "../../services/store";
export function WebSettingsPanel({
  settings,
  onSave,
}: {
  settings: AppSettings;
  onSave: (s: AppSettings) => Promise<void>;
}) {
  const web = settings.web ?? {
    mode: "auto",
    provider: "searxng",
    consent: false,
  };
  const [secret, setSecret] = useState("");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [endpoint, setEndpoint] = useState(web.endpoint ?? "");
  useEffect(() => {
    setSecret("");
    void secretVault
      .get("solar:web:" + web.provider)
      .then((s) => setConfigured(Boolean(s)))
      .catch((e) => setError(String(e)));
  }, [web.provider]);
  const saveKey = async () => {
    try {
      await secretVault.set("solar:web:" + web.provider, secret.trim());
      setSecret("");
      setConfigured(true);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Solar Web</h2>
          <p>
            Des informations récentes, avec les sources réellement récupérées.
          </p>
        </div>
      </div>
      <div className="preference-row">
        <div>
          <h3>Recherche Internet</h3>
          <p>
            Automatique pour les questions récentes, toujours activée, ou
            désactivée.
          </p>
        </div>
        <select
          aria-label="Mode de recherche Web"
          value={web.mode}
          onChange={(e) =>
            void onSave({
              ...settings,
              web: { ...web, mode: e.target.value as typeof web.mode },
            })
          }
        >
          <option value="auto">Auto</option>
          <option value="on">Toujours</option>
          <option value="off">Désactivée</option>
        </select>
      </div>
      <div className="preference-row">
        <div>
          <h3>Moteur</h3>
          <p>
            SearXNG peut fonctionner sur ta propre instance sans clé payante.
            Brave et Ollama nécessitent leur clé dédiée.
          </p>
        </div>
        <select
          aria-label="Moteur de recherche"
          value={web.provider}
          onChange={(e) =>
            void onSave({
              ...settings,
              web: { ...web, provider: e.target.value as typeof web.provider },
            })
          }
        >
          <option value="searxng">SearXNG</option>
          <option value="brave">Brave Search</option>
          <option value="ollama">Ollama Web Search</option>
        </select>
      </div>
      {web.provider === "searxng" ? (
        <label className="advanced-field">
          URL de l’instance
          <input
            type="url"
            aria-label="URL SearXNG"
            value={endpoint}
            placeholder="http://localhost:8080/"
            onChange={(e) => setEndpoint(e.target.value)}
            onBlur={() => {
              try {
                if (
                  endpoint &&
                  !["http:", "https:"].includes(new URL(endpoint).protocol)
                )
                  throw new Error("URL invalide");
                void onSave({ ...settings, web: { ...web, endpoint } });
                setError("");
              } catch {
                setError(
                  "L’URL SearXNG doit commencer par http:// ou https://.",
                );
              }
            }}
          />
          <small>
            Le format JSON doit être activé sur l’instance. Dans l’aperçu
            navigateur, elle doit autoriser CORS.
          </small>
        </label>
      ) : (
        <div className="advanced-field">
          <label>
            Clé de recherche
            <input
              type="password"
              aria-label="Clé de recherche Web"
              value={secret}
              placeholder={
                configured ? "•••••••• — configurée" : "Clé API du moteur"
              }
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
          <button
            className="small-button"
            disabled={!secret.trim()}
            onClick={() => void saveKey()}
          >
            Enregistrer la clé
          </button>
        </div>
      )}
      <label className="cloud-consent">
        <input
          type="checkbox"
          aria-label="Autoriser les recherches externes"
          checked={Boolean(web.consent)}
          onChange={(e) =>
            void onSave({
              ...settings,
              web: { ...web, consent: e.target.checked },
            })
          }
        />
        J’autorise l’envoi de mes requêtes au moteur choisi. Les extraits
        récupérés sont transmis au modèle sélectionné.
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </>
  );
}
export function PerformancePanel({
  settings,
  models,
  onSave,
}: {
  settings: AppSettings;
  models: Model[];
  onSave: (s: AppSettings) => Promise<void>;
}) {
  const [hardware, setHardware] = useState<Hardware>();
  const [metrics, setMetrics] = useState<{ name: string; value: Metrics }[]>(
    [],
  );
  const [error, setError] = useState("");
  useEffect(() => {
    void detectHardware()
      .then(setHardware)
      .catch((e) => setError(String(e)));
    void (async () => {
      const conversations = await solarStore.listConversations();
      const messages = (
        await Promise.all(
          conversations.slice(0, 20).map((c) => solarStore.listMessages(c.id)),
        )
      ).flat();
      setMetrics(
        messages
          .filter((m) => m.metrics)
          .slice(-20)
          .reverse()
          .map((m) => ({ name: m.modelName ?? "Modèle", value: m.metrics! })),
      );
    })().catch((e) => setError(String(e)));
  }, []);
  return (
    <>
      <div className="section-title">
        <div>
          <h2>Solar Performance</h2>
          <p>Réglages locaux explicites et mesures réelles des réponses.</p>
        </div>
      </div>
      <div className="preference-row">
        <div>
          <h3>Profil Ollama</h3>
          <p>
            Économique : contexte 2 048, préchargement désactivé, libération
            après réponse. Équilibré : contexte 4 096, conservation 5 min.
            Performance : contexte 8 192, conservation 15 min. Un contexte plus
            court peut réduire les détails disponibles.
          </p>
        </div>
        <select
          aria-label="Profil de performance"
          value={settings.performanceProfile ?? "balanced"}
          onChange={(e) =>
            void onSave({
              ...settings,
              performanceProfile: e.target
                .value as AppSettings["performanceProfile"],
            })
          }
        >
          <option value="eco">Économique</option>
          <option value="balanced">Équilibré</option>
          <option value="performance">Performance</option>
        </select>
      </div>
      {hardware && (
        <div className="hardware-summary">
          <h3>Matériel</h3>
          <p>
            {hardware.architecture} · {hardware.os}
          </p>
          {hardware.totalMemory ? (
            <p>
              {(hardware.totalMemory / 2 ** 30).toFixed(1)} Go de mémoire totale
              {hardware.availableMemory
                ? ` · ${(hardware.availableMemory / 2 ** 30).toFixed(1)} Go libres/inactifs (estimation ponctuelle)`
                : ""}
            </p>
          ) : (
            <p>La mémoire exacte nécessite l’application macOS.</p>
          )}
          {hardware.gpu && <p>{hardware.gpu}</p>}
        </div>
      )}
      <p className="settings-note">
        Solar réutilise les modèles chargés et évite de précharger un deuxième
        modèle lorsqu’un autre est résident. Aucun réglage GPU fictif.
      </p>
      {hardware?.totalMemory &&
        models
          .filter(
            (m) => m.sizeBytes && m.sizeBytes > hardware.totalMemory! * 0.65,
          )
          .map((m) => (
            <p key={m.id} className="form-error">
              {m.name} : poids {(m.sizeBytes! / 2 ** 30).toFixed(1)} Go. Prévois
              aussi la mémoire de contexte ; un modèle plus petit ou quantifié
              peut être préférable.
            </p>
          ))}
      <h3>Dernières mesures</h3>
      {!metrics.length ? (
        <p className="settings-note">
          Les mesures apparaissent après une réponse. Les tokens/seconde et le
          chargement ne sont affichés que si Ollama les fournit.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Modèle</th>
                <th>Premier token</th>
                <th>Chargement</th>
                <th>Tokens/s</th>
                <th>Durée</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => (
                <tr key={i}>
                  <td>{m.name}</td>
                  <td>
                    {m.value.firstTokenMs !== undefined
                      ? `${(m.value.firstTokenMs / 1000).toFixed(2)} s`
                      : "—"}
                  </td>
                  <td>
                    {m.value.loadMs !== undefined
                      ? `${(m.value.loadMs / 1000).toFixed(2)} s`
                      : "—"}
                  </td>
                  <td>{m.value.tokensPerSecond?.toFixed(1) ?? "—"}</td>
                  <td>{(m.value.totalMs / 1000).toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
