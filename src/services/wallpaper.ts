export async function importWallpaper(file:File):Promise<string> {
  if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Choisis une image PNG, JPEG ou WebP.");
  if(file.size>20_000_000)throw new Error("Image trop volumineuse (20 Mo maximum).");
  const url=URL.createObjectURL(file);
  try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,1920/image.naturalWidth,1200/image.naturalHeight);const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext("2d")!.drawImage(image,0,0,canvas.width,canvas.height);const data=canvas.toDataURL("image/webp",.75);if(data.length>1_500_000)throw new Error("Image trop détaillée. Choisis une image plus légère.");return data;}finally{URL.revokeObjectURL(url);}
}
export function safeWallpaper(value?:string){return value && value.length<=1_500_000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:undefined;}
