import type { PastedContent } from "../domain/types";
export async function imageAttachment(file: File): Promise<PastedContent> {
  if (!/^(image\/(png|jpeg|webp))$/.test(file.type)) throw new Error("Utilise une image PNG, JPEG ou WebP.");
  if (file.size > 10_000_000) throw new Error("L’image dépasse 10 Mo. Choisis une version plus petite.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) throw new Error("Cette image est trop grande ou illisible.");
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("Impossible de préparer l’image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let content = canvas.toDataURL(file.type, 0.86);
    if (content.length > 1_500_000) { context.globalCompositeOperation = "destination-over"; context.fillStyle = "#fff"; context.fillRect(0,0,canvas.width,canvas.height); content = canvas.toDataURL("image/jpeg", 0.8); }
    if (content.length > 2_000_000) throw new Error("L’image reste trop lourde. Réduis sa taille avant de l’importer.");
    return { id: crypto.randomUUID(), title: file.name || "Image jointe", kind: "image", content };
  } catch (reason) { throw reason instanceof Error ? reason : new Error("Impossible de lire cette image."); }
  finally { URL.revokeObjectURL(url); }
}
