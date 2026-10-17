import { parseAgentResponse } from "../agent/actions.ts";
import { safeProjectPath } from "../agent/actions.ts";

/** Recover only complete action objects before a truncated tail. Never guess
 * missing JSON or execute a partially received action. */
export function completedActionPrefix(raw:string):string|undefined {
  const match=/"actions"\s*:\s*\[/.exec(raw);if(!match)return;
  const objects:string[]=[];let start=-1,depth=0,quoted=false,escape=false;
  for(let i=match.index+match[0].length;i<raw.length;i++){
    const c=raw[i];if(quoted){if(escape)escape=false;else if(c==="\\")escape=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;continue;}if(c==="{"&&depth++===0)start=i;
    if(c==="}"&&--depth===0&&start>=0){objects.push(raw.slice(start,i+1));start=-1;}
    if(c==="]"&&depth===0)break;
  }
  if(!objects.length)return;
  const result=`{"actions":[${objects.slice(0,8).join(",")}]}`;
  try{parseAgentResponse(result);return result;}catch{return;}
}

/** Accept only a complete, explicitly identified file from an unexpected
 * response shape. It still passes through normal action/path verification. */
export function recoverFileArtifact(raw:string, projectPaths:string[], options:{standaloneHtml?:boolean}={}):string|undefined {
  let path:string|undefined, content:string|undefined;
  try {
    const parsed=JSON.parse(raw);
    if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed)&&typeof parsed.path==="string"&&typeof parsed.content==="string"){
      path=parsed.path;content=parsed.content;
    }
  } catch { /* A complete fenced source may be recoverable below. */ }
  if(!path||content===undefined){
    const fence=raw.trim().match(/^```(?:html?|jsx?|tsx?|[cm]?[jt]s)(?:[ \t]+([^\n]+))?\n([\s\S]+)\n```$/i);
    if(fence){path=fence[1]?.trim() || (projectPaths.length===1?projectPaths[0]:undefined);content=fence[2];}
    else if(options.standaloneHtml&&projectPaths.length===1&&/\.html?$/i.test(projectPaths[0])){
      const opened=raw.trim().match(/^```html?(?:[ \t]+([^\n]+))?\n([\s\S]+)$/i);
      path=opened?.[1]?.trim()??projectPaths[0];content=opened?.[2]??raw.trim();
    }else return;
  }
  if(!path||!safeProjectPath(path)||!projectPaths.includes(path)||!content?.trim())return;
  if(/\.html?$/i.test(path)&&!/^\s*(?:<!doctype\s+html[^>]*>\s*)?<html\b[\s\S]*<\/html>\s*$/i.test(content))return;
  if(!/\.(?:html?|[cm]?[jt]sx?)$/i.test(path))return;
  const response=JSON.stringify({actions:[{type:"replaceFile",path,content}]});
  try{parseAgentResponse(response);return response;}catch{return;}
}

/** A standalone document may arrive in two streamed pieces. Accept it only
 * once the joined source is a complete, allowed HTML document. */
export function recoverStandaloneHtml(prefix:string, continuation:string, projectPaths:string[]):string|undefined {
  // A continuation is only trustworthy when it completes the exact prefix
  // that Cortex retained. Accepting a newly restarted standalone document
  // here would silently discard the first part and violate the continuation
  // contract.
  if(/<\s*(?:!doctype\s+html|html\b)/i.test(continuation))return;
  if((/<\/head\s*>/i.test(prefix)&&/<\/head\s*>/i.test(continuation))||(/<body\b/i.test(prefix)&&/<body\b/i.test(continuation)))return;
  // A local model can restart from an earlier CSS/JS fragment without
  // repeating <html>. Joining that fragment in the middle of a token creates
  // a superficially complete but corrupted document. Require novel suffix
  // text, not merely a closing </html> tag.
  const leading=continuation.trimStart().slice(0,64);
  if(leading.length>=48&&prefix.includes(leading))return;
  return recoverFileArtifact(prefix+continuation,projectPaths,{standaloneHtml:true});
}
