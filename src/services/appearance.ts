import { wallpaperFor } from "./wallpaper.ts";
import type { AppSettings, Palette } from "../domain/types";
export const palettes: Record<"light"|"dark",Palette> = {
  light:{accent:"#18181b",background:"#ffffff",surface:"#ffffff",text:"#202024",sidebar:"#ffffff",userBubble:"#f2f2f4",border:"#e1e1e7",selection:"#3478f6"},
  dark:{accent:"#eeeeef",background:"#101011",surface:"#1d1d1f",text:"#ececed",sidebar:"#101011",userBubble:"#242427",border:"#303033",selection:"#3478f6"}
};
export const validColor=(value:string)=>/^#[0-9a-f]{6}$/i.test(value);
export function contrastText(hex:string): string { const rgb=hex.slice(1).match(/../g)!.map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?"#141416":"#ffffff"; }
export function paletteFor(settings:AppSettings,theme:"light"|"dark"):Palette { const base={...palettes[theme]}; for(const [key,value] of Object.entries(settings.appearance?.[theme]??{}))if(typeof value==="string" && validColor(value))base[key as keyof Palette]=value;return base; }
export function appearanceStyle(settings:AppSettings,theme:"light"|"dark") {
 const p=paletteFor(settings,theme);const onBackground=contrastText(p.background);const radius=Math.min(36,Math.max(12,settings.appearance?.radius??26));
 const glass=(value:number|undefined)=>Math.max(0,Math.min(100,Number.isFinite(value)?value!:0));
 const rail=glass(settings.appearance?.glassRail),chat=glass(settings.appearance?.glassChat);const wallpaper=wallpaperFor(settings.appearance,theme);
 const alpha=(color:string,amount:number)=>`${color}${Math.round((1-amount/100*.6)*255).toString(16).padStart(2,"0")}`;
 return {"--wallpaper":wallpaper?`url("${wallpaper}")`:"none","--rail-bg":alpha(settings.appearance?.[theme]?.sidebar??(theme==="dark"?"#202023":"#ededf0"),rail),"--chat-bg":alpha(p.background,chat*.75),"--rail-blur":`${rail*.3}px`,"--chat-blur":`${chat*.3}px`,"--bg":p.background,"--side":p.sidebar,"--surface":p.surface,"--text":p.text,"--accent":p.accent,"--accent-soft":`${p.accent}18`,"--button":p.accent,"--button-text":contrastText(p.accent),"--muted":onBackground==="#ffffff"?"#b4b4bc":"#62626b","--subtle":onBackground==="#ffffff"?"#9696a0":"#74747d","--line":p.border,"--selection-color":p.selection,"--selection-soft":`${p.selection}18`,"--hover":onBackground==="#ffffff"?"#ffffff0f":"#00000006","--user-bubble":p.userBubble,"--user-text":contrastText(p.userBubble),"--caret":contrastText(p.surface),"--radius":`${radius}px`,fontFamily:settings.appearance?.font==="rounded"?'"SF Pro Rounded", ui-rounded, system-ui, sans-serif':settings.appearance?.font==="serif"?'"New York", Georgia, serif':undefined};
}
