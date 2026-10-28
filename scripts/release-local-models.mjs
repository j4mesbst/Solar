import { streamChat } from '../src/services/chatApi.ts';
import { mkdir,writeFile } from 'node:fs/promises';
const models=['ornith-1.5:9b','hf.co/ornith-ai/Ornith-1.0-9B-GGUF:Q4_K_M','batiai/qwen3.5-9b:q4'];
const provider={id:'release-local',name:'Ollama local',protocol:'ollama',baseUrl:'http://127.0.0.1:11434',secretRef:'',enabled:true};
const vault={get:async()=>{throw Error('Local models must never read a secret');}};
const results=[];
for(const model of models){
 let text='',metrics;const start=Date.now();const entry={model};
 const common={provider,model,vault,effort:'low',signal:AbortSignal.timeout(90000),maxOutputTokens:128,localOptions:{numCtx:4096,temperature:0,keepAlive:'2m'},exactSystem:true,systemInstruction:'Réponds brièvement et respecte exactement le format demandé.',messages:[{id:'release-input',conversationId:'release',role:'user',content:'Réponds exactement : SOLAR_OK',status:'completed',createdAt:new Date().toISOString(),order:0}],onDelta:delta=>{text+=delta;},onMetrics:value=>{metrics=value;}};
 try{const answer=await streamChat(common);entry.chat={pass:text.includes('SOLAR_OK'),stopReason:answer.stopReason,tokens:metrics?.tokens};}catch(error){entry.chat={pass:false,error:error.message};}
 text='';
 try{const response=await streamChat({...common,signal:AbortSignal.timeout(90000),format:{type:'object',properties:{answer:{type:'string',const:'SOLAR_OK'}},required:['answer'],additionalProperties:false},messages:[{...common.messages[0],content:'Retourne un objet JSON avec answer = SOLAR_OK.'}]});entry.structured={pass:JSON.parse(text).answer==='SOLAR_OK',stopReason:response.stopReason};}catch(error){entry.structured={pass:false,error:error.message};}
 text='';
 try{const response=await streamChat({...common,signal:AbortSignal.timeout(90000),tools:[{type:'function',function:{name:'solar_release_echo',description:'Retourne le texte de recette. Appelle cette fonction pour vérifier la connexion.',parameters:{type:'object',properties:{text:{type:'string',const:'SOLAR_OK'}},required:['text'],additionalProperties:false}}}],messages:[{...common.messages[0],content:'Appelle obligatoirement solar_release_echo avec text SOLAR_OK ; aucun texte libre.'}]});entry.tools={pass:response.toolCalls.length===1&&response.toolCalls[0].name==='solar_release_echo'&&response.toolCalls[0].arguments.text==='SOLAR_OK',stopReason:response.stopReason,calls:response.toolCalls.length};}catch(error){entry.tools={pass:false,error:error.message};}
 entry.ms=Date.now()-start;results.push(entry);console.log(JSON.stringify(entry));await mkdir('output/phase3',{recursive:true});await writeFile('output/phase3/local-models.json',JSON.stringify(results,null,2)+'\n');
}
if(results.some(item=>!item.chat.pass||!item.structured.pass))process.exitCode=1;
