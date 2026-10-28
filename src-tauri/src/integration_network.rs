use std::collections::HashMap;
use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::time::Duration;

#[derive(Default)]
pub struct IntegrationRequests(Mutex<HashMap<String, Arc<AtomicBool>>>);
fn public_ip(ip: IpAddr) -> bool {
 match ip {
  IpAddr::V4(ip) => {
   let [a,b,c,_]=ip.octets();
   !(ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_broadcast() || ip.is_multicast() || ip.is_unspecified() || a==0 || a>=240 || (a==100&&(64..=127).contains(&b)) || (a==192&&b==0) || (a==192&&b==2) || (a==198&&(b==18||b==19||b==51&&c==100)) || (a==203&&b==0&&c==113))
  },
  IpAddr::V6(ip) => {
   if let Some(v4)=ip.to_ipv4_mapped(){return public_ip(IpAddr::V4(v4));}
   let segments=ip.segments(); (segments[0]&0xe000)==0x2000 && !(segments[0]==0x2001&&(segments[1]<=0x01ff||segments[1]==0x0db8)) && segments[0]!=0x2002
  }
 }
}
pub fn safe_destination(value:&str,local:bool)->Result<(reqwest::Url,Vec<SocketAddr>),String>{
 let url=reqwest::Url::parse(value).map_err(|_|"URL invalide.")?;
 if !url.username().is_empty()||url.password().is_some()||url.fragment().is_some(){return Err("Identifiants ou fragment interdits dans l’URL.".into());}
 let host=url.host_str().ok_or("Hôte absent.")?;
 if url.scheme()!="https" && !(local&&url.scheme()=="http"){return Err("HTTPS est obligatoire hors serveur local autorisé.".into());}
 let host=host.trim_start_matches('[').trim_end_matches(']');
 let port=url.port_or_known_default().ok_or("Port invalide.")?;
 let addresses:Vec<_>=(host,port).to_socket_addrs().map_err(|_|"Résolution du serveur impossible.")?.collect();
 if addresses.is_empty()||addresses.iter().any(|address| if local { !address.ip().is_loopback() } else { !public_ip(address.ip()) }){return Err("Destination réseau interdite. Les serveurs locaux exigent une autorisation distincte et loopback uniquement.".into());}
 Ok((url,addresses))
}
#[derive(serde::Serialize)]
pub struct NetworkResponse {status:u16,headers:HashMap<String,String>,body:String}
#[tauri::command]
pub fn integration_cancel(id:String,state:tauri::State<'_,IntegrationRequests>){if let Ok(map)=state.0.lock(){if let Some(flag)=map.get(&id){flag.store(true,Ordering::SeqCst);}}}
#[tauri::command]
pub async fn integration_request(id:String,url:String,method:String,headers:HashMap<String,String>,body:Option<String>,local:bool,state:tauri::State<'_,IntegrationRequests>)->Result<NetworkResponse,String>{
 perform_request(id,url,method,headers,body,local,&state).await
}
fn allowed_header(host:&str,key:&str,value:&str)->bool{
 matches!(key,"authorization"|"accept"|"content-type"|"mcp-session-id"|"mcp-protocol-version"|"last-event-id"|"notion-version"|"x-github-api-version"|"x-figma-token"|"api-key")
 || key=="prefer"&&host.eq_ignore_ascii_case("graph.microsoft.com")&&value=="outlook.body-content-type=\"text\""
}
pub(crate) async fn perform_request(id:String,url:String,method:String,headers:HashMap<String,String>,body:Option<String>,local:bool,state:&IntegrationRequests)->Result<NetworkResponse,String>{
 if id.len()>100||!matches!(method.as_str(),"GET"|"POST"|"PUT"|"DELETE"|"PATCH"){return Err("Requête réseau invalide.".into());}
 if body.as_ref().map(|s|s.len()>1_000_000).unwrap_or(false){return Err("Requête trop volumineuse.".into());}
 let flag=Arc::new(AtomicBool::new(false));
 {let mut map=state.0.lock().map_err(|_|"Verrou réseau indisponible.")?;if map.contains_key(&id)||map.len()>=16{return Err("Trop de requêtes simultanées.".into());}map.insert(id.clone(),flag.clone());}
 let request=async{
  let (parsed,addresses)=tauri::async_runtime::spawn_blocking(move||safe_destination(&url,local)).await.map_err(|_|"Résolution interrompue.")??;
  let host=parsed.host_str().ok_or("Hôte absent.")?;
  let client=reqwest::Client::builder().user_agent(concat!("Solar/",env!("CARGO_PKG_VERSION"))).no_proxy().redirect(reqwest::redirect::Policy::none()).connect_timeout(Duration::from_secs(10)).timeout(Duration::from_secs(45)).resolve_to_addrs(host,&addresses).build().map_err(|_|"Client réseau indisponible.")?;
  let mut builder=client.request(reqwest::Method::from_bytes(method.as_bytes()).map_err(|_|"Méthode invalide.")?,parsed.clone());
  for (key,value) in headers {
   let lower=key.to_ascii_lowercase();
   if !allowed_header(host,lower.as_str(),&value){return Err("En-tête réseau non autorisé.".into());}
   builder=builder.header(key,value);
  }
  let rpc_id=body.as_ref().and_then(|text|serde_json::from_str::<serde_json::Value>(text).ok()).and_then(|json|json.get("id").cloned());
  if let Some(text)=body{builder=builder.body(text);}
  let mut response=builder.send().await.map_err(|_|"Serveur inaccessible ou délai dépassé.")?;
  let status=response.status().as_u16();
  if response.status().is_redirection(){return Err("Redirection réseau refusée.".into());}
  let headers:HashMap<_,_>=response.headers().iter().filter_map(|(key,value)|value.to_str().ok().map(|value|(key.as_str().to_string(),value.to_string()))).collect();
  if response.content_length().map(|size|size>2_000_000).unwrap_or(false){return Err("Réponse trop volumineuse.".into());}
  let sse=headers.get("content-type").map(|s|s.contains("text/event-stream")).unwrap_or(false);
  let mut bytes=Vec::new();
  while let Some(chunk)=response.chunk().await.map_err(|_|"Réponse interrompue.")?{
   bytes.extend_from_slice(&chunk);if bytes.len()>2_000_000{return Err("Réponse trop volumineuse.".into());}
   if sse&&rpc_id.is_some(){
    let text=String::from_utf8_lossy(&bytes).replace("\r\n","\n");
    if text.split("\n\n").take(text.split("\n\n").count().saturating_sub(1)).any(|event|{
     let data=event.lines().filter_map(|line|line.strip_prefix("data:").map(str::trim_start)).collect::<Vec<_>>().join("\n");
     serde_json::from_str::<serde_json::Value>(&data).ok().map(|json|json.get("id")==rpc_id.as_ref()&&(json.get("result").is_some()||json.get("error").is_some())).unwrap_or(false)
    }){break;}
   }
  }
  Ok(NetworkResponse{status,headers,body:String::from_utf8(bytes).map_err(|_|"Réponse non textuelle.")?})
 };
 let cancelled=async{loop{if flag.load(Ordering::SeqCst){break;}tokio::time::sleep(Duration::from_millis(50)).await;}};
 let result=tokio::select!{value=request=>value,_=cancelled=>Err("Requête annulée.".into())};
 if let Ok(mut map)=state.0.lock(){map.remove(&id);}
 result
}
#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn rejects_internal_and_documentation_addresses(){for ip in ["127.0.0.1","10.0.0.1","169.254.169.254","100.64.0.1","192.0.2.1","::1","::ffff:127.0.0.1","fc00::1","2002:7f00:1::"]{assert!(!public_ip(ip.parse().unwrap()),"{ip}");}assert!(public_ip(IpAddr::V4(std::net::Ipv4Addr::new(8,8,8,8))));}
 #[test]fn local_access_is_explicit_and_only_loopback(){assert!(safe_destination("http://127.0.0.1:8911/mcp",false).is_err());assert!(safe_destination("http://127.0.0.1:8911/mcp",true).is_ok());assert!(safe_destination("http://169.254.169.254/mcp",true).is_err());assert!(safe_destination("https://user:secret@example.com/mcp",false).is_err());}
 fn serve(response:&'static str, linger:bool)->String{
  use std::io::{Read,Write};
  let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();
  std::thread::spawn(move||{let (mut stream,_)=listener.accept().unwrap();let mut bytes=[0;4096];let _=stream.read(&mut bytes);let _=stream.write_all(response.as_bytes());if linger{std::thread::sleep(Duration::from_secs(2));}});
  format!("http://127.0.0.1:{port}/mcp")
 }
 #[tokio::test]async fn bounded_bridge_reads_post_sse_without_waiting_for_close(){
  let state=IntegrationRequests::default();
  let response="HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\nevent: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\n\n";
  let now=std::time::Instant::now();
  let value=perform_request("sse".into(),serve(response,true),"POST".into(),HashMap::new(),Some("{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}".into()),true,&state).await.unwrap();
  assert!(value.body.contains("result"));assert!(now.elapsed()<Duration::from_secs(1));assert!(state.0.lock().unwrap().is_empty());
 }
 #[tokio::test]async fn rejects_redirects_and_oversized_content(){
  let state=IntegrationRequests::default();
  let redirect=serve("HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",false);
  assert!(perform_request("redirect".into(),redirect,"GET".into(),HashMap::new(),None,true,&state).await.err().unwrap().contains("Redirection"));
  let large=serve("HTTP/1.1 200 OK\r\nContent-Length: 2000001\r\nConnection: close\r\n\r\n",false);
  assert!(perform_request("large".into(),large,"GET".into(),HashMap::new(),None,true,&state).await.err().unwrap().contains("volumineuse"));
 }
 #[test]fn outlook_text_preference_is_scoped_to_graph_and_exact_value(){
  assert!(allowed_header("graph.microsoft.com","prefer","outlook.body-content-type=\"text\""));
  assert!(!allowed_header("api.github.com","prefer","outlook.body-content-type=\"text\""));
  assert!(!allowed_header("graph.microsoft.com","prefer","arbitrary"));
  assert!(!allowed_header("graph.microsoft.com","x-untrusted","arbitrary"));
 }
 #[tokio::test]async fn put_and_service_key_headers_reach_loopback_fixture(){
  use std::io::{Read,Write};
  let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();
  let server=std::thread::spawn(move||{
   let(mut stream,_)=listener.accept().unwrap();let mut bytes=[0;4096];let size=stream.read(&mut bytes).unwrap();let request=String::from_utf8_lossy(&bytes[..size]).to_lowercase();
   assert!(request.starts_with("put /fixture "));assert!(request.contains("x-figma-token: fake-fixture"));assert!(request.contains("api-key: fake-fixture"));assert!(request.contains(concat!("user-agent: solar/",env!("CARGO_PKG_VERSION"))));
   stream.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 11\r\nConnection: close\r\n\r\n{\"ok\":true}").unwrap();
  });
  let mut headers=HashMap::new();headers.insert("x-figma-token".into(),"fake-fixture".into());headers.insert("api-key".into(),"fake-fixture".into());
  let result=perform_request("put-fixture".into(),format!("http://127.0.0.1:{port}/fixture"),"PUT".into(),headers,Some("{}".into()),true,&IntegrationRequests::default()).await.unwrap();
  assert_eq!(result.status,200);server.join().unwrap();
 }

 #[tokio::test]async fn compressed_public_text_is_decoded_before_body_limits(){
  use std::io::{Read,Write};
  let body=vec![31,139,8,0,0,0,0,0,2,255,179,81,76,201,79,46,169,44,72,85,200,40,201,205,177,179,129,144,73,249,41,149,118,1,165,73,57,153,201,10,197,249,165,69,201,169,10,41,169,201,249,41,169,41,10,201,249,69,69,169,201,37,57,149,122,54,250,96,101,54,250,96,61,0,123,67,71,118,73,0,0,0];
  let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();let port=listener.local_addr().unwrap().port();
  let server=std::thread::spawn(move||{let(mut stream,_)=listener.accept().unwrap();let mut request=[0;4096];let _=stream.read(&mut request);write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Encoding: gzip\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len()).unwrap();stream.write_all(&body).unwrap();});
  let result=perform_request("gzip-fixture".into(),format!("http://127.0.0.1:{port}/fixture"),"GET".into(),HashMap::new(),None,true,&IntegrationRequests::default()).await.unwrap();
  assert_eq!(result.body,"<!doctype html><html><body>Public source decoded correctly.</body></html>");server.join().unwrap();
 }

}
