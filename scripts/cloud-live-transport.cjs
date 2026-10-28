// Opt-in live test transport. Credentials stay in this Node process, never in
// browser storage, source files, logs or test artifacts. No personal chat copied.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
function cloudLiveTransport(){
 const root=path.join(os.homedir(),'Library/Application Support/fr.j4mesbst.solar');
 const files=fs.readdirSync(root).filter(n=>/^solar\.v3\.account\..*\.json$/.test(n)).concat('solar.v3.json');
 let selected,key;
 for(const file of files){const raw=JSON.parse(fs.readFileSync(path.join(root,file),'utf8')),d=raw.data??raw;const providers=(d.providers??[]).filter(p=>p.enabled&&p.protocol==='openai-compatible'&&new URL(p.baseUrl).hostname==='api.gonkarouter.io');const models=(d.models??[]).filter(m=>m.enabled&&m.available!==false&&providers.some(p=>p.id===m.providerId));const model=models.find(m=>/DeepSeek-V4-Flash/i.test(m.providerModelId??m.name))??models[0];if(model){const provider=providers.find(p=>p.id===model.providerId);try{key=execFileSync('/usr/bin/security',['find-generic-password','-s','solar','-a',provider.secretRef,'-w'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{continue;}if(key){selected={model,provider};break;}}}
 if(!selected)throw Error('No configured Solar Cloud model found.');
 const {provider,model}=selected;
 if(!key)throw Error('Empty Solar Cloud credential.');
 const metadata={model:model.providerModelId??model.name,baseUrl:provider.baseUrl,contextWindow:model.contextWindow,maxOutputTokens:model.maxOutputTokens};
 return {metadata,async handle(route,calls,errors){const started=Date.now();try{
   const body=route.request().postDataJSON();body.model=metadata.model;
   const response=await fetch(metadata.baseUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body),signal:AbortSignal.timeout(150000)});
   if(!response.ok){calls.push({status:response.status,ms:Date.now()-started,model:metadata.model});throw Error('Solar Cloud HTTP '+response.status);}
   const reader=response.body.getReader(),decoder=new TextDecoder();let raw='',firstTokenMs;
   while(true){const {done,value}=await reader.read();if(done)break;raw+=decoder.decode(value,{stream:true});if(firstTokenMs===undefined&&/"(?:content|tool_calls)"/.test(raw))firstTokenMs=Date.now()-started;}
   raw+=decoder.decode();let usage={},finishReason;for(const line of raw.split('\n')){if(!line.startsWith('data: ')||line==='data: [DONE]')continue;try{const event=JSON.parse(line.slice(6));if(event.usage)usage=event.usage;for(const choice of event.choices??[])if(choice.finish_reason)finishReason=choice.finish_reason;}catch{}}
   calls.push({ms:Date.now()-started,firstTokenMs,model:metadata.model,input:usage.prompt_tokens,output:usage.completion_tokens,finishReason,maxTokens:body.max_tokens,reasoningEffort:body.reasoning_effort});
   await route.fulfill({contentType:'text/event-stream',body:raw});
 }catch(e){errors.push(e.message);await route.fulfill({status:503,body:'Solar Cloud live test unavailable'}).catch(()=>{});}}};
}
module.exports={cloudLiveTransport};
