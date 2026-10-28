//! Windows microphone capture. Audio stays local and is removed after transcription.
use std::{path::PathBuf,sync::{Arc,Mutex,OnceLock,atomic::{AtomicBool,AtomicU32,Ordering}},thread,time::{Duration,Instant}};
use cpal::{traits::{DeviceTrait,HostTrait,StreamTrait},FromSample,Sample,SizedSample};
struct Capture{stop:Arc<AtomicBool>,worker:thread::JoinHandle<Result<(),String>>,path:PathBuf}
static CAPTURE:OnceLock<Mutex<Option<Capture>>>=OnceLock::new();
static LEVEL:AtomicU32=AtomicU32::new((-160f32).to_bits());
fn slot()->&'static Mutex<Option<Capture>>{CAPTURE.get_or_init(||Mutex::new(None))}
pub fn level()->f64{f32::from_bits(LEVEL.load(Ordering::Relaxed)) as f64}
fn stream<T:SizedSample>(device:&cpal::Device,config:&cpal::StreamConfig,samples:Arc<Mutex<Vec<f32>>>,failed:Arc<AtomicBool>)->Result<cpal::Stream,String> where f32:FromSample<T>{
 let channels=config.channels as usize;let limit=config.sample_rate.0 as usize*120;
 device.build_input_stream(config,move|input:&[T],_|{
  if let Ok(mut out)=samples.lock(){
   let mut energy=0f32;let mut count=0usize;
   for frame in input.chunks(channels){if out.len()>=limit{break;}let v=frame.iter().map(|s|f32::from_sample(*s)).sum::<f32>()/channels as f32;out.push(v.clamp(-1.,1.));energy+=v*v;count+=1;}
   if count>0{LEVEL.store((20.*(energy/count as f32).sqrt().max(1e-8).log10()).to_bits(),Ordering::Relaxed);}
  }
 },move|_|{failed.store(true,Ordering::SeqCst);},None).map_err(|_|"Impossible d’ouvrir le micro. Autorise les applications de bureau dans Paramètres → Confidentialité → Microphone.".into())
}
fn resample(input:&[f32],rate:u32)->Vec<i16>{
 let len=input.len() as u64*16000/rate as u64;
 (0..len).map(|i|{let pos=i as f64*rate as f64/16000.;let a=pos as usize;let b=(a+1).min(input.len().saturating_sub(1));let t=(pos-a as f64) as f32;((input[a]*(1.-t)+input[b]*t).clamp(-1.,1.)*32767.) as i16}).collect()
}
fn record(path:PathBuf,stop:Arc<AtomicBool>,ready:&std::sync::mpsc::SyncSender<Result<(),String>>)->Result<(),String>{
 let device=cpal::default_host().default_input_device().ok_or("Aucun microphone détecté.")?;
 let supported=device.default_input_config().map_err(|_|"Le microphone est indisponible.".to_string())?;
 let format=supported.sample_format();let config:cpal::StreamConfig=supported.into();
 if config.channels==0||config.sample_rate.0<8000||config.sample_rate.0>192000{return Err("Format du microphone non pris en charge.".into());}
 let samples=Arc::new(Mutex::new(Vec::new()));let failed=Arc::new(AtomicBool::new(false));
 let stream=match format{
  cpal::SampleFormat::F32=>stream::<f32>(&device,&config,samples.clone(),failed.clone()),
  cpal::SampleFormat::I16=>stream::<i16>(&device,&config,samples.clone(),failed.clone()),
  cpal::SampleFormat::U16=>stream::<u16>(&device,&config,samples.clone(),failed.clone()),
  cpal::SampleFormat::I32=>stream::<i32>(&device,&config,samples.clone(),failed.clone()),
  cpal::SampleFormat::F64=>stream::<f64>(&device,&config,samples.clone(),failed.clone()),
  _=>Err("Format du microphone non pris en charge.".into())
 }?;
 stream.play().map_err(|_|"Le microphone n’a pas pu démarrer.".to_string())?;let _=ready.send(Ok(()));
 let started=Instant::now();while !stop.load(Ordering::SeqCst)&&!failed.load(Ordering::SeqCst)&&started.elapsed()<Duration::from_secs(120){thread::sleep(Duration::from_millis(20));}
 drop(stream);LEVEL.store((-160f32).to_bits(),Ordering::Relaxed);
 if failed.load(Ordering::SeqCst){return Err("Le microphone a été déconnecté. Réessaie.".into());}
 let samples=samples.lock().map_err(|_|"Enregistrement interrompu.".to_string())?;
 let spec=hound::WavSpec{channels:1,sample_rate:16000,bits_per_sample:16,sample_format:hound::SampleFormat::Int};
 let mut writer=hound::WavWriter::create(path,spec).map_err(|_|"Enregistrement impossible.".to_string())?;
 for v in resample(&samples,config.sample_rate.0){writer.write_sample(v).map_err(|_|"Enregistrement interrompu.".to_string())?;}
 writer.finalize().map_err(|_|"Enregistrement interrompu.".into())
}
pub fn start(path:PathBuf)->Result<(),String>{
 let mut active=slot().lock().map_err(|_|"Microphone indisponible.".to_string())?;if active.is_some(){return Err("Un enregistrement est déjà en cours.".into());}
 let stop=Arc::new(AtomicBool::new(false));let flag=stop.clone();let target=path.clone();let(tx,rx)=std::sync::mpsc::sync_channel(2);
 let worker=thread::spawn(move||{let result=record(target,flag,&tx);if let Err(e)=&result{let _=tx.try_send(Err(e.clone()));}result});
 match rx.recv_timeout(Duration::from_secs(10)){
  Ok(Ok(()))=>{*active=Some(Capture{stop,worker,path});Ok(())},
  result=>{stop.store(true,Ordering::SeqCst);Err(result.ok().and_then(Result::err).unwrap_or("Le microphone ne répond pas.".into()))}
 }
}
pub fn stop()->Result<(),String>{if let Some(c)=slot().lock().map_err(|_|"Microphone indisponible.".to_string())?.take(){c.stop.store(true,Ordering::SeqCst);c.worker.join().map_err(|_|"Capture interrompue.".to_string())??;}Ok(())}
pub fn cancel(){if let Ok(mut active)=slot().lock(){if let Some(c)=active.take(){c.stop.store(true,Ordering::SeqCst);let _=c.worker.join();let _=std::fs::remove_file(c.path);}}}
#[cfg(test)]mod tests{use super::*;#[test]fn converts_to_mono_whisper_rate_and_bounds_pcm(){let out=resample(&vec![1.5;48000],48000);assert_eq!(out.len(),16000);assert!(out.iter().all(|x|*x==32767));assert!(resample(&[],48000).is_empty());}#[test]fn no_capture_cancel_is_safe(){cancel();stop().unwrap();}}
