/** A mission-local identity handshake cache, never an authorization cache.
 * Connection/account/credential fingerprints are checked by the caller on every
 * access, including after approval. API operations still validate credentials.
 * Share only identical in-flight signals; failed lookups are never retained. */
export function missionIdentityCache(ttlMs=2000){
 const entries=new Map<string,{fingerprint:string;signal:AbortSignal;expires:number;promise:Promise<string>}>();
 return async(key:string,fingerprint:string,signal:AbortSignal,load:()=>Promise<string>)=>{
  signal.throwIfAborted();const old=entries.get(key);
  if(old&&old.fingerprint===fingerprint&&old.signal===signal&&old.expires>Date.now())return old.promise;
  const entry={fingerprint,signal,expires:Date.now()+ttlMs,promise:Promise.resolve('')};
  entry.promise=Promise.resolve().then(()=>{signal.throwIfAborted();return load();}).then(identity=>{signal.throwIfAborted();entry.expires=Date.now()+ttlMs;return identity;}).catch(error=>{if(entries.get(key)===entry)entries.delete(key);throw error;});
  entries.set(key,entry);if(entries.size>64)for(const[k,v]of entries)if(v.expires<=Date.now())entries.delete(k);
  return entry.promise;
 };
}
