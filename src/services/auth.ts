import { createClient } from "@supabase/supabase-js";
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const native=()=>Boolean((window as Window & {__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
const storage={
 async getItem(name:string){if(native())return (await import("@tauri-apps/api/core")).invoke<string|null>("secret_get",{key:"auth:"+name});return localStorage.getItem(name);},
 async setItem(name:string,value:string){if(native())await (await import("@tauri-apps/api/core")).invoke("secret_set",{key:"auth:"+name,value});else localStorage.setItem(name,value);},
 async removeItem(name:string){if(native())await (await import("@tauri-apps/api/core")).invoke("secret_delete",{key:"auth:"+name});else localStorage.removeItem(name);}
};
export const authClient=url && key ? createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"solar.auth.v1",storage}}):null;
export const authSetupMessage="Les comptes Solar ne sont pas encore activés sur cette installation. Le projet Supabase doit être configuré avec son URL et sa clé publique.";
