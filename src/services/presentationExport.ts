import type PptxGenJS from "pptxgenjs";
import type { Artifact } from "../domain/extensions";
import { slidePalette as palette } from "./slideDesign.ts";
/** Editable shapes and charts; no flattened screenshots or external asset dependencies. */
export function buildPresentationSlides(pptx:PptxGenJS,a:Artifact){
 a.slides!.forEach((data,index)=>{
  const slide=pptx.addSlide(),visual=data.visual,cover=index===0&&!visual;
  const ink=cover?"FFFFFF":palette.ink,muted=cover?"BBC6DB":palette.muted;
  slide.background={color:cover?"171C29":palette.background};
  const text=(value:string,x:number,y:number,w:number,h:number,size:number,color=ink,bold=false)=>slide.addText(value,{x,y,w,h,fontFace:"Aptos",fontSize:size,color,bold,margin:0,fit:"shrink",valign:"top",breakLine:false});
  slide.addShape(pptx.ShapeType.rect,{x:.72,y:.65,w:.48,h:.05,line:{transparency:100},fill:{color:palette.accent}});
  text(data.title,.72,cover?1.6:1.05,cover?10.2:11.8,cover?1.65:.9,cover?40:30,ink,true);
  text(a.title,.72,6.94,10.5,.18,9,muted);text(`${index+1} / ${a.slides!.length}`,11.6,6.94,1,.18,9,muted);
  if(!visual){
   const lines=data.body.split(/\n+/).map(t=>t.replace(/^\s*[-•*]\s*/,"").trim()).filter(Boolean);
   text(lines.join("\n\n"),.76,cover?3.7:2.65,cover?10.6:11.6,cover?2.4:3.65,cover?22:23,muted);
   if(cover)slide.addShape(pptx.ShapeType.arc,{x:10.7,y:2,w:1.6,h:1.6,rotate:45,line:{color:palette.accent,width:7,transparency:25}});
   return;
  }
  text(data.body,.76,2.02,11.6,.7,16,muted);
  if(visual.type==="chart"){
   slide.addChart(pptx.ChartType.bar,[{name:visual.unit??"Valeur",labels:visual.items.map(i=>i.label),values:visual.items.map(i=>i.value!)}],{x:.78,y:2.95,w:11.6,h:3.4,barDir:"col",showLegend:false,showTitle:false,showValue:true,chartColors:[palette.accent],catAxisLabelFontFace:"Aptos",catAxisLabelFontSize:12,valAxisLabelFontSize:11});
   return;
  }
  const count=visual.items.length,cols=visual.type==="process"?count:Math.min(count,3),rows=Math.ceil(count/cols),gap=.22,w=(11.8-gap*(cols-1))/cols,h=(3.65-gap*(rows-1))/rows;
  visual.items.forEach((item,i)=>{
   const x=.76+(i%cols)*(w+gap),y=2.9+Math.floor(i/cols)*(h+gap);
   slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.18,line:{transparency:100},fill:{color:palette.card}});
   const prominent=visual.type==="metrics"?(item.display??String(item.value??"")):String(i+1).padStart(2,"0");
   text(prominent,x+.22,y+.22,w-.44,visual.type==="metrics"?.7:.45,visual.type==="metrics"?34:18,palette.accent,true);
   text(item.label,x+.22,y+(visual.type==="metrics"?1:.84),w-.44,.58,cols>3?17:21,ink,true);
   if(item.detail)text(item.detail,x+.22,y+(visual.type==="metrics"?1.64:1.5),w-.44,Math.max(.45,h-1.7),cols>3?12:15,muted);
   if(visual.type==="process"&&i<count-1)slide.addShape(pptx.ShapeType.chevron,{x:x+w+.025,y:y+h/2-.13,w:.17,h:.26,line:{transparency:100},fill:{color:palette.accent}});
  });
 });
}
