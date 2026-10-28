import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
const output=path.resolve('output/phase3');await mkdir(output,{recursive:true});
const suites=['web-repair','agent-followup','solar-plans','continuations','web-search','interface-polish','team-alternative','agent-performance','gts3','gts2','gts','solar-cloud','agent-jit','atlas-tools','context','providers','chat','usage','pipeline','features','evolution','skills','solar-ai','agent','phase1','solar-agent','cortex','phase2','cortex:v3.3','cortex:render','cortex:v5'];
const results=[];
for(const suite of suites){
 const started=Date.now(),name=`test:${suite}`,file=path.join(output,`${suite.replaceAll(':','-')}.log`);let log='';
 const status=await new Promise(resolve=>{const child=spawn('npm',['run',name],{stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>{child.kill('SIGTERM');},180000);child.stdout.on('data',data=>{log+=data;});child.stderr.on('data',data=>{log+=data;});child.on('error',error=>{log+=String(error);});child.on('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});});
 await writeFile(file,log);const result={name,...status,ms:Date.now()-started,log:file};results.push(result);console.log(JSON.stringify(result));
}
await writeFile(path.join(output,'contracts.json'),JSON.stringify(results,null,2)+'\n');if(results.some(result=>result.code!==0))process.exitCode=1;
