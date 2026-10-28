import type { AgentErrorSummary, AgentFileChange, SelectedProjectContext, VerificationResult } from "./types.ts";
import { importMode,nearbyLocalImports,resolveLocalImport } from './module-resolution.ts';

const sourcePattern = /\.(?:[cm]?[jt]sx?)$/i;
const localImport = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g;

/** Catch a common small-model failure before a full project test: exporting a
 * name that has never been declared in the proposed module. This is purposely
 * conservative; only simple local identifiers are checked. */
export function verifyModuleExports(path: string, source: string): VerificationResult[] {
  if (!/\.(?:[cm]?[jt]sx?)$/i.test(path)) return [];
  const declared = new Set([...source.matchAll(/(?:^|[;\n])\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)\b/g)].map(match => match[1]));
  for(const match of source.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=/g))for(const part of match[1].split(",")){
    const local=part.trim().split(/\s*:\s*/).at(-1)?.trim();if(local&&/^[A-Za-z_$][\w$]*$/.test(local))declared.add(local);
  }
  const exported = new Set<string>();
  const topLevel = (value: string) => { const parts: string[] = []; let start = 0, depth = 0, quote = "", escaped = false; for (let index = 0; index < value.length; index++) { const char = value[index]; if (quote) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === quote) quote = ""; continue; } if (char === "'" || char === '"' || char === "`") { quote = char; continue; } if ("([{<".includes(char)) depth++; else if (")]}>".includes(char)) depth--; else if (char === "," && depth === 0) { parts.push(value.slice(start, index)); start = index + 1; } } parts.push(value.slice(start)); return parts; };
  const simpleReference = (value: string) => /^[A-Za-z_$][\w$]*$/.test(value.trim()) ? value.trim() : undefined;
  for (const match of source.matchAll(/(?:module\.exports\s*=\s*\{([^}]*)\}|exports\.([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)(?=\s*(?:;|$))|export\s*\{([^}]*)\}|export\s+default\s+([A-Za-z_$][\w$]*))/g)) {
    if (match[1]) for (const part of topLevel(match[1])) { const segments = part.split(/\s*:\s*/, 2); const value = simpleReference(segments.length === 2 ? segments[1] : segments[0]); if (value) exported.add(value); }
    if (match[3]) exported.add(match[3]);
    if (match[4]) for (const part of topLevel(match[4])) { const value = simpleReference(part.split(/\s+as\s+/i)[0] ?? ""); if (value) exported.add(value); }
    if (match[5]) exported.add(match[5]);
  }
  const missing = [...exported].filter(name => !declared.has(name));
  if (!missing.length) return [{ type: "structure", success: true, file: path, output: "Exports CommonJS/ES associés à des déclarations locales." }];
  return missing.map(name => ({ type: "structure", success: false, file: path, output: `Export invalide : ${name} est exporté mais aucune déclaration locale correspondante n’existe. Définis ${name} puis conserve l’export compatible.` }));
}

export async function verifyStagedChanges(changes: AgentFileChange[], context: SelectedProjectContext, projectFiles: string[], signal: AbortSignal): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const files = new Set([...projectFiles, ...changes.map(change => change.path)]);
  for (const change of changes) {
    signal.throwIfAborted();
    if (change.after.includes("<<<<<<< ") || change.after.includes("=======\n") && change.after.includes(">>>>>>> ")) {
      results.push({ type: "structure", success: false, file: change.path, output: "Marqueurs de conflit présents." });
      continue;
    }
    if (change.path.endsWith(".json")) {
      try { JSON.parse(change.after); results.push({ type: "syntax", success: true, file: change.path, output: "JSON valide." }); }
      catch (error) { results.push({ type: "syntax", success: false, file: change.path, output: error instanceof Error ? error.message : "JSON invalide." }); }
    } else if (sourcePattern.test(change.path)) {
      const parser = await import("@babel/parser");
      try {
        parser.parse(change.after, { sourceType: "unambiguous", plugins: ["typescript", "jsx", "decorators-legacy"], errorRecovery: false });
        results.push({ type: "syntax", success: true, file: change.path, output: "Syntaxe JavaScript/TypeScript analysée." });
      } catch (error) {
        const issue = error as Error & { loc?: { line: number; column:number } };
        const line=issue.loc?.line,column=issue.loc?.column===undefined?undefined:issue.loc.column+1;
        const excerpt=line?change.after.split("\n").slice(Math.max(0,line-2),line+1).map((text,i)=>`${Math.max(1,line-1)+i}: ${text.slice(0,220)}`).join("\n"):"";
        results.push({ type: "syntax", success: false, file: change.path, line, column, output: `${change.path}${line?`:${line}:${column??1}`:""} ${issue.message}\n${excerpt}`.trim() });
      }
      for (const match of change.after.matchAll(localImport)) {
        let packageType:string|undefined;try{packageType=JSON.parse(context.files.find(file=>file.path==='package.json')?.content??'{}').type;}catch{/* An excerpt is not a manifest. */}
        const mode=importMode(change.path,match[0],packageType),resolution=resolveLocalImport(change.path,match[1],files,mode);
        if (resolution.target) continue;
        const nearby=nearbyLocalImports(change.path,match[1],files,mode);
        results.push({ type: "imports", success: false, file: change.path, output: `Import local introuvable : ${match[1]}. Importeur : ${change.path}; mode ${mode}; résolutions tentées : ${resolution.attempted.join(', ')}.${nearby.length?` Fichiers présents mais non résolus : ${nearby.map(item=>`${item.path} (import explicite ${item.specifier})`).join(', ')}. Vérifier également leurs exports.`:''}` });
      }
      if (!results.some(result => result.file === change.path && result.type === "imports" && !result.success)) results.push({ type: "imports", success: true, file: change.path, output: "Imports relatifs présents dans l’index." });
      results.push(...verifyModuleExports(change.path, change.after));
    } else if (/\.html?$/i.test(change.path)) {
      const scripts=[...change.after.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(match=>!/(?:\bsrc\s*=|\btype\s*=\s*["']?(?:application\/(?:json|ld\+json)|importmap))/i.test(match[1]));
      if(scripts.length){const parser=await import("@babel/parser");for(const script of scripts){try{parser.parse(script[2],{sourceType:"unambiguous",plugins:["jsx","typescript"],errorRecovery:false});results.push({type:"syntax",success:true,file:change.path,output:"Script HTML analysé."});}catch(error){const issue=error as Error&{loc?:{line:number;column:number}};const offset=change.after.slice(0,(script.index??0)+script[0].indexOf(script[2])).split("\n").length-1;const line=offset+(issue.loc?.line??1),column=(issue.loc?.column??0)+1;const lines=change.after.split("\n");results.push({type:"syntax",success:false,file:change.path,line,column,output:`${change.path}:${line}:${column} ${issue.message}\n${lines.slice(Math.max(0,line-2),line+1).map((part,i)=>`${Math.max(1,line-1)+i}: ${part.slice(0,220)}`).join("\n")}`});}}}
      results.push({ type: "structure", success: true, file: change.path, output: "Fichier proposé dans les limites du projet." });
    } else results.push({ type: "structure", success: true, file: change.path, output: "Fichier proposé dans les limites du projet." });
  }
  // Inspect only concrete named imports whose target is part of the staged
  // transaction. A path that exists is not proof that its named export exists.
  // Unknown/dynamic exports remain the runtime verifier's responsibility.
  const stagedSources=new Map(changes.map(change=>[change.path,change.after]));
  for(const change of changes.filter(change=>sourcePattern.test(change.path))){
    for(const match of change.after.matchAll(/\bimport\s*\{([^}]+)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g)){
      const target=resolveLocalImport(change.path,match[2],files,importMode(change.path,match[0])).target;
      const targetSource=target&&stagedSources.get(target);
      if(!target||targetSource===undefined)continue;
      const explicitExports=[...targetSource.matchAll(/\bexport\s+(?:(?:default|declare|async)\s+)*(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)\b/g)].map(item=>item[1]);
      for(const group of targetSource.matchAll(/\bexport\s*\{([^}]+)\}/g))for(const item of group[1].split(','))explicitExports.push(item.trim().split(/\s+as\s+/i).at(-1)??'');
      // Re-exports and dynamic module shapes cannot be proven locally.
      if(!explicitExports.length||/\bexport\s*\*/.test(targetSource))continue;
      for(const part of match[1].split(',')){
        const name=part.trim().split(/\s+as\s+/i)[0];
        if(/^[A-Za-z_$][\w$]*$/.test(name)&&!explicitExports.includes(name))results.push({type:'imports',success:false,file:change.path,output:`Contrat de module : ${change.path} importe ${name} depuis ${target}, mais ce module n'exporte pas ce nom.`});
      }
    }
    for(const match of change.after.matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)){
      const target=resolveLocalImport(change.path,match[2],files,importMode(change.path,match[0])).target;
      const targetSource=target&&stagedSources.get(target);
      if(!target||targetSource===undefined)continue;
      for(const part of match[1].split(',')){
        const name=part.trim().split(/\s*:\s*/)[0];
        if(!/^[A-Za-z_$][\w$]*$/.test(name))continue;
        const explicitObject=targetSource.match(/\bmodule\.exports\s*=\s*\{([^}]*)\}/);
        const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        const hasExport=new RegExp(`\\bexports\\.${escaped}\\s*=|\\bexport\\s+(?:(?:async\\s+)?function|class|const|let|var)\\s+${escaped}\\b`).test(targetSource)||Boolean(explicitObject&&new RegExp(`(?:^|,)\\s*${escaped}\\s*(?:[:,]|$)`).test(explicitObject[1]));
        if(explicitObject&&!hasExport)results.push({type:'imports',success:false,file:change.path,output:`Contrat de module : ${change.path} importe ${name} depuis ${target}, mais le module cible ne l'exporte pas dans son objet module.exports.`});
        const reciprocal=new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*require\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)`);
        const back=targetSource.match(reciprocal);
        if(back&&resolveLocalImport(target,back[1],files,importMode(target,back[0])).target===change.path&&explicitObject?.[1].includes(name))results.push({type:'imports',success:false,file:change.path,output:`Import circulaire de ${name} entre ${change.path} et ${target} : les deux modules se réexportent mutuellement avant l'initialisation. Déplace la déclaration réelle dans un seul module et réexporte-la depuis l'autre.`});
      }
    }
  }
  // One verdict per import contract and file. A simultaneous optimistic PASS
  // and concrete FAIL would make evidence identities ambiguous and can trigger
  // an unrelated rollback of an otherwise useful multi-file repair.
  const failedImportFiles=new Set(results.filter(result=>result.type==='imports'&&!result.success).map(result=>result.file));
  for(let index=results.length-1;index>=0;index--)if(results[index].type==='imports'&&results[index].success&&failedImportFiles.has(results[index].file))results.splice(index,1);
  if (!changes.length) results.push({ type: "structure", success: true, output: "Aucun changement de fichier proposé." });
  if (context.estimatedTokens > context.budget) results.push({ type: "structure", success: false, output: "Budget de contexte dépassé." });
  return results;
}

export function summarizeVerification(results: VerificationResult[]): AgentErrorSummary | null {
  const failures = results.filter(result => !result.success);
  if (!failures.length) return null;
  const first = failures[0];
  return { primaryError: first.output.slice(0, 500), file: first.file, line: first.line, relatedErrors: failures.slice(1, 5).map(result => `${result.file ?? "Projet"}: ${result.output.slice(0, 250)}`) };
}

export function repairFeedback(error: AgentErrorSummary, context: SelectedProjectContext, changes: AgentFileChange[] = []) {
  const source = error.file ? changes.find(change => change.path === error.file)?.after ?? context.files.find(file => file.path === error.file)?.content : undefined;
  return `Le changement préparé a échoué à la vérification.\nErreur principale : ${error.primaryError}\nFichier : ${error.file ?? "inconnu"}${error.line ? `:${error.line}` : ""}\nErreurs liées : ${error.relatedErrors.join(" ; ") || "aucune"}\nContexte ciblé :\n${source?.slice(0, 5000) ?? "Consulte le fichier concerné si nécessaire."}\nCorrige uniquement cette cause. Renvoie des actions structurées, de préférence patchFile. Aucune commande shell.`;
}
