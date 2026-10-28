use tauri::Manager;
use std::io::Write;
// One durable receipt per occurrence. create_new is atomic across app processes;
// crash recovery never replays an occurrence that may have performed a write.
#[tauri::command]
pub fn scheduler_claim(app: tauri::AppHandle, account: String, automation: String, occurrence: String) -> Result<bool, String> {
  if [&account, &automation].iter().any(|v| v.is_empty() || v.len() > 100 || !v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')) || occurrence.len() > 40 || !occurrence.chars().all(|c| c.is_ascii_digit() || "-:.TZ".contains(c)) { return Err("Occurrence invalide.".into()); }
  let folder = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("automation-receipts").join(account);
  std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
  let path = folder.join(format!("{}-{}", automation, occurrence.replace(':', "-")));
  create_receipt(path)
}
fn create_receipt(path: std::path::PathBuf) -> Result<bool,String> {
  match std::fs::OpenOptions::new().write(true).create_new(true).open(path) {
    Ok(mut file) => { file.write_all(b"claimed").map_err(|e| e.to_string())?; file.sync_all().map_err(|e| e.to_string())?; Ok(true) },
    Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(false),
    Err(error) => Err(error.to_string()),
  }
}

#[cfg(test)]
mod tests {
 #[test] fn only_one_process_claim_wins_and_receipt_survives() {
  let path=std::env::temp_dir().join(format!("solar-schedule-{}-{}",std::process::id(),std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
  let handles:Vec<_>=(0..16).map(|_| {let path=path.clone();std::thread::spawn(move||super::create_receipt(path).unwrap())}).collect();
  assert_eq!(handles.into_iter().map(|handle|handle.join().unwrap()).filter(|won|*won).count(),1);
  assert!(!super::create_receipt(path.clone()).unwrap());
  std::fs::remove_file(path).unwrap();
 }
}
