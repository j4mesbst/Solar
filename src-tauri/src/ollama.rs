use serde::Serialize;
use std::collections::HashMap;
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tauri::{ipc::Channel, Manager, State};
use tokio::sync::oneshot;

#[derive(Serialize)]
pub struct OllamaStatus {
    pub supported: bool,
    pub installed: bool,
    pub running: bool,
    pub version: Option<String>,
    pub models: Vec<String>,
    pub loaded_models: Vec<String>,
    pub downloaded_models: Vec<String>,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct OllamaRequestState(Mutex<HashMap<String, oneshot::Sender<()>>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum OllamaChatEvent {
    Headers { status: u16, error: Option<String> },
    Chunk { data: String },
    Error { message: String },
    Done,
}

fn emit(channel: &Channel<OllamaChatEvent>, event: OllamaChatEvent) {
    let _ = channel.send(event);
}

async fn stream_chat(
    client: reqwest::Client,
    url: String,
    payload: serde_json::Value,
    channel: Channel<OllamaChatEvent>,
    mut cancel: oneshot::Receiver<()>,
) -> Result<(), String> {
    let sent = tokio::select! {
        _ = &mut cancel => { emit(&channel, OllamaChatEvent::Done); return Ok(()); }
        result = client.post(url).json(&payload).send() => result,
    };
    let mut response = sent.map_err(|error| format!("Connexion Ollama : {error}"))?;
    let status = response.status();
    if !status.is_success() {
        let detail = response.text().await.unwrap_or_default();
        let detail = serde_json::from_str::<serde_json::Value>(&detail).ok()
            .and_then(|value| value.get("error").and_then(serde_json::Value::as_str).map(str::to_owned))
            .or_else(|| (!detail.trim().is_empty()).then(|| detail.chars().take(800).collect()))
            .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
        emit(&channel, OllamaChatEvent::Headers { status: status.as_u16(), error: Some(detail) });
        emit(&channel, OllamaChatEvent::Done);
        return Ok(());
    }
    emit(&channel, OllamaChatEvent::Headers { status: status.as_u16(), error: None });
    let mut pending = Vec::new();
    loop {
        let next = tokio::select! {
            _ = &mut cancel => { emit(&channel, OllamaChatEvent::Done); return Ok(()); }
            chunk = response.chunk() => chunk,
        };
        match next {
            Ok(Some(bytes)) => {
                pending.extend_from_slice(&bytes);
                while let Some(index) = pending.iter().position(|byte| *byte == b'\n') {
                    let line: Vec<u8> = pending.drain(..=index).collect();
                    emit(&channel, OllamaChatEvent::Chunk { data: String::from_utf8_lossy(&line).into_owned() });
                }
            }
            Ok(None) => break,
            Err(error) => return Err(format!("Flux Ollama interrompu : {error}")),
        }
    }
    if !pending.is_empty() {
        emit(&channel, OllamaChatEvent::Chunk { data: String::from_utf8_lossy(&pending).into_owned() });
    }
    emit(&channel, OllamaChatEvent::Done);
    Ok(())
}

/// Inspect metadata without loading weights or allocating a context window.
#[tauri::command]
pub async fn ollama_model_info(base_url: String, model: String) -> Result<serde_json::Value, String> {
    if model.is_empty() || model.len() > 500 { return Err("Identifiant de modèle invalide.".into()); }
    let base = ollama_base(&base_url)?;
    let client = reqwest::Client::builder().connect_timeout(Duration::from_secs(3)).timeout(Duration::from_secs(20)).build().map_err(|e| e.to_string())?;
    let response = client.post(format!("{base}/api/show")).json(&serde_json::json!({"model":model})).send().await.map_err(|e| format!("Inspection Ollama : {e}"))?;
    if !response.status().is_success() { return Err(format!("Inspection Ollama : HTTP {}", response.status().as_u16())); }
    response.json().await.map_err(|e| format!("Métadonnées Ollama invalides : {e}"))
}

#[tauri::command]
pub async fn ollama_chat_stream(
    state: State<'_, OllamaRequestState>,
    base_url: String,
    request_id: String,
    payload: serde_json::Value,
    on_event: Channel<OllamaChatEvent>,
) -> Result<(), String> {
    if request_id.is_empty() || request_id.len() > 128 { return Err("Identifiant de requête invalide.".into()); }
    let base = ollama_base(&base_url)?;
    let url = format!("{base}/api/chat");
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_millis(1500))
        .timeout(Duration::from_secs(600))
        .build().map_err(|error| error.to_string())?;
    let (cancel_tx, cancel_rx) = oneshot::channel();
    state.0.lock().map_err(|_| "État Ollama indisponible.".to_string())?.insert(request_id.clone(), cancel_tx);
    let result = stream_chat(client, url, payload, on_event.clone(), cancel_rx).await;
    state.0.lock().map_err(|_| "État Ollama indisponible.".to_string())?.remove(&request_id);
    if let Err(error) = result { emit(&on_event, OllamaChatEvent::Error { message: error }); emit(&on_event, OllamaChatEvent::Done); }
    Ok(())
}

#[tauri::command]
pub fn ollama_cancel(state: State<'_, OllamaRequestState>, request_id: String) {
    if let Ok(mut active) = state.0.lock() {
        if let Some(cancel) = active.remove(&request_id) { let _ = cancel.send(()); }
    }
}

fn ollama_app() -> PathBuf {
    PathBuf::from("/Applications/Ollama.app")
}

fn binary_candidates() -> Vec<PathBuf> {
    vec![
        PathBuf::from("/opt/homebrew/bin/ollama"),
        PathBuf::from("/usr/local/bin/ollama"),
        ollama_app().join("Contents/Resources/ollama"),
    ]
}

fn is_executable(path: &Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path)
            .map(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        path.is_file()
    }
}

fn installed() -> bool {
    ollama_app().is_dir() || binary_candidates().iter().any(|path| is_executable(path))
}

fn cached_models(home: &Path) -> Vec<String> {
    let library = home.join(".ollama/models/manifests/registry.ollama.ai/library");
    let mut models = Vec::new();
    let Ok(names) = fs::read_dir(library) else {
        return models;
    };
    for name in names.flatten() {
        if !name.file_type().map(|kind| kind.is_dir()).unwrap_or(false) {
            continue;
        }
        let model = name.file_name().to_string_lossy().into_owned();
        let Ok(tags) = fs::read_dir(name.path()) else {
            continue;
        };
        for tag in tags.flatten() {
            if tag.file_type().map(|kind| kind.is_file()).unwrap_or(false) {
                models.push(format!("{model}:{}", tag.file_name().to_string_lossy()));
            }
        }
    }
    models.sort();
    models.dedup();
    models
}

fn ollama_base(base_url: &str) -> Result<String, String> {
    let mut url = reqwest::Url::parse(base_url.trim()).map_err(|_| "URL Ollama invalide.".to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("L’URL Ollama doit utiliser HTTP ou HTTPS.".into());
    }
    if url.host_str() == Some("localhost") {
        url.set_host(Some("127.0.0.1")).map_err(|_| "URL Ollama invalide.".to_string())?;
    }
    Ok(url.as_str().trim_end_matches('/').to_string())
}

async fn json_at(client: &reqwest::Client, url: String) -> Result<serde_json::Value, String> {
    let response = client.get(url).send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Ollama a répondu HTTP {}.", response.status()));
    }
    response.json().await.map_err(|error| format!("Réponse JSON Ollama invalide : {error}"))
}

#[tauri::command]
pub async fn ollama_status(app: tauri::AppHandle, base_url: String) -> Result<OllamaStatus, String> {
    let home = app.path().home_dir().map_err(|error| error.to_string())?;
    let installed = installed();
    let downloaded_models = cached_models(&home);
    let base = ollama_base(&base_url)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(1500))
        .connect_timeout(Duration::from_millis(1500))
        .build()
        .map_err(|error| error.to_string())?;

    let (tags, version, ps) = tokio::join!(
        json_at(&client, format!("{base}/api/tags")),
        json_at(&client, format!("{base}/api/version")),
        json_at(&client, format!("{base}/api/ps")),
    );
    let (running, models, error) = match tags {
        Ok(payload) => {
            let models = payload["models"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(|model| model["name"].as_str().map(str::to_owned))
                .collect();
            (true, models, None)
        }
        Err(error) => (false, Vec::new(), Some(error)),
    };
    let mut details = Vec::new();
    if let Err(error) = &version { if running { details.push(format!("Version : {error}")); } }
    if let Err(error) = &ps { if running { details.push(format!("Modèles en mémoire : {error}")); } }
    if let Some(error) = error.as_ref() { details.push(format!("Liste des modèles : {error}")); }
    let version = version.ok().and_then(|value| value["version"].as_str().map(str::to_owned));
    let loaded_models = ps.ok().and_then(|value| value["models"].as_array().cloned())
        .unwrap_or_default()
        .iter()
        .filter_map(|model| {
            model["name"].as_str().or_else(|| model["model"].as_str()).map(str::to_owned)
        })
        .collect();

    Ok(OllamaStatus {
        supported: cfg!(target_os = "macos"),
        installed,
        running,
        version,
        models,
        loaded_models,
        downloaded_models,
        error: if details.is_empty() { None } else { Some(details.join("\n")) },
    })
}

#[tauri::command]
pub async fn ollama_start() -> Result<(), String> {
    if !installed() {
        return Err("Ollama n’est pas installé. Télécharge-le depuis ollama.com/download/mac.".into());
    }
    if ollama_app().is_dir() {
        if Command::new("/usr/bin/open")
            .args(["-a", "Ollama"])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
    }
    let binary = binary_candidates()
        .into_iter()
        .find(|path| is_executable(path))
        .ok_or_else(|| "Le binaire Ollama n’a pas été trouvé dans les emplacements macOS habituels.".to_string())?;
    Command::new(binary)
        .arg("serve")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Impossible de démarrer Ollama : {error}"))
}
