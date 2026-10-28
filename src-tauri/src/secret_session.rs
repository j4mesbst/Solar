use std::collections::HashMap;
use std::sync::Mutex;
/// Process memory only; keys include the Keychain service and account-scoped name.
/// One lock also coalesces parallel reads instead of showing duplicate OS prompts.
#[derive(Default)]
pub struct SessionSecrets(Mutex<HashMap<(String,String),Option<String>>>);
impl SessionSecrets {
 pub fn get(&self,service:&str,key:&str,load:impl FnOnce()->Result<Option<String>,String>)->Result<Option<String>,String>{
  let mut values=self.0.lock().map_err(|_|"Trousseau occupé.".to_string())?;
  let id=(service.to_owned(),key.to_owned());if let Some(value)=values.get(&id){return Ok(value.clone());}
  let value=load()?;values.insert(id,value.clone());Ok(value)
 }
 pub fn set(&self,service:&str,key:&str,value:Option<String>,write:impl FnOnce()->Result<(),String>)->Result<(),String>{
  let mut values=self.0.lock().map_err(|_|"Trousseau occupé.".to_string())?;write()?;values.insert((service.to_owned(),key.to_owned()),value);Ok(())
 }
}
#[cfg(test)]mod tests{
 use super::*;use std::sync::{Arc,atomic::{AtomicUsize,Ordering}};
 #[test]fn concurrent_reads_only_unlock_once(){let vault=Arc::new(SessionSecrets::default());let reads=Arc::new(AtomicUsize::new(0));let jobs:Vec<_>=(0..8).map(|_|{let v=vault.clone();let r=reads.clone();std::thread::spawn(move||assert_eq!(v.get("qa","account-a",||{r.fetch_add(1,Ordering::SeqCst);Ok(Some("test-only".into()))}).unwrap(),Some("test-only".into())))}).collect();for j in jobs{j.join().unwrap();}assert_eq!(reads.load(Ordering::SeqCst),1);}
 #[test]fn isolation_updates_deletion_and_failed_write(){let v=SessionSecrets::default();assert_eq!(v.get("qa","a",||Ok(Some("a".into()))).unwrap(),Some("a".into()));assert_eq!(v.get("qa","b",||Ok(None)).unwrap(),None);assert!(v.set("qa","a",Some("wrong".into()),||Err("disk".into())).is_err());assert_eq!(v.get("qa","a",||panic!()).unwrap(),Some("a".into()));v.set("qa","a",Some("new".into()),||Ok(())).unwrap();assert_eq!(v.get("qa","a",||panic!()).unwrap(),Some("new".into()));v.set("qa","a",None,||Ok(())).unwrap();assert_eq!(v.get("qa","a",||panic!()).unwrap(),None);assert_eq!(v.get("other","a",||Ok(Some("other".into()))).unwrap(),Some("other".into()));}
 #[test]fn authorization_failure_is_not_a_fake_missing_secret(){let v=SessionSecrets::default();assert!(v.get("qa","a",||Err("denied".into())).is_err());assert_eq!(v.get("qa","a",||Ok(Some("retry".into()))).unwrap(),Some("retry".into()));}
}
