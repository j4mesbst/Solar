import type { ArtifactSlide, SlideVisual } from "../domain/extensions";
/** One bounded visual vocabulary shared by the preview and editable PPTX. */
export const slidePalette={background:"F7F8FA",ink:"202430",muted:"606A7A",accent:"4361A6",card:"FFFFFF"};
export function validateSlideVisual(value:unknown):SlideVisual|undefined{
 if(value===undefined)return undefined;
 const v=value as Record<string,unknown>;
 if(!v||!["cards","metrics","process","chart"].includes(String(v.type))||!Array.isArray(v.items)||v.items.length<2||v.items.length>6)throw new Error("Visuel invalide : 2 à 6 éléments requis.");
 const text=(x:unknown,max:number)=>{if(typeof x!=="string"||!x.trim()||x.length>max)throw new Error("Texte du visuel invalide.");return x;};
 return {type:v.type as SlideVisual["type"],items:v.items.map(item=>{
  const x=item as Record<string,unknown>;if(!x)throw new Error("Élément visuel invalide.");
  const result:SlideVisual["items"][number]={label:text(x.label,60)};
  if(x.detail!==undefined)result.detail=text(x.detail,240);
  if(x.value!==undefined){if(typeof x.value!=="number"||!Number.isFinite(x.value)||Math.abs(x.value)>1e12)throw new Error("Valeur du graphique invalide.");result.value=x.value;}
  if(v.type==="chart"&&result.value===undefined)throw new Error("Chaque barre doit avoir une valeur numérique réelle.");
  if(x.display!==undefined)result.display=text(x.display,30);
  return result;
 }),...(typeof v.unit==="string"?{unit:text(v.unit,20)}:{})};
}
export function slideLayout(slide:ArtifactSlide,index:number){return slide.visual?.type??(index===0?"cover":"text");}
