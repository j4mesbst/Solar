import type { Message } from "../domain/types";
import { classify, artifactIntent } from "./solarSmart";

export const activityPhrases = {
  connecting: ["Connecting to your model", "Starting the conversation", "Sending your message"],
  waiting: ["Waiting for your model", "Preparing a response", "Your model is getting ready"],
  thinking: ["Solar is thinking", "Thinking through your question", "Working through the details"],
  web: ["Searching the web", "Looking for current sources", "Retrieving web results"],
  writing: ["Writing your response", "Putting the answer together", "Generating a response"],
  code: ["Generating code", "Writing the implementation", "Building your code response"],
  learning: ["Writing an explanation", "Explaining the key ideas", "Developing an example"],
  summary: ["Writing a summary", "Summarizing your content", "Putting the key points together"],
  rewrite: ["Rewriting your text", "Refining the wording", "Drafting your revised text"],
  artifact: ["Creating an artifact", "Building your artifact", "Generating your artifact"],
} as const;

export function responseActivity(message: Message, prompt: string): string {
  // Prefer explicit phase events. Never claim unseen tool execution or hidden reasoning.
  if (message.activity === "thinking") return activityPhrases.thinking[0];
  if (message.activity === "searching") return activityPhrases.web[0];
  if (message.activity === "connecting") return activityPhrases.connecting[0];
  if (!message.content && message.activity !== "writing") return activityPhrases.waiting[0];
  const intent = classify(prompt, false);
  const codeRequested = intent === "code" && /cr[eé]e|g[eé]n[eè]re|[eé]cris|impl[eé]mente|corrige|optimise|refactor|write|generate|build|fix/i.test(prompt);
  const group = artifactIntent(prompt) ? "artifact" : codeRequested ? "code" : /explique|comprendre|explain/i.test(prompt) ? "learning" : intent === "learning" || intent === "summary" || intent === "rewrite" ? intent : "writing";
  const index = [...message.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 3;
  return activityPhrases[group][index];
}
