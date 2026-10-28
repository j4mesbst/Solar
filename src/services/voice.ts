import {invoke,Channel} from '@tauri-apps/api/core';
export const nativeVoice=()=>Boolean((window as Window&{__TAURI_INTERNALS__?:unknown}).__TAURI_INTERNALS__);
export interface VoiceStatus{supported:boolean;ready:boolean;recording:boolean;busy:boolean;level:number}
let owner='';let cleanup:Promise<unknown>=Promise.resolve();
export async function claimVoice(id:string){if(owner!==id){window.dispatchEvent(new CustomEvent('solar-voice-replaced',{detail:id}));if(owner)cleanup=cleanup.then(()=>invoke('voice_cancel')).catch(()=>{});owner=id;}await cleanup;}
export const ownsVoice=(id:string)=>owner===id;
export function releaseVoice(id:string){if(owner!==id)return;owner='';cleanup=cleanup.then(()=>invoke('voice_cancel')).catch(()=>{});}
export const voiceStatus=()=>invoke<VoiceStatus>('voice_status');
export const startVoice=()=>invoke('voice_record_start');
export const stopVoice=()=>invoke<string>('voice_record_stop');
export const stopSpeech=()=>invoke('voice_speech_stop');
export const speak=(text:string)=>invoke('voice_speak',{text:text.replace(/```[\s\S]*?```/g,' Bloc de code. ').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_#`]/g,'').slice(0,12000)});
export async function downloadVoice(onProgress:(percent:number)=>void){const onEvent=new Channel<{completed:number;total:number}>();onEvent.onmessage=p=>onProgress(Math.min(100,Math.round(p.completed/p.total*100)));await invoke('voice_model_download',{onEvent});}
