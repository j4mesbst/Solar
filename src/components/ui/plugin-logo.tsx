import {useState} from "react";
import {Blocks,UserRound,ListChecks,Columns3,BookMarked} from "lucide-react";
import {pluginInfo} from "../../services/pluginCatalog";
export function PluginLogo({id}:{id:string}){
 const info=pluginInfo(id),[failed,setFailed]=useState(false);
 const colorAsset=({"google-drive":"googledrive-color.png","google-calendar":"googlecalendar-color.png","google-contacts":"googlecontacts-color.png","google-docs":"googledocs-color.png","google-sheets":"googlesheets-color.png","ms-todo":"mstodo-color.svg","ms-calendar":"mscalendar-color.svg","ms-contacts":"mscontacts-color.svg"} as Record<string,string>)[id];
 const Mark=({"google-contacts":UserRound,"ms-todo":ListChecks,monday:Columns3,readwise:BookMarked} as Partial<Record<string,typeof Blocks>>)[id];
 return <span className="plugin-logo" data-brand={info?.icon??id}>{Mark&&!colorAsset?<Mark size={26} aria-label={info?.name??id}/>:!failed?<img src={`/plugin-icons/${colorAsset??`${info?.icon??id}.svg`}`} alt={info?.name??id} onError={()=>setFailed(true)}/>:<Blocks size={24} aria-label={info?.name??id}/>}</span>;
}
