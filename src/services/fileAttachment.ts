import { imageAttachment } from "./imageAttachment";
import { pastedContent } from "./pastedContent";
export async function fileAttachment(file:File) {
 if(file.type.startsWith("image/"))return imageAttachment(file);
 if(file.size>5_000_000)throw new Error("Choisis un document de moins de 5 Mo.");
 let content:string;
 if(/\.pdf$/i.test(file.name)) {
   const pdf=await import("pdfjs-dist");const worker=await import("pdfjs-dist/build/pdf.worker.min.mjs?url");pdf.GlobalWorkerOptions.workerSrc=worker.default;
   const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
   task.onPassword=()=>{void task.destroy();};
   try {const doc=await task.promise;if(doc.numPages>100)throw new Error("Ce PDF dépasse 100 pages. Importe un extrait.");const pages:string[]=[];let length=0;for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n);const text=await page.getTextContent();const value=text.items.map(item=>"str" in item ? item.str+(item.hasEOL?"\n":" "):"").join("");length+=value.length;if(length>500_000)throw new Error("Le texte du document est trop long. Importe un extrait.");pages.push(value);}content=pages.join("\n\n");}catch(e){throw e instanceof Error && /dépasse|trop long/.test(e.message)?e:new Error("PDF illisible ou protégé. Choisis un PDF contenant du texte.");}finally{await task.destroy();}
 }else if(/\.docx$/i.test(file.name)) {const mammoth=await import("mammoth");try{content=(await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()})).value;}catch{throw new Error("Ce fichier Word est illisible. Choisis un document .docx valide.");}}
 else {if(!/\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|log|yaml|yml|xml|sh|rs|sql)$/i.test(file.name) && !file.type.startsWith("text/"))throw new Error("Choisis une image, un PDF, un document Word (.docx), du texte ou du code.");content=await file.text();}
 if(!content.trim())throw new Error("Ce document ne contient pas de texte lisible. Pour un scan, importe une image avec un modèle vision.");
 if(content.length>500_000)throw new Error("Le texte du document est trop long. Importe un extrait.");
 return {...pastedContent(content),title:file.name};
}
