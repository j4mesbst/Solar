import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
const realFetch=fetch.bind(globalThis),values=new Map(),methods=[];
globalThis.window={dispatchEvent:()=>{}};globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
globalThis.sessionStorage=globalThis.localStorage;
let invoked=0;
const http=createServer(async(req,res)=>{
 try{
  let body='';for await(const chunk of req)body+=chunk;
  const parsed=body?JSON.parse(body):undefined;if(parsed?.method)methods.push(parsed.method);
  const server=new McpServer({name:'Solar MCP test server',version:'1.0.0'});
  server.registerTool('echo',{description:'Returns text without external effects',inputSchema:{text:z.string().min(1)}},async({text})=>{invoked++;return {content:[{type:'text',text:'server:'+text}]};});
  server.registerTool('slow',{inputSchema:{}},async()=>{await new Promise(resolve=>setTimeout(resolve,350));return {content:[{type:'text',text:'done'}]};});
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:false});await server.connect(transport);res.on('close',()=>{void server.close();});await transport.handleRequest(req,res,parsed);
 }catch{if(!res.headersSent)res.writeHead(500);res.end();}
});
await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const dir=await mkdtemp(path.join(tmpdir(),'solar-mcp-test-'));
try{
 globalThis.fetch=async(input,init)=>{const req=new Request(input,init);const target=new URL(req.url);assert.equal(target.hostname,'solar-mcp-fixture.invalid');const url=`http://127.0.0.1:${http.address().port}${target.pathname}`;return realFetch(url,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:await req.text(),signal:req.signal,redirect:'error'});};
 const bundle=await build({stdin:{contents:'export * from "./src/services/mcpConnections.ts";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',write:false});
 // Keep package resolution attached to project while using a disposable bundle.
 const file=path.resolve('node_modules/.solar-mcp-phase-two-test.mjs');await writeFile(file,bundle.outputFiles[0].text);
 try{
  const mcp=await import(pathToFileURL(file));const server={id:'fixture',name:'Fixture',url:'https://solar-mcp-fixture.invalid/mcp',auth:'none',local:false,enabled:true};
  const session=await mcp.connectMcp(server,new AbortController().signal);assert.equal(session.tools.length,2);assert(methods.includes('initialize'));assert(methods.includes('tools/list'));
  const response=await mcp.callMcp(server,'echo',{text:'hello'},new AbortController().signal);assert.equal(response.content[0].text,'server:hello');assert.equal(invoked,1);assert.equal((await mcp.listMcpServers())[0].identity,'Solar MCP test server');
  const controller=new AbortController();const pending=mcp.callMcp(server,'slow',{},controller.signal);setTimeout(()=>controller.abort(),40);await assert.rejects(pending,/abort/i);
  await assert.rejects(mcp.connectMcp({...server,url:'https://changed.invalid/mcp'},new AbortController().signal),/configuration a changé/);
  await mcp.disconnectMcp(server.id);assert.equal((await mcp.listMcpServers())[0].enabled,false);
 }finally{await rm(file,{force:true});}
 console.log('MCP phase 2: vrai serveur SDK local, initialize, tools/list, POST/SSE, tools/call, annulation, identité et déconnexion — PASS (aucun service tiers).');
}finally{globalThis.fetch=realFetch;await rm(dir,{recursive:true,force:true});http.closeAllConnections();await new Promise(resolve=>http.close(resolve));}
