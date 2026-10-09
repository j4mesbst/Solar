import type { Conversation, Message } from "../domain/types";
export function conversationTitle(text: string, attachments = 0): string {
  if (!text.trim()) return attachments ? "Document à explorer" : "Nouveau chat";
  if (/^\s*```/.test(text) || /^\s*(?:const |import |def |function |class )/.test(text)) return "Question sur du code";
  const first = text.split(/\n/).find(line => line.trim())?.replace(/^\s*[#>*-]+\s*/, "").replace(/\s+/g, " ").trim() ?? "Nouveau chat";
  return first.length > 54 ? `${first.slice(0, 51).replace(/\s+\S*$/, "")}…` : first;
}
export function exportConversations(entries: { conversation: Conversation; messages: Message[] }[], format: "md" | "txt"): string {
  return entries.filter(entry => !entry.conversation.temporary && !entry.conversation.id.startsWith("temp:")).map(({ conversation, messages }) => {
    const heading = format === "md" ? `# ${conversation.title}` : conversation.title;
    return `${heading}\n\n${messages.filter(message => message.role !== "system").sort((a,b) => a.order-b.order).map(message => `${format === "md" ? "## " : ""}${message.role === "user" ? "Vous" : "Réponse"}${message.modelName ? ` (${message.modelName})` : ""}\n\n${message.content}`).join("\n\n")}\n`;
  }).join("\n---\n\n");
}
export async function saveExport(content: string, format: "md" | "txt") {
  const name = `solar-conversations.${format}`;
  if ((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("export_save", { content, format, suggestedName: name });
  } else {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true;
  }
}
