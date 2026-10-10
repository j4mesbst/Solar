export interface SolarSky {
 begin():void; stop():void; reset(show?:boolean):void; setTheme(theme:"light"|"dark"):void; dispose():void;
}
export function mountSolarSky(scene:HTMLElement,canvas:HTMLCanvasElement,veil:HTMLElement,onFlip:()=>void,onReply:()=>void):SolarSky;
