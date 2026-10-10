import type { ArtifactKind } from "../domain/extensions";
export type Intent =
  | "simple"
  | "recent"
  | "code"
  | "learning"
  | "document"
  | "artifact"
  | "summary"
  | "rewrite";
export function artifactIntent(text: string): ArtifactKind | undefined {
  if (
    !/cr[eé]e|g[eé]n[eè]re|fais|produis|modifie|corrige|ajoute|create|generate|export/i.test(
      text,
    )
  )
    return;
  if (/diapositive|pr[eé]sentation|powerpoint|pptx|slides/i.test(text))
    return "slides";
  if (/xlsx|csv|tableau interactif|feuille de calcul/i.test(text))
    return "table";
  if (/diagramme|organigramme|sch[eé]ma|mermaid/i.test(text)) return "diagram";
  if (/document|rapport|docx|pdf/i.test(text)) return "document";
  if (/artefact|artifact|site web|page web|interface.*html|application.*html/i.test(text)) return "code";
  if (/fichier.*(?:python|code|html|\.py|\.js|\.ts)|artefact.*code/i.test(text))
    return "code";
}
export function classify(text: string, attachments: boolean): Intent {
  if (artifactIntent(text)) return "artifact";
  if (/aujourd.hui|actualit|cette semaine|latest|news|r[eé]cent/i.test(text))
    return "recent";
  if (attachments) return "document";
  if (/code|fonction|composant|typescript|python|programm/i.test(text))
    return "code";
  if (/explique|apprendre|comprendre|cours/i.test(text)) return "learning";
  if (/r[eé]sum/i.test(text)) return "summary";
  if (/reformul|r[eé][eé]cris/i.test(text)) return "rewrite";
  return "simple";
}
export function smartInstruction(
  text: string,
  attachments: boolean,
  enabled: boolean,
) {
  if (!enabled) return "";
  return (
    {
      simple: "",
      recent:
        "Si aucune source récente n’est fournie, indique la limite de tes connaissances.",
      code: "Préserve les interfaces existantes et explique les vérifications pertinentes.",
      learning: "Explique progressivement avec un exemple adapté à la demande.",
      document: "Base ton analyse sur les documents réellement fournis.",
      artifact: "",
      summary: "Préserve les faits essentiels du contenu fourni.",
      rewrite:
        "Respecte le sens, le ton demandé et les contraintes explicites.",
    }[classify(text, attachments)] +
    " Les instructions explicites de l’utilisateur priment."
  );
}
