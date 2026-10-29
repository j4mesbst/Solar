//! Updates come only from this repository's public GitHub release assets.
use serde::{Deserialize,Serialize};
use sha2::{Digest,Sha256};
use tauri::Manager;
#[derive(Default)]pub struct UpdateState(std::sync::atomic::AtomicBool);
struct Installing<'a>(&'a std::sync::atomic::AtomicBool);
impl Drop for Installing<'_>{fn drop(&mut self){self.0.store(false,std::sync::atomic::Ordering::SeqCst);}}
#[derive(Clone,Serialize,Deserialize)]
pub struct Update { pub version:String, pub name:String, pub checksum:String, pub url:String }
fn newer(candidate:&str,current:&str)->bool{
 fn parts(v:&str)->Option<Vec<u64>>{v.trim_start_matches('v').split('.').map(|p|p.parse().ok()).collect()}
 match(parts(candidate),parts(current)){(Some(a),Some(b)) if a.len()==3&&b.len()==3=>a>b,_=>false}
}
async fn latest(current:&str)->Result<Option<Update>,String>{
 let client=reqwest::Client::builder().user_agent("Solar-updater").timeout(std::time::Duration::from_secs(30)).build().map_err(|e|e.to_string())?;
 let release:serde_json::Value=client.get("https://api.github.com/repos/j4mesbst/Solar/releases/latest").send().await.map_err(|_|"Impossible de vérifier les mises à jour.")?.error_for_status().map_err(|_|"Service de mise à jour indisponible.")?.json().await.map_err(|_|"Version illisible.")?;
 let version=release["tag_name"].as_str().unwrap_or("").trim_start_matches('v');
 if !newer(version,current)||release["draft"]==true||release["prerelease"]==true{return Ok(None);}
 let suffix=if cfg!(target_os="macos")&&cfg!(target_arch="aarch64"){"macOS-arm64.dmg"}else if cfg!(windows)&&cfg!(target_arch="x86_64"){"Windows-x64-setup.exe"}else{return Ok(None)};
 let name=format!("Solar-{version}-{suffix}");let checksum=if cfg!(windows){"SHA256SUMS-Windows.txt"}else{"SHA256SUMS-macOS.txt"};
 let assets=release["assets"].as_array().ok_or("Fichiers de mise à jour absents.")?;
 let asset=|n:&str|assets.iter().find(|a|a["name"]==n);
 if asset(&name).is_none()||asset(checksum).is_none(){return Ok(None);}
 let base=format!("https://github.com/j4mesbst/Solar/releases/download/v{version}/");
 let sums=client.get(format!("{base}{checksum}")).send().await.map_err(|_|"Vérification indisponible.")?.error_for_status().map_err(|_|"Vérification indisponible.")?.text().await.map_err(|e|e.to_string())?;
 let hash=sums.lines().find_map(|line|{let p:Vec<_>=line.split_whitespace().collect();if p.len()==2&&p[1]==name&&p[0].len()==64&&p[0].bytes().all(|b|b.is_ascii_hexdigit()){Some(p[0].to_ascii_lowercase())}else{None}}).ok_or("Empreinte de mise à jour absente.")?;
 Ok(Some(Update{version:version.into(),url:format!("{base}{name}"),name,checksum:hash}))
}
#[tauri::command]
pub async fn update_check(app:tauri::AppHandle)->Result<Option<Update>,String>{latest(&app.package_info().version.to_string()).await}
#[tauri::command]
pub async fn update_install(app:tauri::AppHandle,window:tauri::WebviewWindow)->Result<(),String>{
 if window.label()!="main"{return Err("Accès refusé.".into());}
 let state=app.state::<UpdateState>();
 if state.0.swap(true,std::sync::atomic::Ordering::SeqCst){return Err("Mise à jour déjà en cours.".into());}
 let _installing=Installing(&state.0);
 let update=latest(&app.package_info().version.to_string()).await?.ok_or("Aucune mise à jour disponible.")?;
 let folder=app.path().app_cache_dir().map_err(|e|e.to_string())?.join(format!("update-{}-{}",update.version,std::process::id()));
 std::fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
 let client=reqwest::Client::builder().user_agent("Solar-updater").timeout(std::time::Duration::from_secs(300)).build().map_err(|e|e.to_string())?;
 let mut response=client.get(&update.url).send().await.map_err(|_|"Téléchargement interrompu. Réessaie.")?.error_for_status().map_err(|_|"Téléchargement indisponible.")?;
 let path=folder.join(&update.name);let mut file=std::fs::File::create(&path).map_err(|e|e.to_string())?;let mut hash=Sha256::new();let mut size=0usize;
 use std::io::Write;
 while let Some(chunk)=response.chunk().await.map_err(|_|"Téléchargement interrompu.")?{size+=chunk.len();if size>512*1024*1024{let _=std::fs::remove_file(&path);return Err("Fichier trop volumineux.".into());}hash.update(&chunk);file.write_all(&chunk).map_err(|e|e.to_string())?;}
 file.sync_all().map_err(|e|e.to_string())?;drop(file);
 if format!("{:x}",hash.finalize())!=update.checksum{let _=std::fs::remove_file(path);return Err("Le fichier reçu est invalide. Mise à jour annulée.".into());}
 install(&app,&path,&folder)?;
 app.exit(0);Ok(())
}
#[cfg(windows)]
fn install(_app:&tauri::AppHandle,path:&std::path::Path,_folder:&std::path::Path)->Result<(),String>{
 use std::os::windows::process::CommandExt;
 std::process::Command::new(path).args(["/S","/UPDATE","/R"]).creation_flags(0x08000000).spawn().map_err(|_|"Impossible de lancer l’installation.")?;Ok(())
}
#[cfg(target_os="macos")]
fn install(_app:&tauri::AppHandle,path:&std::path::Path,folder:&std::path::Path)->Result<(),String>{
 use std::process::Command;
 let exe=std::env::current_exe().map_err(|e|e.to_string())?;let target=exe.parent().and_then(|p|p.parent()).and_then(|p|p.parent()).ok_or("Application introuvable")?;
 if target.extension().and_then(|v|v.to_str())!=Some("app")||target.starts_with("/Volumes"){return Err("Glisse d’abord Solar dans Applications pour activer la mise à jour.".into());}
 let mount=folder.join("volume");std::fs::create_dir_all(&mount).map_err(|e|e.to_string())?;
 let status=Command::new("/usr/bin/hdiutil").args(["attach","-nobrowse","-readonly","-mountpoint"]).arg(&mount).arg(path).status().map_err(|e|e.to_string())?;
 if !status.success(){return Err("Impossible d’ouvrir la mise à jour.".into());}
 let staged=target.with_file_name(format!(".Solar.update-{}.app",std::process::id()));
 let copied=Command::new("/usr/bin/ditto").arg(mount.join("Solar.app")).arg(&staged).status();
 let _=Command::new("/usr/bin/hdiutil").arg("detach").arg(&mount).status();
 if !copied.map(|s|s.success()).unwrap_or(false){let _=std::fs::remove_dir_all(&staged);return Err("Impossible d’écrire dans Applications. Tes données restent conservées.".into());}
 if !Command::new("/usr/bin/codesign").args(["--verify","--deep","--strict"]).arg(&staged).status().map_err(|e|e.to_string())?.success(){let _=std::fs::remove_dir_all(staged);return Err("Signature de l’application invalide.".into());}
 let script=r#"while kill -0 "$1" 2>/dev/null; do sleep .2; done
backup="$2.previous-$1"
if mv "$2" "$backup"; then
 if mv "$3" "$2"; then /usr/bin/open "$2"; rm -rf "$backup"; else mv "$backup" "$2"; /usr/bin/open "$2"; fi
else /usr/bin/open "$2"; fi"#;
 Command::new("/bin/sh").args(["-c",script,"solar-update",&std::process::id().to_string()]).arg(target).arg(staged).spawn().map_err(|e|e.to_string())?;Ok(())
}
#[cfg(not(any(windows,target_os="macos")))]
fn install(_: &tauri::AppHandle,_:&std::path::Path,_:&std::path::Path)->Result<(),String>{Err("Plateforme non prise en charge.".into())}
#[cfg(test)]mod tests{use super::*;#[test]fn only_new_stable_versions(){assert!(newer("0.15.1","0.15.0"));assert!(!newer("0.15.0","0.15.0"));assert!(!newer("0.14.9","0.15.0"));assert!(!newer("0.16.0-beta","0.15.0"));assert!(!newer("../../secret","0.15.0"));}}
