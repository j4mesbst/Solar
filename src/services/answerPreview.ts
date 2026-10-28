/** Reversible user-facing text only. Tool plans/JSON stay buffered. The caller
 * must support replacement before previews can be shown, so repairs never
 * append a corrected answer to an invalid one. Validation remains authoritative. */
export function answerPreview(delta:((text:string)=>void)|undefined,replace:((text:string)=>void)|undefined){
 let text='',shown=false,blocked=false;
 return {
  begin(){if(shown)replace?.('');text='';shown=false;blocked=false;},
  append(chunk:string){
   if(!replace||blocked)return;
   text+=chunk;
   if(!shown){const trimmed=text.trimStart();if(!trimmed)return;
    if(/^[{[<`]/.test(trimmed)){blocked=true;return;}
    shown=true;delta?.(text);
   }else delta?.(chunk);
  },
  discard(){if(shown)replace?.('');text='';shown=false;blocked=false;},
  finish(answer:string){if(shown)replace?.(answer);else delta?.(answer);text='';shown=false;blocked=false;},
 };
}
