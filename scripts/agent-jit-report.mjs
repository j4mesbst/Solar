import {answerVerified} from './agent-jit-oracle.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const base='output/agent-jit';
const original=JSON.parse(await readFile(`${base}/paired-results.json`,'utf8'));
const final=JSON.parse(await readFile(`${base}/final/paired-results.json`,'utf8'));
const paired=JSON.parse(await readFile(`${base}/local-paired-current/paired-results.json`,'utf8'));
if(paired.rows.length!==12||final.rows.length!==12||original.rows.length!==24)throw Error('Campagne comparative incomplète.');
const median=v=>{v.sort((a,b)=>a-b);return(v[Math.floor((v.length-1)/2)]+v[Math.floor(v.length/2)])/2;};
for(const run of [original,final,paired])for(const row of run.rows){row.previousVerified=row.verified;row.verified=row.verified&&answerVerified(row.task,row);}
const groups=[];
for(const model of ['ornith-1.5:9b','zai-org/GLM-5.3-Flash'])for(const variant of ['before','after']){
 const rows=(model.startsWith('ornith')?paired.rows:variant==='before'?original.rows:final.rows).filter(r=>r.model===model&&r.variant===variant);
 groups.push({model,variant,n:rows.length,verified:rows.filter(r=>r.verified).length,medianLatencyMs:median(rows.map(r=>r.latencyMs)),inputTokens:rows.reduce((n,r)=>n+r.inputTokens,0),outputTokens:rows.reduce((n,r)=>n+r.outputTokens,0),modelCalls:rows.reduce((n,r)=>n+r.modelCalls,0),usageIncomplete:rows.some(r=>Boolean(r.error)||r.missingMetricCalls>0),byTask:['mail-three','github-two'].map(task=>{const selected=rows.filter(r=>r.task===task);return{task,verified:selected.filter(r=>r.verified).length,n:selected.length,medianLatencyMs:median(selected.map(r=>r.latencyMs)),modelCalls:selected.map(r=>r.modelCalls),inputTokens:selected.reduce((n,r)=>n+r.inputTokens,0),outputTokens:selected.reduce((n,r)=>n+r.outputTokens,0)};})});
}
const regressions=[];for(const model of ['ornith-1.5:9b','zai-org/GLM-5.3-Flash']){const b=(model.startsWith('ornith')?paired.rows:original.rows).filter(r=>r.variant==='before'&&r.model===model),a=(model.startsWith('ornith')?paired.rows:final.rows).filter(r=>r.variant==='after'&&r.model===model);for(const prior of b){const next=a.find(r=>r.task===prior.task&&r.rep===prior.rep);if(prior.verified&&!next?.verified)regressions.push({model,task:prior.task,rep:prior.rep});}}
const data={oracle:'agent-jit-oracle.mjs: all three mail points + exact source date/contribution count; uniform retrospective text recheck',oracleChanges:[original,final,paired].flatMap((run,campaign)=>run.rows.filter(r=>r.previousVerified!==r.verified).map(r=>({campaign,variant:r.variant,model:r.model,task:r.task,rep:r.rep,previous:r.previousVerified,verified:r.verified}))),generatedAt:new Date().toISOString(),groups,regressions,baselineBundle:original.bundles.before,finalBundle:final.bundles.after,pairedLocalBundle:paired.bundles.after,hashesAgree:final.bundles.after===paired.bundles.after,notes:['Cloud before/after from separate campaigns; local paired alternation.','Historical cloud timeout token totals are lower bounds; no exact billing claim.','Fixtures only for connectors, real providers for LLMs.','No fixed random seed; small sample, not a general capability score.']};
await writeFile(`${base}/comparison.json`,JSON.stringify(data,null,2)+'\n');
const header='| Modèle | Version | Réussites | Latence médiane | Tokens entrée / sortie | Appels LLM |\n|---|---|---:|---:|---:|---:|\n';
const table=header+groups.map(r=>`| ${r.model} | ${r.variant==='before'?'Avant (0.7)':'Après'} | ${r.verified}/${r.n} | ${(r.medianLatencyMs/1000).toFixed(2)} s | ${r.usageIncomplete?'≥ ':''}${r.inputTokens} / ${r.outputTokens} | ${r.modelCalls} |`).join('\n')+'\n';
await writeFile(`${base}/comparison.md`,table);console.log(JSON.stringify(data));
