import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {createGunzip,createBrotliDecompress,createInflate} from 'node:zlib';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {isIP} from 'node:net';

function publicAddress(ip:string){
 if(isIP(ip)===4){const [a,b,c]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,2,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&([18,19].includes(b)||b===51&&c===100)||a===203&&b===0&&c===113);}
 return isIP(ip)===6&&/^[23]/i.test(ip)&&!/^200[12]:/i.test(ip);
}
/** Dev only: public HTTPS, DNS pinning, no redirects/cookies/credentials, 2 MB cap. */
export async function webReferenceProxy(req:IncomingMessage,res:ServerResponse){
 const controller=new AbortController();res.on('close',()=>controller.abort());
 try{
  if(req.method!=='GET')throw Error('GET required');
  const url=new URL(new URL(req.url??'', 'http://localhost').searchParams.get('url')??'');
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash||/localhost|\.local$|\.internal$/i.test(url.hostname)||isIP(url.hostname))throw Error('Public HTTPS required');
  if([...url.searchParams.keys()].some(k=>/token|secret|password|api[-_]?key|authorization/i.test(k)))throw Error('Credentials forbidden');
  const addresses=await lookup(url.hostname,{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Private destination forbidden');
  await new Promise<void>((resolve,reject)=>{
   const upstream=request(url,{method:'GET',signal:controller.signal,timeout:8000,headers:{'User-Agent':'Solar/0.8.0','Accept-Encoding':'gzip, br, deflate','Accept':'text/html, text/plain, application/xhtml+xml'},lookup:(_host,options,callback)=>{const selected=addresses[0];if(typeof options==='object'&&options.all)callback(null,addresses);else callback(null,selected.address,selected.family);}},response=>{
    const type=String(response.headers['content-type']??'');if((response.statusCode??500)>=300||!/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)){response.destroy();reject(Error('Page unavailable'));return;}
    const encoding=String(response.headers['content-encoding']??'').toLowerCase(),decoder=encoding==='gzip'?createGunzip():encoding==='br'?createBrotliDecompress():encoding==='deflate'?createInflate():undefined;if(encoding&&!decoder&&encoding!=='identity'){response.destroy();reject(Error('Unsupported encoding'));return;}
    const decoded=decoder?response.pipe(decoder):response;
    const chunks:Buffer[]=[];let bytes=0;decoded.on('data',chunk=>{bytes+=chunk.length;if(bytes>2000000){decoded.destroy(Error('Page too large'));response.destroy();return;}chunks.push(chunk);});response.on('error',error=>{if(decoded!==response)decoded.destroy(error);reject(error);});decoded.on('error',reject);decoded.on('end',()=>{res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(Buffer.concat(chunks));resolve();});
   });upstream.on('timeout',()=>upstream.destroy(Error('Timed out')));upstream.on('error',reject);upstream.end();
  });
 }catch{if(!res.headersSent)res.writeHead(502,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Source inaccessible.');}
}
