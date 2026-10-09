import type { Message } from "../domain/types";
export function messagePayload(message: Message, local: boolean) {
  const images = (message.attachments ?? []).filter(item => item.kind === "image").map(item => item.content);
  if (!images.length || message.role !== "user") return { role: message.role, content: message.content };
  if (images.some(image => !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image))) throw new Error("L’image jointe est invalide. Supprime-la et importe-la à nouveau.");
  if (local) return { role: message.role, content: message.content, images: images.map(image => image.slice(image.indexOf(",") + 1)) };
  return { role: message.role, content: [{ type: "text", text: message.content }, ...images.map(url => ({ type: "image_url", image_url: { url } }))] };
}
