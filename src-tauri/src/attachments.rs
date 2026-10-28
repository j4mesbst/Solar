use std::collections::HashSet;
use std::io::Read;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub struct AttachmentState(pub Mutex<HashSet<PathBuf>>);

impl AttachmentState {
  fn take(&self, supplied: &PathBuf) -> Result<PathBuf, String> {
    if std::fs::symlink_metadata(supplied).map(|m| m.file_type().is_symlink()).unwrap_or(true) { return Err("Fichier déposé invalide.".into()); }
    let canonical = supplied.canonicalize().map_err(|_| "Fichier déposé introuvable.")?;
    if !self.0.lock().map_err(|_| "Autorisation de fichier indisponible.")?.remove(&canonical) { return Err("Ce fichier n’a pas été déposé dans Solar. Utilise le sélecteur de fichiers.".into()); }
    Ok(canonical)
  }
  pub fn allow_drop(&self, paths: &[PathBuf]) {
    if let Ok(mut allowed) = self.0.lock() {
      // A bounded, one-use grant from an actual native Finder drop.
      allowed.clear();
      for path in paths.iter().take(10) {
        if std::fs::symlink_metadata(path).map(|m| m.is_file() && !m.file_type().is_symlink()).unwrap_or(false) {
          if let Ok(canonical) = path.canonicalize() { allowed.insert(canonical); }
        }
      }
    }
  }
}

#[derive(serde::Serialize)]
pub struct Attachment { name: String, bytes: Vec<u8> }

#[tauri::command]
pub async fn attachment_read(path: String, state: tauri::State<'_, AttachmentState>) -> Result<Attachment, String> {
  let supplied = PathBuf::from(path);
  let canonical = state.take(&supplied)?;
  tauri::async_runtime::spawn_blocking(move || read_attachment(canonical)).await.map_err(|_| "Lecture de fichier interrompue.")?
}

fn read_attachment(canonical: PathBuf) -> Result<Attachment, String> {
    let name = canonical.file_name().and_then(|value| value.to_str()).ok_or("Nom de fichier invalide.")?.to_string();
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(unix)]
    { use std::os::unix::fs::OpenOptionsExt; options.custom_flags(libc::O_NOFOLLOW); }
    let file = options.open(&canonical).map_err(|_| "Impossible de lire le fichier déposé.")?;
    let metadata = file.metadata().map_err(|_| "Fichier illisible.")?;
    if !metadata.is_file() || metadata.len() > 5_000_000 { return Err("Choisis un fichier de moins de 5 Mo.".into()); }
    let mut bytes = Vec::new();
    file.take(5_000_001).read_to_end(&mut bytes).map_err(|_| "Fichier illisible.")?;
    if bytes.len() > 5_000_000 { return Err("Le fichier dépasse 5 Mo.".into()); }
    Ok(Attachment { name, bytes })
}

#[cfg(test)]
mod tests {
  use super::*;
  struct Fixture(PathBuf);
  impl Fixture {
    fn new() -> Self {
      let path = std::env::temp_dir().join(format!("solar-attachment-test-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
      std::fs::write(&path, b"contenu choisi").unwrap(); Self(path)
    }
  }
  impl Drop for Fixture { fn drop(&mut self) { let _ = std::fs::remove_file(&self.0); } }
  #[test]
  fn requires_real_drop_and_consumes_the_grant() {
    let file = Fixture::new(); let state = AttachmentState::default();
    assert!(state.take(&file.0).is_err());
    state.allow_drop(&[file.0.clone()]);
    let attachment = read_attachment(state.take(&file.0).unwrap()).unwrap();
    assert_eq!(attachment.bytes, b"contenu choisi");
    assert!(state.take(&file.0).is_err());
  }
  #[test]
  fn rejects_oversized_files() {
    let file = Fixture::new();
    std::fs::OpenOptions::new().write(true).open(&file.0).unwrap().set_len(5_000_001).unwrap();
    assert!(read_attachment(file.0.clone()).is_err());
  }
  #[cfg(unix)]
  #[test]
  fn does_not_grant_symlinks_or_follow_replacements() {
    let target = Fixture::new(); let link = Fixture::new(); std::fs::remove_file(&link.0).unwrap();
    std::os::unix::fs::symlink(&target.0, &link.0).unwrap();
    let state = AttachmentState::default(); state.allow_drop(&[link.0.clone()]);
    assert!(state.take(&link.0).is_err());
    assert!(read_attachment(link.0.clone()).is_err());
  }
}
