import assert from 'node:assert/strict';
import {streamChat} from '../src/services/chatApi.ts';
const request={model:'fixture',messages:[{id:'u',conversationId:'c',role:'user',content:'Lis la source fictive',status:'completed',createdAt:new Date().toISOString(),order:0}],effort:'high',vault:{get:async()=> 'TEST_ONLY'},signal:new AbortController().signal,onDelta:()=>{},tools:[{type:'function',function:{name:'solar_read',parameters:{type:'object',properties:{id:{type:'string'}},required:['id']}}}],toolContext:[{tool:'solar_read',arguments:{id:'M1'},result:'{"id":"M1","body":"Fixture"}'}],localOptions:{numCtx:262144,think:true}};
let body;
for(const protocol of ['openai-compatible','anthropic','ollama']){
 globalThis.fetch=async(_url,init)=>{body=JSON.parse(init.body);let content;
  if(protocol==='ollama')content=[{message:{content:'',tool_calls:[{function:{name:'solar_read',arguments:{id:'M2'}}}]}},{done:true,done_reason:'stop'}].map(x=>JSON.stringify(x)).join('\n')+'\n';
  else if(protocol==='anthropic')content=[{type:'content_block_start',index:0,content_block:{type:'tool_use',id:'wire-id',name:'solar_read',input:{}}},{type:'content_block_delta',index:0,delta:{type:'input_json_delta',partial_json:'{"id":"M2"}'}},{type:'message_stop'}].map(x=>'data: '+JSON.stringify(x)).join('\n\n')+'\n\n';
  else content='data: '+JSON.stringify({choices:[{delta:{tool_calls:[{index:0,id:'wire-id',function:{name:'solar_read',arguments:'{"id":"M2"}'}}]}}]})+'\n\ndata: [DONE]\n\n';
  return new Response(content,{headers:{'Content-Type':protocol==='ollama'?'application/x-ndjson':'text/event-stream'}});
 };
 const result=await streamChat({...request,provider:{id:'p',name:'Fixture',protocol,baseUrl:protocol==='ollama'?'http://127.0.0.1:11434':'https://transport.invalid/v1',secretRef:'fixture',enabled:true}});
 assert.deepEqual(result.toolCalls,[{name:'solar_read',arguments:{id:'M2'}}]);
 if(protocol==='anthropic'){assert.equal(body.messages[1].content[0].type,'tool_use');assert.equal(body.messages[2].content[0].type,'tool_result');assert.equal(body.messages[1].content[0].id,body.messages[2].content[0].tool_use_id);assert.deepEqual(body.messages[1].content[0].input,{id:'M1'});}
 else{assert.equal(body.messages[2].role,'assistant');assert.equal(body.messages[3].role,'tool');if(protocol==='ollama'){assert.equal(body.messages[3].tool_name,'solar_read');assert.deepEqual(body.messages[2].tool_calls[0].function.arguments,{id:'M1'});assert.equal(body.think,true);assert.equal(body.options.num_ctx,32768);}else{assert.equal(body.messages[2].tool_calls[0].id,body.messages[3].tool_call_id);assert.equal(body.messages[2].tool_calls[0].function.arguments,'{"id":"M1"}');assert.equal(body.parallel_tool_calls,false);}}
}
console.log('Atlas provider transport: PASS — OpenAI-compatible, Anthropic and Ollama native tool exchanges, matching result IDs/names, JSON arguments, streaming and adaptive local allocation under the declared 262K maximum.');
