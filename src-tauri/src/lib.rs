mod work;
mod hardware;
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_dialog::init())
    .manage(work::WorkState::default())
    .invoke_handler(tauri::generate_handler![secret_get, secret_set, secret_delete, export_save, artifact_save, work::work_open, work::work_read, work::work_apply, work::work_undo, hardware::hardware_info])
    .run(tauri::generate_context!())
    .expect("error while running Solar");
}

#[tauri::command]
fn secret_get(key: String) -> Result<Option<String>, String> {
  let entry = keyring::Entry::new("solar", &key).map_err(|e| e.to_string())?;
  match entry.get_password() { Ok(value) => Ok(Some(value)), Err(keyring::Error::NoEntry) => Ok(None), Err(error) => Err(error.to_string()) }
}

#[tauri::command]
fn secret_set(key: String, value: String) -> Result<(), String> {
  let entry = keyring::Entry::new("solar", &key).map_err(|e| e.to_string())?;
  entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_delete(key: String) -> Result<(), String> {
  let entry = keyring::Entry::new("solar", &key).map_err(|e| e.to_string())?;
  entry.delete_credential().map_err(|e| e.to_string())
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
