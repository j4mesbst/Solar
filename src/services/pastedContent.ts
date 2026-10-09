import type { Draft, PastedContent } from "../domain/types";
export const shouldCompactPaste = (content: string) => content.length >= 1500 || content.split("\n").length >= 30;
export function pastedContent(content: string): PastedContent {
  const code = /```|(?:^|\n)\s*(?:import |export |function |const |let |class |def |public |SELECT |<\w+[\s>])/m.test(content);
  return { id: crypto.randomUUID(), content, kind: code ? "code" : "text", title: code ? "Code collé" : "Texte collé" };
}
export function draftMessage(draft: Pick<Draft,"text" | "attachments">): string {
  // Only separator text is added. Attachment bytes, whitespace and indentation are untouched.
  return [draft.text, ...draft.attachments.map(attachment => `${attachment.title} :\n${attachment.content}`)].filter(Boolean).join("\n\n");
}
