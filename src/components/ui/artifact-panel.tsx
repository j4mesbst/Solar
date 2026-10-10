import { slideParagraphs } from "../../services/artifacts";
import { useEffect, useRef, useState } from "react";
import { X, Download, ChevronLeft, ChevronRight, Copy, Maximize2, Minimize2 } from "lucide-react";
import type { Artifact } from "../../domain/extensions";
import {
  artifactFormats,
  downloadBlob,
  exportArtifact,
  renderDiagram,
  safeFilename,
  validateArtifact,
} from "../../services/artifacts";
import { extensionStore } from "../../services/extensionStore";
import { MarkdownMessage } from "./markdown-message";
export function ArtifactPanel({
  artifact,
  onChange,
  onClose,
}: {
  artifact: Artifact;
  onChange: (a: Artifact) => void;
  onClose: () => void;
}) {
  const [expanded,setExpanded]=useState(false);
  const panelRef=useRef<HTMLElement>(null);
  useEffect(()=>{if(!expanded)return;const before=document.activeElement as HTMLElement|null;
    const items=()=>Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea,select,[tabindex="0"]')??[]);
    const background=Array.from(document.querySelectorAll<HTMLElement>(".app-rail,.sidebar,.workspace>.header,.conversation-area"));const previous=background.map(node=>node.inert);background.forEach(node=>node.inert=true);
    items()[0]?.focus();
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();setExpanded(false);}if(event.key!=="Tab")return;const controls=items(),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}};
    window.addEventListener("keydown",close);return()=>{window.removeEventListener("keydown",close);background.forEach((node,i)=>node.inert=previous[i]);before?.focus();};
  },[expanded]);

  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState(JSON.stringify(artifact, null, 2));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [svg, setSvg] = useState("");
  useEffect(() => {
    setDraft(JSON.stringify(artifact, null, 2));
    setIndex((i) => Math.min(i, (artifact.slides?.length ?? 1) - 1));
    if (artifact.kind === "diagram") {
      let live = true;
      void renderDiagram(artifact.content ?? "")
        .then((s) => {
          if (live) setSvg(s);
        })
        .catch((e) => {
          if (live) setError(String(e));
        });
      return () => {
        live = false;
      };
    }
  }, [artifact]);
  const save = async () => {
    try {
      const next = validateArtifact(
        JSON.parse(draft),
        artifact.conversationId,
        artifact,
      );
      await extensionStore.save(next);
      onChange(next);
      setMode("preview");
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  const exportFile = async (format: string) => {
    setBusy(true);
    try {
      await downloadBlob(
        await exportArtifact(artifact, format),
        safeFilename(artifact.title, format),
      );
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const updateCell = async (row: number, col: number, text: string) => {
    const next = {
      ...artifact,
      rows: artifact.rows!.map((r, i) =>
        i === row ? r.map((v, j) => (j === col ? text : v)) : r,
      ),
      revision: artifact.revision + 1,
      updatedAt: new Date().toISOString(),
    };
    await extensionStore.save(next);
    onChange(next);
  };
  return (
    <aside ref={panelRef} role={expanded?"dialog":"complementary"} aria-modal={expanded||undefined} className={`artifact-panel ${expanded?"artifact-expanded":""}`} aria-label="Artefact">
      <header>
        <div>
          <strong>{artifact.title}</strong>
          <small>Version {artifact.revision}</small>
        </div>
        <button className="icon-button artifact-expand" aria-label={expanded?"Réduire l’artefact":"Agrandir l’artefact"} aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
        <button
          className="icon-button"
          aria-label="Fermer l’artefact"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="artifact-tools">
        <button
          className="small-button"
          onClick={() => setMode(mode === "edit" ? "preview" : "edit")}
        >
          {mode === "edit" ? "Aperçu" : "Modifier"}
        </button>
        {artifactFormats(artifact).map((f) => (
          <button
            disabled={busy}
            key={f}
            className="small-button"
            onClick={() => void exportFile(f)}
          >
            <Download size={13} />
            {f.toUpperCase()}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="artifact-body">
        {mode === "edit" ? (
          <>
            <textarea
              aria-label="Structure de l’artefact"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
            <button className="primary-button" onClick={() => void save()}>
              Enregistrer les modifications
            </button>
          </>
        ) : (
          <>
            {artifact.kind === "slides" && (
              <>
                <div className={`artifact-slide ${index===0?"slide-cover":"slide-content"}`}>
                  <h2>{artifact.slides![index].title}</h2>
                  {index===0 ? <p>{slideParagraphs(artifact.slides![index].body).join("\n")}</p> : <ul>{slideParagraphs(artifact.slides![index].body).map((line,i)=><li key={i}>{line}</li>)}</ul>}<small className="slide-footer">{index+1} / {artifact.slides!.length}</small>
                </div>
                <div className="slide-navigation">
                  <button
                    aria-label="Diapositive précédente"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => i - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>
                    {index + 1} / {artifact.slides!.length}
                  </span>
                  <button
                    aria-label="Diapositive suivante"
                    disabled={index === artifact.slides!.length - 1}
                    onClick={() => setIndex((i) => i + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
            {artifact.kind === "document" && (
              <>
                <h1>{artifact.title}</h1>
                {artifact.sections!.map((s, i) => (
                  <section key={i}>
                    <h2>{s.title}</h2>
                    <div className="message-content">
                      <MarkdownMessage content={s.body} />
                    </div>
                  </section>
                ))}
              </>
            )}
            {artifact.kind === "code" && artifact.language === "html" && <iframe className="artifact-html-preview" title="Aperçu HTML de l’artefact" sandbox="allow-scripts" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'">${artifact.content??""}`}/>}
            {artifact.kind === "code" && (
              <>
                <button
                  className="small-button"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(artifact.content ?? "")
                      .catch(() => setError("Copie indisponible"))
                  }
                >
                  <Copy size={13} />
                  Copier
                </button>
                <div className="message-content">
                  <MarkdownMessage
                    content={
                      "```" +
                      (artifact.language ?? "") +
                      "\n" +
                      artifact.content +
                      "\n```"
                    }
                  />
                </div>
                <textarea
                  aria-label="Modifier le code"
                  spellCheck={false}
                  value={artifact.content}
                  onChange={(e) => {
                    const next = {
                      ...artifact,
                      content: e.target.value,
                      revision: artifact.revision + 1,
                      updatedAt: new Date().toISOString(),
                    };
                    onChange(next);
                    void extensionStore
                      .save(next)
                      .catch((e) => setError(String(e)));
                  }}
                />
              </>
            )}
            {artifact.kind === "table" && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {artifact.columns!.map((col, i) => (
                        <th key={i}>
                          <button
                            onClick={() => {
                              const next = {
                                ...artifact,
                                rows: [...artifact.rows!].sort((a, b) =>
                                  a[i].localeCompare(b[i], undefined, {
                                    numeric: true,
                                  }),
                                ),
                                revision: artifact.revision + 1,
                              };
                              onChange(next);
                              void extensionStore
                                .save(next)
                                .catch((e) => setError(String(e)));
                            }}
                          >
                            {col} ↕
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {artifact.rows!.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>
                            <input
                              aria-label={`Cellule ${i + 1}, ${j + 1}`}
                              defaultValue={cell}
                              key={cell}
                              onBlur={(e) =>
                                void updateCell(i, j, e.target.value).catch(
                                  (e) => setError(String(e)),
                                )
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {artifact.kind === "diagram" && svg && (
              <iframe
                title="Diagramme Solar"
                sandbox=""
                srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{margin:10px}svg{max-width:100%;height:auto}</style>${svg}`}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}
