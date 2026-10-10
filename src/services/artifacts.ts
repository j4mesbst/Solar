import type { Artifact, ArtifactKind } from "../domain/extensions";
export function validateArtifact(
  value: unknown,
  conversationId: string,
  existing?: Artifact,
): Artifact {
  const v = value as Record<string, unknown>;
  if (
    !v ||
    !["code", "slides", "document", "table", "diagram"].includes(String(v.kind))
  )
    throw new Error("Type d’artefact invalide");
  const str = (x: unknown, max = 100000) => {
    if (typeof x !== "string" || x.length > max)
      throw new Error("Texte d’artefact invalide ou trop long");
    return x;
  };
  const result: Artifact = {
    id: existing?.id ?? crypto.randomUUID(),
    conversationId,
    title: str(v.title, 120),
    kind: v.kind as ArtifactKind,
    revision: (existing?.revision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  if (existing && existing.kind !== result.kind)
    throw new Error("Le type de l’artefact existant doit être conservé");
  if (result.kind === "code" || result.kind === "diagram") {
    result.content = str(v.content);
    result.language =
      typeof v.language === "string"
        ? v.language.slice(0, 40)
        : result.kind === "diagram"
          ? "mermaid"
          : "txt";
    if (result.kind === "diagram" && result.content.length > 12000)
      throw new Error("Diagramme trop volumineux");
  }
  if (result.kind === "slides" || result.kind === "document") {
    const field = result.kind === "slides" ? "slides" : "sections";
    const rows = v[field];
    if (!Array.isArray(rows) || !rows.length || rows.length > 40)
      throw new Error("Sections manquantes ou trop nombreuses");
    result[field] = rows.map((row) => ({
      title: str(row?.title, 180),
      body: str(row?.body, 10000),
    }));
  }
  if (result.kind === "table") {
    if (
      !Array.isArray(v.columns) ||
      !v.columns.length ||
      v.columns.length > 40 ||
      !Array.isArray(v.rows) ||
      v.rows.length > 1000
    )
      throw new Error("Tableau invalide ou trop volumineux");
    result.columns = v.columns.map((x) => str(x, 180));
    result.rows = v.rows.map((row) => {
      if (!Array.isArray(row) || row.length !== result.columns!.length)
        throw new Error("Nombre de cellules incorrect");
      return row.map((x) => str(x, 3000));
    });
  }
  if (JSON.stringify(result).length > 500000)
    throw new Error("Artefact trop volumineux");
  return result;
}
export function parseArtifact(text: string, id: string, existing?: Artifact) {
  const block = text.match(/```solar-artifact\s*([\s\S]*?)```/);
  if (!block)
    throw new Error(
      "Le modèle n’a pas fourni d’artefact valide. Réessaie avec un modèle capable de produire du JSON.",
    );
  return validateArtifact(JSON.parse(block[1]), id, existing);
}
export function artifactInstruction(kind: ArtifactKind, existing?: Artifact) {
  return (
    "\nProduis un véritable artefact structuré. Après une brève réponse, fournis exactement un bloc ```solar-artifact contenant un JSON valide sans commentaire. Schéma : " +
    JSON.stringify({
      kind,
      title: "Titre",
      ...(kind === "slides"
        ? {
            slides: [
              { title: "Titre de la diapositive", body: "Contenu concret" },
            ],
          }
        : kind === "document"
          ? { sections: [{ title: "Section", body: "Contenu complet" }] }
          : kind === "table"
            ? { columns: ["Colonne"], rows: [["Valeur"]] }
            : {
                language: kind === "diagram" ? "mermaid" : "python",
                content: "Code complet",
              }),
    }) +
    ". Respecte le nombre de diapositives demandé. Ne donne pas seulement un plan. " +
    (existing
      ? "Modifie cet artefact existant en conservant son type et son contenu non concerné : " +
        JSON.stringify(existing)
      : "")
  );
}
export function displayAnswer(text: string) {
  return text
    .replace(/```solar-(?:artifact|changes)[\s\S]*?(?:```|$)/g, "")
    .trim();
}
export function safeFilename(title: string, extension: string) {
  return (
    (title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 70) || "Solar") +
    "." +
    extension
  );
}
export function csvContent(a: Artifact) {
  const cell = (x: string) =>
    '"' + (/^[=+@\-\t\r]/.test(x) ? "'" + x : x).replace(/"/g, '""') + '"';
  return [a.columns!, ...a.rows!]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export async function exportArtifact(
  a: Artifact,
  format: string,
): Promise<Blob> {
  if (a.kind === "code") {
    return new Blob([a.content ?? ""], { type: "text/plain;charset=utf-8" });
  }
  if (a.kind === "diagram" && format === "mmd")
    return new Blob([a.content ?? ""], { type: "text/plain" });
  if (a.kind === "diagram" && format === "svg") {
    const svg = await renderDiagram(a.content ?? "");
    return new Blob([svg], { type: "image/svg+xml" });
  }
  if (a.kind === "slides" && format === "pptx") {
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Solar";
    pptx.subject = a.title;
    pptx.title = a.title;
    for (const data of a.slides!) {
      const slide = pptx.addSlide();
      slide.background = { color: "FAFAFA" };
      slide.addText(data.title, {
        x: 0.7,
        y: 0.5,
        w: 11.9,
        h: 1,
        fontFace: "Aptos",
        fontSize: 28,
        bold: true,
        color: "202024",
        breakLine: false,
      });
      slide.addText(data.body, {
        x: 0.7,
        y: 1.8,
        w: 11.9,
        h: 4.8,
        fontFace: "Aptos",
        fontSize: 19,
        color: "404048",
        fit: "shrink",
        valign: "top",
      });
    }
    const out = await pptx.write({ outputType: "blob" });
    return out as Blob;
  }
  if (a.kind === "document" && format === "docx") {
    const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: a.title, heading: HeadingLevel.TITLE }),
            ...a.sections!.flatMap((s) => [
              new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }),
              ...s.body.split("\n").map((text) => new Paragraph({ text })),
            ]),
          ],
        },
      ],
    });
    return Packer.toBlob(doc);
  }
  if (a.kind === "document" && format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 22;
    const line = (text: string, size: number) => {
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, 170) as string[];
      for (const line of lines) {
        if (y > 277) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += size * 0.48;
      }
      y += 6;
    };
    line(a.title, 22);
    for (const section of a.sections!) {
      line(section.title, 16);
      line(section.body, 11);
    }
    return doc.output("blob");
  }
  if (a.kind === "table" && format === "csv")
    return new Blob(["\uFEFF" + csvContent(a)], {
      type: "text/csv;charset=utf-8",
    });
  if (a.kind === "table" && format === "xlsx") {
    const module = await import("exceljs");
    const Workbook = module.default.Workbook;
    const book = new Workbook();
    const sheet = book.addWorksheet("Solar");
    sheet.addRow(a.columns!);
    for (const row of a.rows!) sheet.addRow(row);
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach((c) => (c.width = 24));
    return new Blob(
      [(await book.xlsx.writeBuffer()) as unknown as ArrayBuffer],
      {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    );
  }
  throw new Error("Format non pris en charge");
}
export async function renderDiagram(content: string) {
  if (content.length > 12000) throw new Error("Diagramme trop volumineux");
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    maxTextSize: 12000,
    maxEdges: 100,
    theme: "neutral",
    flowchart: { htmlLabels: false },
    suppressErrorRendering: true,
  });
  const { svg } = await mermaid.render(
    "solar-diagram-" + crypto.randomUUID().replaceAll("-", ""),
    content,
  );
  return svg;
}
export async function downloadBlob(blob: Blob, name: string) {
  if (blob.size > 20000000) throw new Error("Export trop volumineux");
  if (
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  ) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<boolean>("artifact_save", {
      content: Array.from(new Uint8Array(await blob.arrayBuffer())),
      suggestedName: name,
    });
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function artifactFormats(a: Artifact) {
  return a.kind === "slides"
    ? ["pptx"]
    : a.kind === "document"
      ? ["pdf", "docx"]
      : a.kind === "table"
        ? ["csv", "xlsx"]
        : a.kind === "diagram"
          ? ["svg", "mmd"]
          : [
              (
                {
                  python: "py",
                  javascript: "js",
                  typescript: "ts",
                  html: "html",
                  css: "css",
                  rust: "rs",
                  json: "json",
                } as Record<string, string>
              )[a.language ?? ""] ?? "txt",
            ];
}
