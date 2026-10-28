use std::sync::atomic::{AtomicBool,Ordering};
#[derive(Default)]
pub struct BackgroundMode(pub AtomicBool);
impl BackgroundMode {
 pub fn enabled(&self)->bool{self.0.load(Ordering::SeqCst)}
 pub fn set(&self,enabled:bool){self.0.store(enabled,Ordering::SeqCst);}
}
#[tauri::command]
pub fn background_mode_set(state:tauri::State<'_,BackgroundMode>,enabled:bool){state.set(enabled);}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn background_is_opt_in_and_can_be_revoked(){let mode=BackgroundMode::default();assert!(!mode.enabled());mode.set(true);assert!(mode.enabled());mode.set(false);assert!(!mode.enabled());}
}

use std::{collections::HashMap,fs::File,sync::Mutex};
#[derive(Default)]pub struct MissionLocks(Mutex<HashMap<String,File>>);
fn valid(value:&str)->bool{!value.is_empty()&&value.len()<=80&&value.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_'||b==b'.')&&value!="."&&value!=".."}
#[cfg(unix)]fn lock_file(path:&std::path::Path)->Result<Option<File>,String>{
 use std::os::{fd::AsRawFd,unix::fs::OpenOptionsExt};
 let file=std::fs::OpenOptions::new().create(true).read(true).write(true).mode(0o600).open(path).map_err(|_|"Verrou de mission indisponible.".to_string())?;
 if unsafe{libc::flock(file.as_raw_fd(),libc::LOCK_EX|libc::LOCK_NB)}==0{Ok(Some(file))}else{let error=std::io::Error::last_os_error();if error.raw_os_error()==Some(libc::EWOULDBLOCK){Ok(None)}else{Err("Verrou système indisponible.".into())}}
}
#[tauri::command]
pub fn mission_lock(app:tauri::AppHandle,state:tauri::State<'_,MissionLocks>,account:String,key:String)->Result<bool,String>{
 use tauri::Manager;
 if !valid(&account)||!valid(&key){return Err("Identifiant de mission invalide.".into());}
 let mut held=state.0.lock().map_err(|_|"Verrou indisponible.".to_string())?;let id=format!("{account}:{key}");if held.contains_key(&id){return Ok(false);}
 let directory=app.path().app_local_data_dir().map_err(|_|"Dossier local indisponible.".to_string())?.join("mission-locks").join(account);
 std::fs::create_dir_all(&directory).map_err(|_|"Dossier de verrous indisponible.".to_string())?;
 #[cfg(unix)]{if let Some(file)=lock_file(&directory.join(format!("{key}.lock")))?{held.insert(id,file);return Ok(true);}Ok(false)}
 #[cfg(not(unix))]{let _=(held,id,directory);Err("Verrou de mission non pris en charge sur cette plateforme.".into())}
}
#[tauri::command]
pub fn mission_unlock(state:tauri::State<'_,MissionLocks>,account:String,key:String)->Result<(),String>{state.0.lock().map_err(|_|"Verrou indisponible.".to_string())?.remove(&format!("{account}:{key}"));Ok(())}
#[cfg(all(test,unix))]mod lease_tests{
 use super::*;
 #[test]fn file_lease_excludes_second_owner_and_drop_releases(){let path=std::env::temp_dir().join(format!("solar-lease-test-{}",std::process::id()));let first=lock_file(&path).unwrap().unwrap();assert!(lock_file(&path).unwrap().is_none());drop(first);assert!(lock_file(&path).unwrap().is_some());let _=std::fs::remove_file(path);}
 #[test]fn lock_paths_reject_traversal(){assert!(valid("guest"));assert!(!valid("../other"));assert!(!valid(".."));assert!(!valid("a/b"));}
}
