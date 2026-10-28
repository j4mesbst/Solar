import type { Effort, Message } from "../domain/types";

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

// Only complete social utterances qualify. A short follow-up such as “pourquoi ?”
// still needs the preceding exchange, and “salut, corrige ce code” is a real task.
export function isSocialMessage(text: string) {
  return /^(?:(?:salut|bonjour|bonsoir|hello|hey|coucou)(?: solar)?|(?:et )?(?:ca va|comment vas tu|comment tu vas|comment allez vous|comment ca va|tu vas bien|ca va bien)(?: (?:deja|toi|et toi))?|et toi|merci(?: beaucoup)?|ok(?: merci)?|d accord|bonne (?:journee|soiree)|a bientot)$/.test(normalize(text));
}

export function normalChatPolicy(text: string, effort: Effort, attachments: boolean) {
  const social = !attachments && isSocialMessage(text);
  return {
    social,
    // Greetings must never start a plan, an artifact or a specialized skill.
    effort: social ? "low" as const : effort,
    maxOutputTokens: social ? 128 : undefined,
    instruction: social
      ? "L’utilisateur échange une salutation ou une formule de conversation. Réponds naturellement en une ou deux phrases dans sa langue. Ne lance aucune tâche, présentation, code ou livrable à partir d’un ancien sujet."
      : "Réponds à la dernière demande de l’utilisateur. L’historique sert à comprendre ses références, pas à reprendre spontanément une ancienne tâche. La longueur de la réponse doit être proportionnée à la question. Ne propose pas un livrable non demandé.",
  };
}

export function normalChatContext(messages: Message[], contextWindow = 4096, reservedOutput = 1024) {
  const current = messages.at(-1);
  if (!current) return [];
  if (!current.attachments?.length && isSocialMessage(current.displayText ?? current.content)) {
    // A stray assistant response must not contaminate the next greeting.
    return [current];
  }
  // Conservative character estimate, not a claim to use the model's tokenizer.
  let remaining = Math.max(1200, (contextWindow - reservedOutput - 900) * 2.5) - current.content.length;
  const selected: Message[] = [current];
  for (let i = messages.length - 2; i >= 0 && selected.length < 13; i--) {
    const message = messages[i];
    if (message.role === "system" || message.status !== "completed") continue;
    const cost = message.content.length + (message.attachments?.some(a => a.kind === "image") ? 1800 : 0) + 80;
    if (cost > remaining) break;
    selected.unshift(message); remaining -= cost;
  }
  // Avoid an orphan assistant answer at the start of a clipped context.
  while (selected[0]?.role === "assistant") selected.shift();
  return selected;
}
