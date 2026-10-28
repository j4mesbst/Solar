import type { AgentFileChange } from '../agent/types.ts';
import type { CortexVerification } from './types.ts';
import { sourceHash } from './semantic.ts';

export interface MissingDomTarget { selector:string; file?:string; expected?:Record<string,unknown> }

/** Adapt measured diagnostics, never infer obligations from the screenshot.
 * A comma remains a CSS selector list (OR), not several mandatory elements. */
export function missingDomTargets(checks:CortexVerification[]):MissingDomTarget[]{
  return checks.filter(check=>check.status==='failed'&&check.hardConstraint!==false).flatMap(check=>{
    const list=check.output.match(/DOM requis\s*:\s*([^\n]+)/i)?.[1]?.trim().replace(/\.$/,'');
    if(list)return [{selector:list,file:check.file}];
    const assertion=check.output.match(/attendu\s*(\{.*\}),\s*observé\s*(.*)/i);
    if(assertion){
      try{
        const expected=JSON.parse(assertion[1]) as Record<string,unknown>;
        const observed=JSON.parse(assertion[2].replace(/\.$/,''));
        if(typeof expected.selector==='string'&&(observed===null||observed?.found===false)&&(expected.visible!==false||expected.attribute!==undefined||expected.text!==undefined||expected.value!==undefined))
          return [{selector:expected.selector,file:check.file,expected}];
        return [];
      }catch{/* Unknown diagnostic: leave its original check blocking. */}
    }
    const absent=check.output.match(/^(.+?): attendu [^\n]*observé null/m);
    return absent?[{selector:absent[1],file:check.file}]:[];
  });
}

/** The body/JSX at the live hash, rather than the leading CSS of an HTML file.
 * Explicit omissions retain line numbers so a guarded read/edit stays possible. */
export function domSourceExcerpt(path:string,source:string,maximum=2200){
  const lines=source.split('\n');
  const focus=/\.html?$/i.test(path)?lines.findIndex(line=>/<body\b/i.test(line)):lines.findIndex(line=>/\breturn\b|=>\s*\(?\s*</.test(line));
  const start=Math.max(0,focus<0?0:focus-1);
  let excerpt='';let end=start;
  for(;end<lines.length;end++){
    const line=`${end+1}: ${lines[end]}\n`;
    if(excerpt.length+line.length>maximum)break;
    excerpt+=line;
  }
  // A minified line must not disappear. It is explicitly partial, not an
  // invented complete line suitable for replaceRange without a fresh read.
  if(!excerpt)excerpt=`${start+1}: ${lines[start].slice(0,maximum-100)}\n[Extrait seulement : ligne tronquée; lire avant édition.]\n`;
  return `${path} #${sourceHash(source)} (${lines.length} lignes)\n${start?'[Début omis; lignes originales conservées.]\n':''}${excerpt}${end<lines.length?'[Extrait seulement : suite omise; readFileRange pour la zone utile.]':''}`;
}

export function domRepairFiles(targets:MissingDomTarget[],changes:AgentFileChange[],projectFiles:string[]){
  const explicit=targets.flatMap(target=>target.file?[target.file]:[]);
  return [...new Set(explicit.length?explicit:[...changes.map(change=>change.path),...projectFiles].filter(path=>/\.(?:html?|[cm]?[jt]sx?|vue|svelte)$/i.test(path)))];
}
