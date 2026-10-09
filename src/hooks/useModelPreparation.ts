import { useEffect, useRef, useState } from "react";
import type { Model, Provider } from "../domain/types";
import { prepareOllama } from "../services/ollama";
export function useModelPreparation(provider: Provider | undefined, model: Model | undefined, generating: boolean) {
  const [state,setState]=useState<"" | "Chargement…" | "Prêt" | "Indisponible">("");
  const controller=useRef<AbortController | null>(null); const running=useRef<Promise<unknown>>(Promise.resolve()); const revision=useRef(0);
  const cancel=()=>{revision.current++;controller.current?.abort();controller.current=null;};
  useEffect(()=>{
    cancel();setState(""); if(!provider || provider.protocol!=="ollama" || !model || model.available===false || generating)return;
    const version=revision.current; const timer=setTimeout(()=>{
      const previous=running.current;
      running.current=(async()=>{await previous.catch(()=>{});if(version!==revision.current)return; const request=new AbortController();controller.current=request; const timeout=setTimeout(()=>request.abort(),45000);setState("Chargement…");
      try{const result=await prepareOllama(provider,model,request.signal);if(version===revision.current)setState(result==="ready"?"Prêt":"");}catch{if(version===revision.current)setState("Indisponible");}finally{clearTimeout(timeout);if(controller.current===request)controller.current=null;}})();
    },600);
    return()=>{clearTimeout(timer);cancel();};
  },[provider?.id,provider?.baseUrl,model?.id,model?.available,generating]);
  return {state,cancel};
}
