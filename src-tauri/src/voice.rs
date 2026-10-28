use std::{path::{Path,PathBuf},sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},process::{Child,Command,Stdio},io::{Read,Write}};
use tauri::{Manager,State,ipc::Channel};
use serde::Serialize;
use sha2::{Digest,Sha256};
const MODEL_BYTES:u64=147951465;
const MODEL_SHA:&str="60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe";
#[derive(Default)]pub struct VoiceState{busy:Arc<AtomicBool>,cancel:Arc<AtomicBool>,recording:Mutex<Option<PathBuf>>,speech:Mutex<Option<Child>>}
struct Busy(Arc<AtomicBool>);impl Drop for Busy{fn drop(&mut self){self.0.store(false,Ordering::SeqCst);}}
impl VoiceState{fn claim(&self)->Result<Busy,String>{self.busy.compare_exchange(false,true,Ordering::SeqCst,Ordering::SeqCst).map_err(|_|"Une opération vocale est déjà en cours.")?;self.cancel.store(false,Ordering::SeqCst);Ok(Busy(self.busy.clone()))}}
#[derive(Serialize)]pub struct VoiceStatus{supported:bool,ready:bool,recording:bool,busy:bool,level:f64}
#[derive(Serialize,Clone)]pub struct DownloadProgress{completed:u64,total:u64}
fn folder(app:&tauri::AppHandle)->Result<PathBuf,String>{let p=app.path().app_data_dir().map_err(|_|"Stockage vocal indisponible.")?.join("voice");std::fs::create_dir_all(&p).map_err(|_|"Stockage vocal inaccessible.")?;Ok(p)}
#[cfg(target_os="macos")]extern "C"{fn solar_voice_permission()->i32;fn solar_voice_start(path:*const std::ffi::c_char)->i32;fn solar_voice_stop();fn solar_voice_level()->f64;}
#[tauri::command]pub async fn voice_status(app:tauri::AppHandle,state:State<'_,VoiceState>)->Result<VoiceStatus,String>{
 let path=folder(&app)?.join("ggml-base.bin");let recording=state.recording.lock().map_err(|_|"Capture indisponible.")?.is_some();
 #[cfg(target_os="macos")]let level=if recording{unsafe{solar_voice_level()}}else{-160.};#[cfg(not(target_os="macos"))]let level=-160.;
 Ok(VoiceStatus{supported:cfg!(target_os="macos"),ready:path.metadata().map(|m|m.len()==MODEL_BYTES).unwrap_or(false),recording,busy:state.busy.load(Ordering::SeqCst),level})
}
#[tauri::command]pub async fn voice_model_download(app:tauri::AppHandle,state:State<'_,VoiceState>,on_event:Channel<DownloadProgress>)->Result<(),String>{
 let _guard=state.claim()?;if state.recording.lock().map_err(|_|"Capture indisponible.")?.is_some(){return Err("Arrête d’abord l’enregistrement.".into());}
 let root=folder(&app)?;let part=root.join("ggml-base.bin.part");let dest=root.join("ggml-base.bin");let cancel=state.cancel.clone();
 let result=async{
 let client=reqwest::Client::builder().https_only(true).timeout(std::time::Duration::from_secs(600)).connect_timeout(std::time::Duration::from_secs(20)).build().map_err(|_|"Réseau indisponible.")?;
 let canceled=async{while !cancel.load(Ordering::SeqCst){tokio::time::sleep(std::time::Duration::from_millis(50)).await;}};let mut response=tokio::select!{r=client.get("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin").send()=>r,_=canceled=>return Err("Téléchargement annulé.".into())}.map_err(|_|"Téléchargement impossible. Vérifie ta connexion.")?.error_for_status().map_err(|_|"Le modèle vocal est indisponible.")?;
 let mut file=std::fs::File::create(&part).map_err(|_|"Écriture du modèle impossible.")?;let mut hash=Sha256::new();let mut total=0u64;
 loop{if cancel.load(Ordering::SeqCst){return Err("Téléchargement annulé.".into());}let canceled=async{while !cancel.load(Ordering::SeqCst){tokio::time::sleep(std::time::Duration::from_millis(50)).await;}};let chunk=tokio::select!{r=tokio::time::timeout(std::time::Duration::from_secs(20),response.chunk())=>r,_=canceled=>return Err("Téléchargement annulé.".into())}.map_err(|_|"Téléchargement interrompu. Réessaie.")?.map_err(|_|"Téléchargement interrompu.")?;let Some(bytes)=chunk else{break};total+=bytes.len() as u64;if total>MODEL_BYTES{return Err("Modèle reçu invalide.".into());}hash.update(&bytes);file.write_all(&bytes).map_err(|_|"Espace disque insuffisant.")?;let _=on_event.send(DownloadProgress{completed:total,total:MODEL_BYTES});}
 if cancel.load(Ordering::SeqCst){return Err("Téléchargement annulé.".into());}if total!=MODEL_BYTES||format!("{:x}",hash.finalize())!=MODEL_SHA{return Err("Le modèle reçu n’a pas passé sa vérification. Réessaie.".into());}file.sync_all().map_err(|_|"Enregistrement impossible.")?;drop(file);std::fs::rename(&part,&dest).map_err(|_|"Installation vocale impossible.")?;Ok(())
 }.await;if result.is_err(){let _=std::fs::remove_file(part);}result
}
#[tauri::command]pub async fn voice_record_start(app:tauri::AppHandle,state:State<'_,VoiceState>)->Result<(),String>{
 let _guard=state.claim()?;let root=folder(&app)?;if root.join("ggml-base.bin").metadata().map(|m|m.len()).unwrap_or(0)!=MODEL_BYTES{return Err("Télécharge le petit modèle vocal avant de parler.".into());}
 if state.recording.lock().map_err(|_|"Capture indisponible.")?.is_some(){return Err("Un enregistrement est déjà en cours.".into());}
 let path=root.join(format!("recording-{}.wav",std::process::id()));let target=path.clone();let cancel=state.cancel.clone();
 let result=tauri::async_runtime::spawn_blocking(move||{
 #[cfg(target_os="macos")]{if unsafe{solar_voice_permission()}!=1{return Err("Autorise Solar dans Réglages Système → Confidentialité et sécurité → Microphone.".to_string());}if cancel.load(Ordering::SeqCst){return Err("Écoute annulée.".into());}let c=std::ffi::CString::new(target.to_string_lossy().as_bytes()).map_err(|_|"Capture impossible.")?;if unsafe{solar_voice_start(c.as_ptr())}!=1{return Err("Le micro est indisponible. Vérifie qu’il est connecté.".into());}Ok(())}
 #[cfg(not(target_os="macos"))]{let _=(target,cancel);Err("La voix locale est disponible dans Solar pour macOS.".to_string())}
 }).await.map_err(|_|"Capture interrompue.")?;
 if result.is_ok(){let mut recording=state.recording.lock().map_err(|_|"Capture indisponible.")?;if state.cancel.load(Ordering::SeqCst){#[cfg(target_os="macos")]unsafe{solar_voice_stop();}let _=std::fs::remove_file(path);return Err("Écoute annulée.".into());}*recording=Some(path);}result
}
fn audio_samples(path:&Path)->Result<Vec<f32>,String>{
 let mut wav=hound::WavReader::open(path).map_err(|_|"Enregistrement illisible.")?;let spec=wav.spec();if spec.channels!=1||spec.sample_rate!=16000||spec.bits_per_sample!=16||spec.sample_format!=hound::SampleFormat::Int{return Err("Format vocal invalide.".into());}
 if wav.duration()>16000*121||wav.duration()<1600{return Err("Parle un peu plus longtemps, pendant deux minutes maximum.".into());}let samples=wav.samples::<i16>().map(|s|s.map(|v|v as f32/32768.)).collect::<Result<Vec<_>,_>>().map_err(|_|"Enregistrement incomplet.")?;
 let rms=(samples.iter().map(|v|v*v).sum::<f32>()/samples.len() as f32).sqrt();if rms<0.001{return Err("Aucune parole détectée. Rapproche-toi du micro et réessaie.".into());}Ok(samples)
}
fn transcribe(path:&Path,model:&Path,cancel:Arc<AtomicBool>)->Result<String,String>{
 static QUIET:std::sync::Once=std::sync::Once::new();QUIET.call_once(whisper_rs::install_logging_hooks);
 use whisper_rs::{WhisperContext,WhisperContextParameters,FullParams,SamplingStrategy};let samples=audio_samples(path)?;if cancel.load(Ordering::SeqCst){return Err("Transcription annulée.".into());}
 let mut hash=Sha256::new();let mut file=std::fs::File::open(model).map_err(|_|"Modèle vocal manquant.")?;let mut buf=[0u8;65536];loop{let n=file.read(&mut buf).map_err(|_|"Modèle illisible.")?;if n==0{break;}hash.update(&buf[..n]);}if format!("{:x}",hash.finalize())!=MODEL_SHA{return Err("Modèle vocal endommagé. Télécharge-le à nouveau.".into());}
 let decode=|use_gpu:bool|->Result<String,String>{let mut options=WhisperContextParameters::default();options.use_gpu(use_gpu);let context=WhisperContext::new_with_params(model.to_string_lossy().as_ref(),options).map_err(|_|"Le modèle vocal n’a pas pu démarrer.".to_string())?;
 let mut s=context.create_state().map_err(|_|"Transcription indisponible.".to_string())?;let mut params=FullParams::new(SamplingStrategy::Greedy{best_of:1});params.set_language(Some("fr"));params.set_translate(false);params.set_n_threads(4);params.set_print_progress(false);params.set_print_realtime(false);params.set_print_timestamps(false);params.set_no_context(true);// Keep the Arc alive until full() returns. The raw callback reads only this
 // AtomicBool; upstream 0.16 safe callback incorrectly casts a boxed trait object.
 unsafe extern "C" fn aborted(data:*mut std::ffi::c_void)->bool{(*(data as *const AtomicBool)).load(Ordering::SeqCst)}
 unsafe{params.set_abort_callback(Some(aborted));params.set_abort_callback_user_data(Arc::as_ptr(&cancel) as *mut std::ffi::c_void);}
 s.full(params,&samples).map_err(|_|if cancel.load(Ordering::SeqCst){"Transcription annulée."}else{"Transcription impossible. Réessaie."}.to_string())?;if cancel.load(Ordering::SeqCst){return Err("Transcription annulée.".into());}
 let text=s.as_iter().map(|segment|segment.to_str_lossy().map(|s|s.into_owned()).unwrap_or_default()).collect::<Vec<_>>().join("").trim().to_string();if text.is_empty(){return Err("Aucune parole reconnue. Réessaie.".into());}Ok(text)};
 let gpu=decode(true);if gpu.is_err()&&!cancel.load(Ordering::SeqCst){decode(false)}else{gpu}
}
#[tauri::command]pub async fn voice_record_stop(app:tauri::AppHandle,state:State<'_,VoiceState>)->Result<String,String>{
 let _guard=state.claim()?;#[cfg(target_os="macos")]unsafe{solar_voice_stop();}let path=state.recording.lock().map_err(|_|"Capture indisponible.")?.take().ok_or("Aucun enregistrement en cours.")?;let model=folder(&app)?.join("ggml-base.bin");let cancel=state.cancel.clone();
 tauri::async_runtime::spawn_blocking(move||{let result=transcribe(&path,&model,cancel);let _=std::fs::remove_file(path);result}).await.map_err(|_|"Transcription interrompue.".to_string())?
}
#[tauri::command]pub async fn voice_cancel(state:State<'_,VoiceState>)->Result<(),String>{
 state.cancel.store(true,Ordering::SeqCst);let mut recording=state.recording.lock().map_err(|_|"Capture indisponible.")?;#[cfg(target_os="macos")]unsafe{solar_voice_stop();}if let Some(path)=recording.take(){let _=std::fs::remove_file(path);}drop(recording);voice_speech_stop(state)
}
#[tauri::command]pub async fn voice_speak(text:String,state:State<'_,VoiceState>)->Result<(),String>{
 if text.trim().is_empty()||text.len()>16000{return Err("Réponse trop longue pour la lecture vocale.".into());}let mut speech=state.speech.lock().map_err(|_|"Voix indisponible.")?;if let Some(mut child)=speech.take(){let _=child.kill();let _=child.wait();}
 #[cfg(target_os="macos")]{let mut child=Command::new("/usr/bin/say").args(["-v","Amélie"]).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().map_err(|_|"Voix système indisponible.")?;if let Some(mut input)=child.stdin.take(){input.write_all(text.as_bytes()).map_err(|_|"Lecture interrompue.")?;}*speech=Some(child);Ok(())}
 #[cfg(not(target_os="macos"))]{let _=text;Err("Voix macOS indisponible.".into())}
}
#[tauri::command]pub fn voice_speech_stop(state:State<'_,VoiceState>)->Result<(),String>{if let Some(mut child)=state.speech.lock().map_err(|_|"Voix indisponible.")?.take(){let _=child.kill();let _=child.wait();}Ok(())}
#[cfg(test)]mod tests{use super::*;#[test]fn rejects_silence_and_wrong_format(){let path=std::env::temp_dir().join(format!("solar-voice-test-{}.wav",std::process::id()));let spec=hound::WavSpec{channels:1,sample_rate:16000,bits_per_sample:16,sample_format:hound::SampleFormat::Int};{let mut w=hound::WavWriter::create(&path,spec).unwrap();for _ in 0..16000{w.write_sample(0i16).unwrap();}w.finalize().unwrap();}assert!(audio_samples(&path).unwrap_err().contains("Aucune parole"));std::fs::remove_file(path).unwrap();}
 #[test]#[ignore="Explicit synthetic French WAV and verified local model, no microphone"]fn french_fixture(){let path=PathBuf::from(std::env::var("SOLAR_VOICE_TEST_WAV").unwrap());let model=PathBuf::from(std::env::var("SOLAR_VOICE_TEST_MODEL").unwrap());let started=std::time::Instant::now();let text=transcribe(&path,&model,Arc::new(AtomicBool::new(false))).unwrap();println!("Synthetic transcription: {} ({:?})",text,started.elapsed());assert!(text.to_lowercase().contains("bonjour"));}}

pub fn cleanup_stale(app:&tauri::AppHandle){if let Ok(root)=folder(app){#[cfg(unix)]{use std::os::unix::fs::PermissionsExt;let _=std::fs::set_permissions(&root,std::fs::Permissions::from_mode(0o700));}if let Ok(entries)=std::fs::read_dir(root){for entry in entries.flatten(){let name=entry.file_name().to_string_lossy().to_string();if name.starts_with("recording-")&&name.ends_with(".wav"){let _=std::fs::remove_file(entry.path());}}}}}
pub fn shutdown(state:&VoiceState){state.cancel.store(true,Ordering::SeqCst);#[cfg(target_os="macos")]unsafe{solar_voice_stop();}if let Ok(mut recording)=state.recording.try_lock(){if let Some(path)=recording.take(){let _=std::fs::remove_file(path);}}if let Ok(mut speech)=state.speech.try_lock(){if let Some(mut child)=speech.take(){let _=child.kill();let _=child.wait();}}}
