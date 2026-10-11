import type { CSSProperties } from "react";
import type { ArtifactSlide } from "../../domain/extensions";
import { slideLayout } from "../../services/slideDesign";
import { slideParagraphs } from "../../services/artifacts";
export function SlidePreview({slide,index,total}:{slide:ArtifactSlide;index:number;total:number}){
 const layout=slideLayout(slide,index),visual=slide.visual;
 const values=visual?.items.map(i=>i.value??0)??[],max=Math.max(...values.map(Math.abs),1);
 return <div className={`artifact-slide visual-slide slide-${layout}`}><h2>{slide.title}</h2>
 {visual?<><p className="slide-subtitle">{slide.body}</p>{visual.type==="chart"?<div className="slide-chart-visual" role="img" aria-label={`Graphique ${visual.unit??""} : ${visual.items.map(i=>`${i.label} ${i.value}`).join(", ")}`}>
 {visual.items.map((item,i)=><div className="slide-chart-column" key={i}><strong>{item.value}{visual.unit?` ${visual.unit}`:""}</strong><div className={`slide-chart-bar ${item.value!<0?"negative":""}`} style={{height:`${Math.abs(item.value!)/max*75}%`}}/><span>{item.label}</span></div>)}</div>:<div className={`slide-visual-grid visual-${visual.type}`} style={{"--visual-count":visual.items.length} as CSSProperties}>{visual.items.map((item,i)=><div className="slide-visual-card" key={i}><strong className="slide-visual-number">{visual.type==="metrics"?item.display??item.value:String(i+1).padStart(2,"0")}</strong><h3>{item.label}</h3>{item.detail&&<p>{item.detail}</p>}</div>)}</div>}</>:layout==="cover"?<p>{slideParagraphs(slide.body).join("\n")}</p>:<ul>{slideParagraphs(slide.body).map((line,i)=><li key={i}>{line}</li>)}</ul>}
 <small className="slide-footer">{index+1} / {total}</small></div>;
}
