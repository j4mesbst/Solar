// QA only: send public search/page GETs through Solar's real Rust transport.
// No Tauri storage, credentials, personal history, cookies or API calls.
const {execFile}=require('node:child_process');
const binary='/Users/James/Documents/Solar/src-tauri/target/debug/examples/public_web_probe';
function nativeWebTransport(records){return async route=>{
 const request=new URL(route.request().url());let url;
 if(request.pathname==='/solar-web-reference')url=request.searchParams.get('url');
 else if(request.pathname.startsWith('/solar-web-bing/'))url='https://www.bing.com'+request.pathname.slice('/solar-web-bing'.length)+request.search;
 else if(request.pathname.startsWith('/solar-web/'))url='https://html.duckduckgo.com'+request.pathname.slice('/solar-web'.length)+request.search;
 else return route.continue();
 const start=Date.now();try{const data=await new Promise((resolve,reject)=>{const child=execFile(binary,[],{maxBuffer:8000000,timeout:10000},(error,stdout)=>{if(error)return reject(Error('Native public GET failed'));try{resolve(JSON.parse(stdout));}catch{reject(Error('Invalid native response'));}});child.stdin.end(JSON.stringify(url));});records.push({url,status:data.status,bytes:data.body.length,ms:Date.now()-start});await route.fulfill({status:data.status,contentType:data.headers['content-type']??'text/html',body:data.body});}
 catch(error){records.push({url,error:error.message,ms:Date.now()-start});await route.fulfill({status:502,body:'Source inaccessible.'}).catch(()=>{});}
};}
module.exports={nativeWebTransport};
