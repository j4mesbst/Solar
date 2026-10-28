import { invoke } from "@tauri-apps/api/core";
export function validateServerUrl(value:string,local=false){
 const url=new URL(value);
 if(url.username||url.password||url.hash||[...url.searchParams.keys()].some(key=>/token|secret|password|api[-_]?key|authorization/i.test(key)))throw Error("L’URL ne doit contenir ni identifiants ni fragment.");
 const host=url.hostname.replace(/^\[|\]$/g,"");
 const loopback=host==="localhost"||host==="::1"||/^127\./.test(host);
 if(local&&!loopback)throw Error("Le mode local est réservé aux adresses loopback.");
 if(!local&&(url.protocol!=="https:"||loopback||/^\d+\.\d+\.\d+\.\d+$/.test(host)&&/^(10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)))throw Error("HTTPS et une destination publique sont requis.");
 if(!["https:","http:"].includes(url.protocol))throw Error("Protocole réseau non autorisé.");return url;
}
export function secureIntegrationFetch(local=false,localOrigin?:string){
 return async (input:string|URL|Request,init?:RequestInit):Promise<Response>=>{
  const request=new Request(input,init);const allowLocal=local && (!localOrigin || new URL(request.url).origin===localOrigin);validateServerUrl(request.url,allowLocal);
  const native=typeof window!=="undefined"&&Boolean((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
  if(!native){if(local)throw Error("Les serveurs locaux sont disponibles uniquement dans Solar macOS.");return fetch(request,{redirect:"error"});}
  // Unsolicited server push is optional in MCP. Solar uses bounded POST/SSE
  // replies only and never exposes sampling, roots or a background GET stream.
  if(request.method==="GET"&&request.headers.get("accept")?.includes("text/event-stream"))return new Response(null,{status:405});
  const id=crypto.randomUUID(),signal=request.signal;
  signal.throwIfAborted();const abort=()=>{void invoke("integration_cancel",{id});};signal.addEventListener("abort",abort,{once:true});
  try{
   const body=["GET","HEAD"].includes(request.method)?undefined:await request.text();
   const result=await invoke<{status:number;headers:Record<string,string>;body:string}>("integration_request",{id,url:request.url,method:request.method,headers:Object.fromEntries(request.headers),body,local:allowLocal});signal.throwIfAborted();
   return new Response([204,205,304].includes(result.status)?null:result.body,{status:result.status,headers:result.headers});
  }finally{signal.removeEventListener("abort",abort);}
 };
}
