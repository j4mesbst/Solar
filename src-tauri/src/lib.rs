#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![secret_get, secret_set, secret_delete])
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
