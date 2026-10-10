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
    ". Respecte le nombre de diapositives demandé. Ne donne pas seulement un plan. Pour les diapositives : une couverture avec un sous-titre bref, puis des titres courts et 3 à 6 points concrets par diapositive séparés par des sauts de ligne. Rédige le contenu final, pas des instructions de création. La mise en page 16:9 et le fichier PowerPoint sont générés par Solar. " +
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
    pptx.theme = {headFontFace:"Aptos Display",bodyFontFace:"Aptos"};
    pptx.company = "Solar";
    a.slides!.forEach((data,index) => {
      const slide = pptx.addSlide();
      const cover=index===0;const foreground=cover?"FFFFFF":"202024";
      slide.background={color:cover?"171C29":"F7F8FA"};
      slide.addShape(pptx.ShapeType.rect,{x:.72,y:.72,w:.48,h:.055,line:{color:"647AA9",transparency:100},fill:{color:"647AA9"}});
      slide.addText(a.title,{x:.72,y:6.92,w:10.8,h:.18,fontFace:"Aptos",fontSize:9,color:cover?"AEB9CF":"687084",margin:0});
      slide.addText(`${index+1} / ${a.slides!.length}`,{x:11.6,y:6.9,w:1,h:.22,fontSize:10,color:cover?"AEB9CF":"687084",align:"right",margin:0});
      slide.addText(data.title,{x:.72,y:cover?1.55:1.02,w:11.8,h:cover?1.6:1.35,fontFace:"Aptos Display",fontSize:cover?38:30,bold:true,color:foreground,fit:"shrink",margin:0,valign:"middle"});
      const lines=slideParagraphs(data.body);
      if(cover){slide.addText(lines.join("\n\n"),{x:.76,y:3.55,w:10.9,h:2.7,fontSize:21,color:"D1D8E5",fit:"shrink",margin:0,valign:"top",paraSpaceAfter:14});}
      else {
        const twoColumns=lines.length>4;
        const columns=twoColumns?[lines.slice(0,Math.ceil(lines.length/2)),lines.slice(Math.ceil(lines.length/2))]:[lines];
        columns.forEach((items,column)=>slide.addText(items.map(text=>({text,options:{breakLine:true,bullet:{indent:18},hanging:4}})),{x:.86+column*6.05,y:2.8,w:twoColumns?5.45:11.6,h:3.7,fontFace:"Aptos",fontSize:twoColumns?20:23,color:"3D475A",fit:"shrink",margin:0,valign:"top",paraSpaceAfter:22}));
      }
    });
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

// Accept common, complete Markdown outputs when a provider ignores the structured envelope.
// A malformed explicit JSON envelope is never silently treated as another artifact.
export function parseRequestedArtifact(text:string,id:string,kind:ArtifactKind,existing?:Artifact):Artifact {
  if(text.includes("```solar-artifact"))return parseArtifact(text,id,existing);
  const jsonBlock=text.match(/```json\s*([\s\S]*?)```/);const candidate=jsonBlock?.[1]??(text.trim().startsWith("{")?text.trim():undefined);
  if(candidate){try{const value=JSON.parse(candidate);if(value?.kind===kind)return validateArtifact(value,id,existing);}catch{/* Ordinary code may itself be JSON; validated Markdown fallback follows. */}}
  const title=existing?.title??text.match(/^#{1,3}\s+(.+)$/m)?.[1]?.slice(0,120)??text.match(/<(?:title|h1)[^>]*>([^<]{1,120})<\//i)?.[1]??({code:"Code",slides:"Présentation",document:"Document",table:"Tableau",diagram:"Diagramme"}[kind]);
  if(kind==="code"||kind==="diagram"){
    const blocks=[...text.matchAll(/```([\w+-]*)\s*\n([\s\S]*?)```/g)];const block=blocks.find(b=>kind!=="diagram"||b[1]==="mermaid");
    if(!block)throw new Error("Le modèle n’a pas fourni de contenu complet pour cet artefact. Réessaie.");
    return validateArtifact({title,kind,language:block[1]||"txt",content:block[2]},id,existing);
  }
  if(kind==="document"||kind==="slides"){
    const parts=text.trim().split(/^#{1,3}\s+/m).filter(Boolean);const sections=parts.map(part=>{const line=part.indexOf("\n");return {title:line<0?title:part.slice(0,line).slice(0,180),body:line<0?part:part.slice(line+1).trim()};}).filter(s=>s.body);
    if(!sections.length||text.trim().length<30)throw new Error("Le contenu de l’artefact est incomplet.");
    return validateArtifact({title,kind,[kind==="slides"?"slides":"sections"]:sections},id,existing);
  }
  const lines=text.split("\n").filter(l=>/^\s*\|/.test(l));const cells=(line:string)=>line.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim());
  if(lines.length<3||!/^[:|\s-]+$/.test(lines[1]))throw new Error("Le modèle n’a pas fourni de tableau exploitable.");
  return validateArtifact({title,kind,columns:cells(lines[0]),rows:lines.slice(2).map(cells)},id,existing);
}

export function slideParagraphs(body:string):string[]{return body.split(/\n+/).map(line=>line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/,"").replace(/\*\*(.*?)\*\*/g,"$1").trim()).filter(Boolean);}
