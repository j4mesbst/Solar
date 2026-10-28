use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Mutex, Arc, atomic::{AtomicBool, Ordering}};
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct OAuthState(Mutex<HashMap<String, (Option<TcpListener>, Arc<AtomicBool>)>>);

#[tauri::command]
pub async fn oauth_google_token(id:String,body:String,requests:tauri::State<'_,crate::integration_network::IntegrationRequests>)->Result<crate::integration_network::NetworkResponse,String>{
  let client=option_env!("SOLAR_GOOGLE_DESKTOP_CLIENT_ID").ok_or("Client Google de bureau absent de ce build.")?;
  let secret=option_env!("SOLAR_GOOGLE_DESKTOP_CLIENT_SECRET").ok_or("Paramètre du client Google absent. Installe le DMG Solar mis à jour.")?;
  if body.len()>16000{return Err("Requête OAuth invalide.".into());}
  let mut values:HashMap<String,String>=reqwest::Url::parse(&format!("https://oauth2.googleapis.com/token?{body}")).map_err(|_|"Requête OAuth invalide.")?.query_pairs().into_owned().collect();
  if values.get("client_id").map(String::as_str)!=Some(client)||!matches!(values.get("grant_type").map(String::as_str),Some("authorization_code"|"refresh_token")){return Err("Client ou échange Google non autorisé.".into());}
  values.insert("client_secret".into(),secret.into());
  let encoded=reqwest::Url::parse_with_params("https://oauth2.googleapis.com/token",&values).map_err(|_|"Requête OAuth invalide.")?.query().unwrap_or_default().to_owned();
  let mut headers=HashMap::new();headers.insert("content-type".into(),"application/x-www-form-urlencoded".into());headers.insert("accept".into(),"application/json".into());
  crate::integration_network::perform_request(id,"https://oauth2.googleapis.com/token".into(),"POST".into(),headers,Some(encoded),false,&requests).await
}

fn callback_path(request: &str, expected_state: &str) -> Option<String> {
  let first = request.lines().next()?;
  let path = first.strip_prefix("GET ")?.split_once(" HTTP/1.1")?.0;
  if !(path.starts_with("/oauth/callback?") || path.starts_with("/?")) || path.len() > 3000 { return None; }
  let query = path.split_once('?')?.1;
  let received = query.split('&').find_map(|pair| pair.strip_prefix("state="))?;
  if received != expected_state { return None; }
  Some(path.to_string())
}

#[tauri::command]
pub fn oauth_begin(state: String, port: Option<u16>, sessions: tauri::State<'_, OAuthState>) -> Result<u16, String> {
  if state.len() < 32 || state.len() > 128 || !state.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') { return Err("État OAuth invalide.".into()); }
  let listener = TcpListener::bind(("127.0.0.1", port.unwrap_or(0))).map_err(|e| e.to_string())?;
  listener.set_nonblocking(true).map_err(|e| e.to_string())?;
  let port = listener.local_addr().map_err(|e| e.to_string())?.port();
  let mut map = sessions.0.lock().map_err(|_| "Verrou OAuth indisponible.")?;
  if map.contains_key(&state) || !map.is_empty() { return Err("Une autorisation est déjà en cours.".into()); }
  map.insert(state, (Some(listener), Arc::new(AtomicBool::new(false))));
  Ok(port)
}

#[tauri::command]
pub fn oauth_open(url: String) -> Result<(), String> {
  crate::integration_network::safe_destination(&url, false)?;
  #[cfg(target_os = "macos")]
  { std::process::Command::new("open").arg(&url).spawn().map_err(|e| e.to_string())?; Ok(()) }
  #[cfg(not(target_os = "macos"))]
  { let _ = url; Err("Navigateur système non configuré sur cette plateforme.".into()) }
}

#[tauri::command]
pub async fn oauth_wait(state: String, sessions: tauri::State<'_, OAuthState>) -> Result<String, String> {
  let (listener, cancelled) = {
    let mut map=sessions.0.lock().map_err(|_| "Verrou OAuth indisponible.")?;
    let (listener,flag)=map.get_mut(&state).ok_or("Session OAuth absente.")?;
    (listener.take().ok_or("Autorisation déjà en attente.")?,flag.clone())
  };
  let expected_state=state.clone();
  let result = tauri::async_runtime::spawn_blocking(move || wait_callback(listener, &expected_state, &cancelled)).await.map_err(|e| e.to_string())?;
  if let Ok(mut map)=sessions.0.lock(){map.remove(&state);}
  result
}

fn wait_callback(listener:TcpListener, expected_state:&str, cancelled:&AtomicBool)->Result<String,String>{
    let deadline = Instant::now() + Duration::from_secs(600);
    while Instant::now() < deadline {
      if cancelled.load(Ordering::SeqCst){return Err("Autorisation annulée.".into());}
      match listener.accept() {
        Ok((mut stream, address)) => {
          if !address.ip().is_loopback() { continue; }
          stream.set_nonblocking(false).map_err(|e| e.to_string())?;
          stream.set_read_timeout(Some(Duration::from_millis(200))).map_err(|e| e.to_string())?;
          let header_deadline=Instant::now()+Duration::from_secs(3);
          let mut bytes=Vec::new();
          while bytes.len()<4096 && Instant::now()<header_deadline {
            if cancelled.load(Ordering::SeqCst){return Err("Autorisation annulée.".into());}
            let mut chunk=[0u8;512];
            match stream.read(&mut chunk) {
              Ok(0)=>break,
              Ok(size)=>{bytes.extend_from_slice(&chunk[..size]);if bytes.windows(4).any(|value|value==b"\r\n\r\n"){break;}},
              Err(error) if matches!(error.kind(),std::io::ErrorKind::WouldBlock|std::io::ErrorKind::TimedOut)=>continue,
              Err(_)=>break,
            }
          }
          let request=String::from_utf8_lossy(&bytes);
          let path=match callback_path(&request,expected_state){Some(path)=>path,None=>{let body="Invalid state.";let _=write!(stream,"HTTP/1.1 400 Bad Request\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);continue;}};
          let body = "Autorisation reçue. Revenez à Solar.";
          let response = format!("HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}", body.len(), body);
          let _ = stream.write_all(response.as_bytes()); return Ok(path.to_string());
        }
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => std::thread::sleep(Duration::from_millis(80)),
        Err(error) => return Err(error.to_string()),
      }
    }
    Err("Autorisation expirée après dix minutes. Relance la connexion dans Solar.".into())

}

#[tauri::command]
pub fn oauth_cancel(state:String,sessions:tauri::State<'_,OAuthState>){
 if let Ok(mut map)=sessions.0.lock(){if let Some((_,flag))=map.remove(&state){flag.store(true,Ordering::SeqCst);}}
}

#[cfg(test)]
mod tests {
  use super::callback_path;
  #[test]
  fn rejects_wrong_state_and_unexpected_callback() {
    assert!(callback_path("GET /oauth/callback?code=a&state=correct HTTP/1.1\r\n", "correct").is_some());
    assert!(callback_path("GET /?code=a&state=correct HTTP/1.1\r\n", "correct").is_some());
    assert!(callback_path("GET /?code=a&state=wrong HTTP/1.1\r\n", "correct").is_none());
    assert!(callback_path("GET /oauth/callback?code=a&state=wrong HTTP/1.1\r\n", "correct").is_none());
    assert!(callback_path("POST /oauth/callback?code=a&state=correct HTTP/1.1\r\n", "correct").is_none());
    assert!(callback_path("GET /other?state=correct HTTP/1.1\r\n", "correct").is_none());
  }
  #[test]
  fn real_loopback_callback_and_cancellation() {
    use super::*;
    let listener=TcpListener::bind("127.0.0.1:0").unwrap();listener.set_nonblocking(true).unwrap();let port=listener.local_addr().unwrap().port();
    let handle=std::thread::spawn(move||wait_callback(listener,"expected-state",&AtomicBool::new(false)));
    for state in ["wrong-state","expected-state"]{
      let mut client=std::net::TcpStream::connect(("127.0.0.1",port)).unwrap();client.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
      write!(client,"GET /oauth/callback?state={state}&code=test-code HTTP/1.1\r\nHost: localhost\r\n\r\n").unwrap();
      let mut response=String::new();client.read_to_string(&mut response).unwrap();assert!(response.contains(if state=="expected-state"{"200 OK"}else{"400 Bad Request"}));
    }
    assert_eq!(handle.join().unwrap().unwrap(),"/oauth/callback?state=expected-state&code=test-code");
    let listener=TcpListener::bind("127.0.0.1:0").unwrap();listener.set_nonblocking(true).unwrap();
    assert!(wait_callback(listener,"expected-state",&AtomicBool::new(true)).unwrap_err().contains("annulée"));
  }

}
