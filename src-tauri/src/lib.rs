mod agent_jobs;
mod secret_session;
mod voice;
#[cfg(windows)]mod voice_windows;
mod background;
mod scheduler;
mod work;
mod hardware;
mod ollama;
mod cortex;
mod oauth;
mod updates;
mod integration_network;
mod attachments;
#[tauri::command]
async fn window_align_header(window:tauri::WebviewWindow,center:f64)->Result<(),String>{
 if !center.is_finite() || !(18.0..=40.0).contains(&center){return Err("Position invalide.".into());}
 #[cfg(target_os="macos")]{
  let handle=window.clone();
  window.run_on_main_thread(move||{if let Ok(raw)=handle.ns_window(){unsafe{solar_align_window_header(raw,center);}}}).map_err(|_|"Fenêtre indisponible.")?;
 }
 #[cfg(not(target_os="macos"))]let _=window;
 Ok(())
}
#[tauri::command]
async fn computer_open(app:tauri::AppHandle,window:tauri::WebviewWindow)->Result<(),String>{
 use tauri::Manager;
 if window.label()!="main"{return Err("Accès refusé.".into());}
 if let Some(browser)=app.get_webview_window("solar-computer"){browser.show().map_err(|e|e.to_string())?;browser.set_focus().map_err(|e|e.to_string())?;return Ok(());}
 tauri::WebviewWindowBuilder::new(&app,"solar-computer",tauri::WebviewUrl::External("https://www.google.com".parse().unwrap()))
 .title("Ordinateur · Solar").inner_size(1100.0,760.0)
 .on_navigation(|url|matches!(url.scheme(),"https"|"http")&&!url.host_str().is_some_and(|h|h=="localhost"||h=="127.0.0.1"||h=="[::1]"))
 .build().map_err(|e|e.to_string())?;Ok(())
}
#[cfg(target_os="macos")]
extern "C"{fn solar_align_window_header(window:*mut std::ffi::c_void,center:f64);}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(std::sync::Arc::new(secret_session::SessionSecrets::default()))
    .manage(voice::VoiceState::default())
    .manage(background::MissionLocks::default())
    .manage(background::BackgroundMode::default())
    .manage(work::WorkState::default())
    .manage(ollama::OllamaRequestState::default())
    .manage(cortex::CortexState::default())
    .manage(oauth::OAuthState::default())
    .manage(updates::UpdateState::default())
    .manage(integration_network::IntegrationRequests::default())
    .manage(attachments::AttachmentState::default())
    .setup(|app|{voice::cleanup_stale(app.handle());Ok(())})
    .on_window_event(|window, event| {
      use tauri::Manager;
      #[cfg(target_os="macos")]
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.state::<background::BackgroundMode>().enabled() { api.prevent_close(); let _ = window.hide(); }
      }
      if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
        window.state::<attachments::AttachmentState>().allow_drop(paths);
      }
    })
    .invoke_handler(tauri::generate_handler![updates::update_check,updates::update_install,computer_open,agent_jobs::agent_jobs,voice::voice_status,voice::voice_model_download,voice::voice_record_start,voice::voice_record_stop,voice::voice_cancel,voice::voice_speak,voice::voice_speech_stop,window_align_header,background::background_mode_set,background::mission_lock,background::mission_unlock,oauth::oauth_google_token,scheduler::scheduler_claim,integration_network::integration_request, integration_network::integration_cancel, oauth::oauth_cancel,attachments::attachment_read, secret_get, secret_set, secret_delete, export_save, artifact_save, oauth::oauth_begin, oauth::oauth_open, oauth::oauth_wait,oauth::oauth_finish, work::work_open, work::work_default, work::work_set_default, work::work_clear_default, work::work_read, work::work_apply, work::work_undo, hardware::hardware_info, ollama::ollama_status, ollama::ollama_model_info, ollama::ollama_start, ollama::ollama_chat_stream, ollama::ollama_cancel, cortex::cortex_check, cortex::cortex_cancel, cortex::cortex_render, cortex::cortex_semantic])
    .build(tauri::generate_context!())
    .expect("error while building Solar")
    .run(|app,event| {
      if let tauri::RunEvent::Exit = event {use tauri::Manager;voice::shutdown(&app.state::<voice::VoiceState>());}
      #[cfg(target_os="macos")]
      if let tauri::RunEvent::Reopen { .. } = event {
        use tauri::Manager;
        if let Some(window)=app.get_webview_window("main") {let _=window.show();let _=window.set_focus();}
      }
      #[cfg(not(target_os="macos"))]let _=(app,event);
    });
}

// Stable installations keep their existing Keychain namespace. Independently
// identified QA/beta bundles must never read or alter the stable user's tokens.
fn keychain_service(app: &tauri::AppHandle) -> &str {
  let id = app.config().identifier.as_str();
  if id == "fr.j4mesbst.solar" { "solar" } else { id }
}

#[tauri::command]
async fn secret_get(app:tauri::AppHandle,key:String,state:tauri::State<'_,std::sync::Arc<secret_session::SessionSecrets>>)->Result<Option<String>,String>{
 let service=keychain_service(&app).to_owned();let cache=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||cache.get(&service,&key,||{
  let entry=keyring::Entry::new(&service,&key).map_err(|e|e.to_string())?;
  match entry.get_password(){Ok(v)=>Ok(Some(v)),Err(keyring::Error::NoEntry)=>Ok(None),Err(e)=>Err(e.to_string())}
 })).await.map_err(|_|"Lecture du Trousseau interrompue.".to_string())?
}
#[tauri::command]
async fn secret_set(app:tauri::AppHandle,key:String,value:String,state:tauri::State<'_,std::sync::Arc<secret_session::SessionSecrets>>)->Result<(),String>{
 let service=keychain_service(&app).to_owned();let cache=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||cache.set(&service,&key,Some(value.clone()),||{
  keyring::Entry::new(&service,&key).map_err(|e|e.to_string())?.set_password(&value).map_err(|e|e.to_string())
 })).await.map_err(|_|"Enregistrement dans le Trousseau interrompu.".to_string())?
}
#[tauri::command]
async fn secret_delete(app:tauri::AppHandle,key:String,state:tauri::State<'_,std::sync::Arc<secret_session::SessionSecrets>>)->Result<(),String>{
 let service=keychain_service(&app).to_owned();let cache=state.inner().clone();
 tauri::async_runtime::spawn_blocking(move||cache.set(&service,&key,None,||{
  let entry=keyring::Entry::new(&service,&key).map_err(|e|e.to_string())?;
  match entry.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>Ok(()),Err(e)=>Err(e.to_string())}
 })).await.map_err(|_|"Suppression du Trousseau interrompue.".to_string())?
}

// The path is chosen by the native dialog; frontend code cannot provide an arbitrary write path.
#[tauri::command]
async fn export_save(app: tauri::AppHandle, content: String, format: String, suggested_name: String) -> Result<bool, String> {
  if format != "md" && format != "txt" { return Err("Format non pris en charge".into()); }
  tauri::async_runtime::spawn_blocking(move || {
    use tauri_plugin_dialog::DialogExt;
    let selected = app.dialog().file().set_file_name(&suggested_name).add_filter("Conversation Solar", &[&format]).blocking_save_file();
    match selected {
      None => Ok(false),
      Some(file) => {
        let path = file.into_path().map_err(|error| error.to_string())?;
        std::fs::write(path, content).map_err(|error| error.to_string())?;
        Ok(true)
      }
    }
  }).await.map_err(|error| error.to_string())?
}

#[tauri::command]
async fn artifact_save(app:tauri::AppHandle,content:Vec<u8>,suggested_name:String)->Result<bool,String>{
 if content.len()>20_000_000{return Err("Export trop volumineux".into());}
 if suggested_name.contains('/')||suggested_name.contains('\\')||suggested_name.starts_with('.') {return Err("Nom de fichier invalide".into());}
 tauri::async_runtime::spawn_blocking(move||{use tauri_plugin_dialog::DialogExt;let selected=app.dialog().file().set_file_name(&suggested_name).blocking_save_file();match selected{None=>Ok(false),Some(file)=>{std::fs::write(file.into_path().map_err(|e|e.to_string())?,content).map_err(|e|e.to_string())?;Ok(true)}}}).await.map_err(|e|e.to_string())?
}

#[cfg(test)]
mod release_tests {
  #[test]
  #[ignore = "Explicit platform credential-store round-trip using a disposable test-only namespace"]
  fn macos_keychain_disposable_roundtrip() {
    let service=format!("fr.j4mesbst.solar.release-test.{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos());
    let entry=keyring::Entry::new(&service,"disposable-test-only").unwrap();
    entry.set_password("SOLAR_TEST_ONLY_NOT_A_CREDENTIAL").unwrap();
    let read=entry.get_password();
    let deleted=entry.delete_credential();
    assert_eq!(read.unwrap(),"SOLAR_TEST_ONLY_NOT_A_CREDENTIAL");
    deleted.unwrap();assert!(matches!(entry.get_password(),Err(keyring::Error::NoEntry)));
  }
}
