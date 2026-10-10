let accountId = "";
// Fixed for one app lifetime. Account changes reload before any new store is mounted.
export function initializeAccountScope(id?:string){accountId=id && /^[a-zA-Z0-9-]{1,80}$/.test(id)?id:"";}
export function scopedKey(key:string){return accountId?`${key}.account.${accountId}`:key;}
export function hasAccountScope(){return Boolean(accountId);}
