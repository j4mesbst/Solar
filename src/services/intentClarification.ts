export interface IntentQuestion { id: string; label: string; options: string[]; multiple?: boolean }
export interface IntentResolution { prompt: string; answers: Record<string, string[]> }

const platforms = ["macOS", "Web", "iPhone / mobile", "iPad / tablette", "Utilise le projet actuel"];
const styles = ["Minimaliste", "Sobre et professionnel", "Chaleureux", "Dense et fonctionnel"];
const codeAreas = ["Dans le fichier concerné", "Dans le module le plus proche", "À déterminer après inspection"];
const bugEvidence = ["Comportement attendu", "Message d’erreur observé", "Étapes pour reproduire"];
const artifactFormats = ["HTML interactif", "Document", "Présentation", "Code / fichiers du projet"];

const uiIntent = /\b(interface|ui|ux|page|écran|screen|design|dashboard|onboarding|maquette|layout)\b/i;
const bugIntent = /\b(bug|crash|erreur|plante|marche pas|ne fonctionne|régression|broken|error|crash|fix|corrige|répare)\b/i;
const codeIntent = /\b(code|fichier|fonction|feature|fonctionnalité|composant|implémente|implémenter|développe|program|code|component|implement|refactor)\b/i;
const artifactIntent = /\b(artefact|artifact|document|présentation|diaporama|powerpoint|prototype|livrable|fichier|export)\b/i;
const action = /\b(crée|créer|construis|construire|fais|faire|ajoute|ajouter|refais|refaire|améliore|implémente|corrige|répare|build|create|make|implement|fix|generate)\b/i;

function alreadyAnswered(text: string, prompt: string, options: string[]) {
  const known = `${text} ${prompt}`.toLocaleLowerCase();
  return options.some(option => known.includes(option.toLocaleLowerCase().replace(" / mobile", "")));
}

export function buildIntentQuestions(prompt: string, context = "", workMode = false): IntentQuestion[] {
  const text = prompt.trim();
  if (!text || text.split(/\s+/).length < 3 || !action.test(text)) return [];
  const known = `${text}\n${context}`;
  const vague = text.split(/\s+/).length <= 11 && /\b(quelque chose|un truc|ça|ca|this|something|it|le problème|le probleme|améliore|refais|make it|fix it)\b/i.test(text);
  const questions: IntentQuestion[] = [];
  if (bugIntent.test(text) && !alreadyAnswered(known, "", bugEvidence)) {
    questions.push({ id: "bug-evidence", label: "Quelle information décrit le mieux le problème ?", options: bugEvidence, multiple: true });
    return questions.slice(0, 3);
  }
  if (uiIntent.test(text) && (vague || text.split(/\s+/).length <= 8)) {
    if (!alreadyAnswered(known, "", platforms)) questions.push({ id: "platform", label: "Sur quelle plateforme doit d’abord fonctionner l’interface ?", options: platforms });
    if (!alreadyAnswered(known, "", styles)) questions.push({ id: "style", label: "Quelle direction visuelle souhaites-tu ?", options: styles });
    if (questions.length < 3 && !/(réglage|formulaire|navigation|recherche|lecture|chat|connexion|settings|form|navigation|search)/i.test(known)) questions.push({ id: "behavior", label: "Quel est le comportement principal à privilégier ?", options: ["Parcours simple", "Accès rapide aux actions", "Contenu d’abord", "États et réglages détaillés"] });
  } else if (workMode && codeIntent.test(text) && vague) {
    questions.push({ id: "code-scope", label: "Quel résultat doit changer en priorité ?", options: ["Comportement visible", "Architecture / structure", "Performance", "Correction d’un défaut"] });
    if (!/\b(fichier|module|composant|page|service|api|écran|classe|function|component|module)\b/i.test(known)) questions.push({ id: "code-area", label: "Comment choisir la zone à modifier ?", options: codeAreas });
  } else if (artifactIntent.test(text) && vague) {
    questions.push({ id: "artifact-format", label: "Quel format de livrable préfères-tu ?", options: artifactFormats });
    if (!/\b(contenu|sujet|pour|à propos|about|for|sur)\b/i.test(known)) questions.push({ id: "artifact-content", label: "Quel contenu doit-il couvrir ?", options: ["Le sujet de ma demande", "Un résumé court", "Un livrable détaillé"] });
  } else if (workMode && vague) {
    questions.push({ id: "code-goal", label: "Quel résultat veux-tu obtenir dans le projet ?", options: ["Ajouter une fonctionnalité", "Corriger un problème", "Améliorer l’interface", "Optimiser le code"] });
  }
  return questions.slice(0, 4);
}

export function summarizeIntent(resolution: IntentResolution, questions: IntentQuestion[]) {
  return questions.flatMap(question => (resolution.answers[question.id] ?? []).map(answer => answer === "Autre" ? "" : answer)).filter(Boolean).join(" · ");
}

export function intentInstruction(resolution: IntentResolution) {
  const details = Object.entries(resolution.answers).flatMap(([question, answers]) => answers.map(answer => `${question}: ${answer}`));
  return details.length ? `\nClarifications choisies par l’utilisateur pour sa demande (« ${resolution.prompt.slice(0, 600)} ») :\n${details.map(value => `- ${value}`).join("\n")}\nTraite ces choix comme des contraintes confirmées.` : "";
}
