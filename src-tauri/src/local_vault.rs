//! macOS: one Keychain key per installation, authenticated encrypted records on disk.
//! Never replace a missing/denied key or an unreadable vault with an empty vault.
use ring::{
    aead,
    rand::{SecureRandom, SystemRandom},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    os::unix::{
        fs::{OpenOptionsExt, PermissionsExt},
        io::AsRawFd,
    },
    path::{Path, PathBuf},
    sync::Mutex,
};

const MASTER: &str = "solar.local-vault.master.v1";
const LIMIT: u64 = 8 * 1024 * 1024;
type Records = HashMap<String, Option<String>>;
#[derive(Default)]
struct Session {
    master: Option<Result<[u8; 32], String>>,
    legacy_denied: bool,
}
#[derive(Default)]
pub struct LocalVault(Mutex<Session>);
#[derive(Serialize, Deserialize)]
struct Envelope {
    version: u8,
    nonce: [u8; 12],
    ciphertext: Vec<u8>,
}
struct DiskLock(File);
impl Drop for DiskLock {
    fn drop(&mut self) {
        unsafe {
            libc::flock(self.0.as_raw_fd(), libc::LOCK_UN);
        }
    }
}

fn private_open(_path: &Path) -> OpenOptions {
    let mut o = OpenOptions::new();
    o.read(true)
        .write(true)
        .custom_flags(libc::O_NOFOLLOW)
        .mode(0o600);
    o
}
fn lock(dir: &Path) -> Result<DiskLock, String> {
    fs::create_dir_all(dir).map_err(|_| "Coffre local inaccessible.")?;
    let meta = fs::symlink_metadata(dir).map_err(|_| "Coffre local inaccessible.")?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Err("Dossier du coffre invalide.".into());
    }
    fs::set_permissions(dir, fs::Permissions::from_mode(0o700))
        .map_err(|_| "Protection du coffre impossible.")?;
    let file = private_open(&dir.join("vault.lock"))
        .create(true)
        .open(dir.join("vault.lock"))
        .map_err(|_| "Verrou du coffre inaccessible.")?;
    if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX) } != 0 {
        return Err("Coffre occupé.".into());
    }
    Ok(DiskLock(file))
}
fn file(dir: &Path) -> PathBuf {
    dir.join("credentials.v1.enc")
}
fn cipher(master: &[u8; 32]) -> Result<aead::LessSafeKey, String> {
    aead::UnboundKey::new(&aead::AES_256_GCM, master)
        .map(aead::LessSafeKey::new)
        .map_err(|_| "Clé du coffre invalide.".into())
}
fn read(dir: &Path, service: &str, master: &[u8; 32]) -> Result<Records, String> {
    let mut f = match OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW)
        .open(file(dir))
    {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(_) => return Err("Lecture du coffre impossible.".into()),
    };
    if f.metadata().map_err(|_| "Coffre inaccessible.")?.len() > LIMIT {
        return Err("Coffre trop volumineux.".into());
    }
    let mut bytes = Vec::new();
    f.read_to_end(&mut bytes)
        .map_err(|_| "Lecture du coffre impossible.")?;
    let mut envelope: Envelope = serde_json::from_slice(&bytes)
        .map_err(|_| "Coffre endommagé ; données conservées.".to_string())?;
    if envelope.version != 1 {
        return Err("Version du coffre inconnue.".into());
    }
    let key = cipher(master)?;
    let clear = key
        .open_in_place(
            aead::Nonce::assume_unique_for_key(envelope.nonce),
            aead::Aad::from(service.as_bytes()),
            &mut envelope.ciphertext,
        )
        .map_err(|_| "Déverrouillage du coffre impossible ; données conservées.")?;
    serde_json::from_slice(clear).map_err(|_| "Contenu du coffre invalide.".into())
}
fn write(dir: &Path, service: &str, master: &[u8; 32], records: &Records) -> Result<(), String> {
    let mut nonce = [0; 12];
    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| "Aléa sécurisé indisponible.")?;
    let mut ciphertext =
        serde_json::to_vec(records).map_err(|_| "Encodage du coffre impossible.")?;
    cipher(master)?
        .seal_in_place_append_tag(
            aead::Nonce::assume_unique_for_key(nonce),
            aead::Aad::from(service.as_bytes()),
            &mut ciphertext,
        )
        .map_err(|_| "Chiffrement impossible.")?;
    let bytes = serde_json::to_vec(&Envelope {
        version: 1,
        nonce,
        ciphertext,
    })
    .map_err(|_| "Encodage du coffre impossible.")?;
    if bytes.len() as u64 > LIMIT {
        return Err("Coffre trop volumineux.".into());
    }
    let temp = dir.join(format!(
        ".vault-{}-{}.tmp",
        std::process::id(),
        u128::from_be_bytes({
            let mut n = [0; 16];
            SystemRandom::new()
                .fill(&mut n)
                .map_err(|_| "Aléa indisponible.")?;
            n
        })
    ));
    let result = (|| {
        let mut f = private_open(&temp)
            .create_new(true)
            .open(&temp)
            .map_err(|_| "Écriture du coffre impossible.")?;
        f.write_all(&bytes)
            .and_then(|_| f.sync_all())
            .map_err(|_| "Sauvegarde du coffre impossible.")?;
        fs::rename(&temp, file(dir)).map_err(|_| "Remplacement du coffre impossible.")?;
        File::open(dir)
            .and_then(|f| f.sync_all())
            .map_err(|_| "Synchronisation du coffre impossible.")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(temp);
    }
    result
}
fn keychain_master(service: &str, exists: bool) -> Result<[u8; 32], String> {
    let entry = keyring::Entry::new(service, MASTER).map_err(|_| "Trousseau indisponible.")?;
    match entry.get_password() {
        Ok(value) => {
            if value.len() != 64 || !value.bytes().all(|b| b.is_ascii_hexdigit()) {
                return Err("Clé du coffre invalide ; données conservées.".into());
            }
            let mut key = [0; 32];
            for (i, b) in key.iter_mut().enumerate() {
                *b = u8::from_str_radix(&value[i * 2..i * 2 + 2], 16)
                    .map_err(|_| "Clé du coffre invalide.")?;
            }
            Ok(key)
        }
        Err(keyring::Error::NoEntry) if !exists => {
            let mut key = [0; 32];
            SystemRandom::new()
                .fill(&mut key)
                .map_err(|_| "Aléa sécurisé indisponible.")?;
            entry
                .set_password(&key.iter().map(|b| format!("{b:02x}")).collect::<String>())
                .map_err(|_| "Création de la clé du coffre refusée.")?;
            Ok(key)
        }
        Err(keyring::Error::NoEntry) => Err("Clé du coffre absente ; données conservées.".into()),
        Err(_) => Err(
            "Accès au coffre refusé. Relance Solar pour réessayer ; tes données sont conservées."
                .into(),
        ),
    }
}
impl LocalVault {
    fn access<T>(
        &self,
        dir: &Path,
        _service: &str,
        master: impl FnOnce(bool) -> Result<[u8; 32], String>,
        action: impl FnOnce(&mut Session, &[u8; 32]) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut session = self.0.lock().map_err(|_| "Coffre occupé.")?;
        let _lock = lock(dir)?;
        let key = session
            .master
            .get_or_insert_with(|| master(file(dir).exists()))
            .clone()?;
        action(&mut session, &key)
    }
    fn get_with(
        &self,
        dir: &Path,
        service: &str,
        key: &str,
        master: impl FnOnce(bool) -> Result<[u8; 32], String>,
        legacy: impl FnOnce() -> Result<Option<String>, String>,
    ) -> Result<Option<String>, String> {
        self.access(dir, service, master, |session, master| {
            let mut records = read(dir, service, master)?;
            if let Some(v) = records.get(key) {
                return Ok(v.clone());
            }
            if session.legacy_denied {
                return Err(
                    "Migration du trousseau interrompue. Relance Solar pour réessayer.".into(),
                );
            }
            let value = legacy().map_err(|e| {
                session.legacy_denied = true;
                e
            })?;
            records.insert(key.into(), value.clone());
            write(dir, service, master, &records)?;
            Ok(value)
        })
    }
    pub fn get(&self, dir: &Path, service: &str, key: &str) -> Result<Option<String>, String> {
        self.get_with(dir,service,key,|exists|keychain_master(service,exists),||{match keyring::Entry::new(service,key).map_err(|_|"Ancien trousseau inaccessible.")?.get_password(){Ok(v)=>Ok(Some(v)),Err(keyring::Error::NoEntry)=>Ok(None),Err(_)=>Err("Migration non autorisée. Relance Solar pour réessayer ; anciennes clés conservées.".into())}})
    }
    pub fn set(
        &self,
        dir: &Path,
        service: &str,
        key: &str,
        value: Option<String>,
    ) -> Result<(), String> {
        self.set_with(dir, service, key, value, |exists| {
            keychain_master(service, exists)
        })
    }
    fn set_with(
        &self,
        dir: &Path,
        service: &str,
        key: &str,
        value: Option<String>,
        master: impl FnOnce(bool) -> Result<[u8; 32], String>,
    ) -> Result<(), String> {
        self.access(dir, service, master, |_, master| {
            let mut records = read(dir, service, master)?;
            records.insert(key.into(), value);
            write(dir, service, master, &records)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };
    fn dir() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "solar-vault-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&p).unwrap();
        p
    }
    #[test]
    fn one_unlock_for_parallel_different_secrets_and_restart() {
        let d = dir();
        let v = Arc::new(LocalVault::default());
        let count = Arc::new(AtomicUsize::new(0));
        let jobs: Vec<_> = (0..8)
            .map(|i| {
                let (v, c, d) = (v.clone(), count.clone(), d.clone());
                std::thread::spawn(move || {
                    v.get_with(
                        &d,
                        "qa",
                        &format!("account:{i}"),
                        |_| {
                            c.fetch_add(1, Ordering::SeqCst);
                            Ok([7; 32])
                        },
                        || Ok(Some(format!("test-{i}"))),
                    )
                    .unwrap()
                })
            })
            .collect();
        for j in jobs {
            assert!(j.join().unwrap().is_some());
        }
        assert_eq!(count.load(Ordering::SeqCst), 1);
        let restart = LocalVault::default();
        assert_eq!(
            restart
                .get_with(
                    &d,
                    "qa",
                    "account:3",
                    |exists| {
                        assert!(exists);
                        Ok([7; 32])
                    },
                    || panic!("already migrated")
                )
                .unwrap(),
            Some("test-3".into())
        );
        assert!(!String::from_utf8(fs::read(file(&d)).unwrap())
            .unwrap()
            .contains("test-3"));
        assert_eq!(
            fs::metadata(file(&d)).unwrap().permissions().mode() & 0o777,
            0o600
        );
        fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn deletion_never_resurrects_legacy_and_accounts_stay_separate() {
        let d = dir();
        let v = LocalVault::default();
        for (k, val) in [
            ("account:a", Some("one".into())),
            ("account:b", Some("two".into())),
            ("account:a", None),
        ] {
            v.set_with(&d, "qa", k, val, |_| Ok([8; 32])).unwrap();
        }
        assert_eq!(
            v.get_with(&d, "qa", "account:a", |_| panic!(), || panic!())
                .unwrap(),
            None
        );
        assert_eq!(
            v.get_with(&d, "qa", "account:b", |_| panic!(), || panic!())
                .unwrap(),
            Some("two".into())
        );
        fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn denial_is_once_per_session_and_never_a_missing_secret() {
        let d = dir();
        let v = LocalVault::default();
        assert!(v
            .get_with(&d, "qa", "a", |_| Err("denied".into()), || panic!())
            .is_err());
        assert!(v
            .get_with(&d, "qa", "b", |_| panic!("no repeated prompt"), || panic!())
            .is_err());
        assert!(!file(&d).exists());
        fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn tamper_wrong_key_and_wrong_service_preserve_ciphertext() {
        let d = dir();
        let v = LocalVault::default();
        v.set_with(&d, "qa", "a", Some("secret-test".into()), |_| Ok([4; 32]))
            .unwrap();
        let original = fs::read(file(&d)).unwrap();
        assert!(read(&d, "qa", &[5; 32]).is_err());
        assert!(read(&d, "other-service", &[4; 32]).is_err());
        let mut e: Envelope = serde_json::from_slice(&original).unwrap();
        e.ciphertext[0] ^= 1;
        fs::write(file(&d), serde_json::to_vec(&e).unwrap()).unwrap();
        let tampered = fs::read(file(&d)).unwrap();
        assert!(v
            .set_with(&d, "qa", "b", Some("no".into()), |_| panic!())
            .is_err());
        assert_eq!(fs::read(file(&d)).unwrap(), tampered);
        fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn independent_process_caches_merge_under_disk_lock() {
        let d = dir();
        let a = LocalVault::default();
        let b = LocalVault::default();
        a.set_with(&d, "qa", "a", Some("a".into()), |_| Ok([6; 32]))
            .unwrap();
        b.set_with(&d, "qa", "b", Some("b".into()), |_| Ok([6; 32]))
            .unwrap();
        a.set_with(&d, "qa", "c", None, |_| panic!()).unwrap();
        assert_eq!(read(&d, "qa", &[6; 32]).unwrap().len(), 3);
        fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn legacy_denial_does_not_prompt_for_every_connector() {
        let d = dir();
        let v = LocalVault::default();
        v.set_with(&d, "qa", "saved", Some("saved".into()), |_| Ok([9; 32]))
            .unwrap();
        assert!(v
            .get_with(&d, "qa", "old-a", |_| panic!(), || Err("cancelled".into()))
            .is_err());
        assert!(v
            .get_with(
                &d,
                "qa",
                "old-b",
                |_| panic!(),
                || panic!("no repeat after cancel")
            )
            .is_err());
        assert_eq!(
            v.get_with(&d, "qa", "saved", |_| panic!(), || panic!())
                .unwrap(),
            Some("saved".into())
        );
        let restart = LocalVault::default();
        assert_eq!(
            restart
                .get_with(
                    &d,
                    "qa",
                    "old-a",
                    |_| Ok([9; 32]),
                    || Ok(Some("migrated".into()))
                )
                .unwrap(),
            Some("migrated".into())
        );
        fs::remove_dir_all(d).unwrap();
    }
    #[test]
    fn same_value_uses_a_fresh_nonce_each_write() {
        let d = dir();
        let v = LocalVault::default();
        v.set_with(&d, "qa", "a", Some("test".into()), |_| Ok([2; 32]))
            .unwrap();
        let first: Envelope = serde_json::from_slice(&fs::read(file(&d)).unwrap()).unwrap();
        v.set_with(&d, "qa", "a", Some("test".into()), |_| panic!())
            .unwrap();
        let second: Envelope = serde_json::from_slice(&fs::read(file(&d)).unwrap()).unwrap();
        assert_ne!(first.nonce, second.nonce);
        assert_ne!(first.ciphertext, second.ciphertext);
        fs::remove_dir_all(d).unwrap();
    }
}
