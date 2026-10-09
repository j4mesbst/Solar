import { useEffect, useRef, useState } from "react";
import type { Model, Provider } from "../domain/types";
import { prepareOllama } from "../services/ollama";
export function useModelPreparation(provider: Provider | undefined, model: Model | undefined, generating: boolean) {
  const [state,setState]=useState<"" | "Chargement…" | "Prêt" | "Indisponible">("");
  const controller=useRef<AbortController | null>(null); const running=useRef<Promise<unknown>>(Promise.resolve()); const revision=useRef(0);
  const readyModel=useRef<string>();
  const cancel=()=>{revision.current++;controller.current?.abort();controller.current=null;};
  useEffect(()=>{
    cancel(); if(!provider?.enabled || provider.protocol!=="ollama" || !model || !model.enabled || model.available===false){setState("");return;} if(generating){setState(readyModel.current===model.id?"Prêt":"");return;} setState("Chargement…");
    const version=revision.current; const timer=setTimeout(()=>{
      const previous=running.current;
      running.current=(async()=>{await previous.catch(()=>{});if(version!==revision.current)return; const request=new AbortController();controller.current=request; const timeout=setTimeout(()=>request.abort(),45000);setState("Chargement…");
      try{const result=await prepareOllama(provider,model,request.signal);if(version===revision.current){readyModel.current=result==="ready"?model.id:undefined;setState(result==="ready"?"Prêt":"");}}catch{if(version===revision.current){readyModel.current=undefined;setState("Indisponible");}}finally{clearTimeout(timeout);if(controller.current===request)controller.current=null;}})();
    },600);
    return()=>{clearTimeout(timer);cancel();};
  },[provider?.id,provider?.enabled,provider?.baseUrl,model?.id,model?.enabled,model?.available,generating]);
  return {state,cancel};
}
