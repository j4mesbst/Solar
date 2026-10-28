import {safeResultUrl} from './agentResultCards';
export async function openResult(url:string){
 const safe=safeResultUrl(url);if(!safe)throw Error('Lien indisponible.');
 if((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__){const {invoke}=await import('@tauri-apps/api/core');await invoke('oauth_open',{url:safe});}
 else window.open(safe,'_blank','noopener,noreferrer');
}
