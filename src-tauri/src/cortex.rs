use crate::work::{Change, WorkState};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    io::{BufRead, BufReader, Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri_plugin_dialog::DialogExt;

#[derive(Default)]
pub struct CortexState {
    active: Mutex<HashMap<String, Arc<AtomicBool>>>,
    grants: Mutex<HashSet<String>>,
}
#[derive(Serialize)]
pub struct Check {
    r#type: String,
    success: bool,
    status: String,
    output: String,
    #[serde(rename = "renderReport", skip_serializing_if = "Option::is_none")]
    render_report: Option<serde_json::Value>,
}
fn check(kind: &str, status: &str, output: String) -> Check {
    Check {
        r#type: kind.into(),
        success: status == "passed",
        status: status.into(),
        output,
        render_report: None,
    }
}
fn measured_motion(frames: &[serde_json::Value]) -> bool {
    frames.windows(2).any(|pair| {
        let before=pair[0]["elements"].as_array();
        let after=pair[1]["elements"].as_array();
        let (Some(before),Some(after))=(before,after) else {return false};
        before.iter().any(|left| {
            let Some(right)=after.iter().find(|right|right["selector"]==left["selector"]) else {return false};
            ["x","y","width","height"].iter().any(|key|(left[*key].as_f64().unwrap_or(0.0)-right[*key].as_f64().unwrap_or(0.0)).abs()>1.0)
                ||(left["opacity"].as_f64().unwrap_or(1.0)-right["opacity"].as_f64().unwrap_or(1.0)).abs()>0.015
                ||["transform","filter","visible"].iter().any(|key|left[*key]!=right[*key])
        })
    })
}

fn validate_inspection(options: &Option<serde_json::Value>) -> Result<(), String> {
    let Some(options) = options else {
        return Ok(());
    };
    if options.to_string().len() > 16_000 {
        return Err("Inspection trop volumineuse.".into());
    }
    if let Some(view) = options.get("viewport") {
        let w = view["width"].as_f64().unwrap_or(0.0);
        let h = view["height"].as_f64().unwrap_or(0.0);
        if !(320.0..=1920.0).contains(&w) || !(240.0..=1200.0).contains(&h) {
            return Err("Viewport hors limites.".into());
        }
    }
    if let Some(actions) = options.get("interactions") {
        let actions = actions.as_array().ok_or("Interactions invalides")?;
        if actions.len() > 8 {
            return Err("Trop d’interactions.".into());
        }
        for action in actions {
            if !["click", "fill"].contains(&action["type"].as_str().unwrap_or(""))
                || action["selector"].as_str().is_none_or(|s| s.is_empty() || s.len() > 160 || s.contains(['\n', '\r', '\0']))
                || action["value"].as_str().is_some_and(|s| s.len() > 1000)
                || action["type"] == "click" && action.get("value").is_some()
                || action["type"] == "fill" && !action["value"].is_string()
                || action.as_object().is_none_or(|a| a.keys().any(|key| !["selector", "type", "value", "expect"].contains(&key.as_str())))
            {
                return Err("Interaction hors limites.".into());
            }
        }
    }
    if let Some(times) = options.get("timeline") {
        let times = times.as_array().ok_or("Timeline invalide")?;
        if times.is_empty()
            || times.len() > 12
            || times
                .iter()
                .any(|t| t.as_f64().is_none_or(|n| !(0.0..=10_000.0).contains(&n)))
        {
            return Err("Timeline hors limites.".into());
        }
    }
    if let Some(selectors) = options.get("selectors") {
        let selectors = selectors.as_array().ok_or("Sélecteurs invalides")?;
        if selectors.len() > 24 || selectors.iter().any(|s| s.as_str().is_none_or(|v| v.is_empty() || v.len() > 160)) {
            return Err("Sélecteurs hors limites.".into());
        }
    }
    if options.get("motionClock").is_some_and(|v| !["auto", "waapi", "gsap"].contains(&v.as_str().unwrap_or(""))) {
        return Err("Horloge de mouvement invalide.".into());
    }
    if let Some(remotion) = options.get("remotion") {
        let fields = remotion.as_object().ok_or("Inspection Remotion invalide")?;
        if fields.keys().any(|k| !["entryPoint", "compositionId", "frames", "exportVideo"].contains(&k.as_str()))
            || remotion.get("entryPoint").is_some_and(|v| v.as_str().is_none_or(|p| !safe_relative(p)))
            || remotion.get("compositionId").is_some_and(|v| v.as_str().is_none_or(|s| s.is_empty() || s.len() > 100))
            || remotion.get("exportVideo").is_some_and(|v| !v.is_boolean())
            || remotion.get("frames").is_some_and(|v| v.as_array().is_none_or(|a| a.is_empty() || a.len()>12 || a.iter().any(|f| f.as_u64().is_none_or(|n| n>432000)))) {
            return Err("Paramètres Remotion hors limites.".into());
        }
    }
    Ok(())
}

fn lsp_symbols(path: &Path, text: &str, cancel: &AtomicBool) -> Result<serde_json::Value, String> {
    let mut child = Command::new("/usr/bin/sourcekit-lsp")
        .current_dir(path.parent().ok_or("Dossier absent")?)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("SourceKit-LSP indisponible : {e}"))?;
    let result = (|| {
        let mut input = child.stdin.take().ok_or("Entrée LSP absente")?;
        let output = child.stdout.take().ok_or("Sortie LSP absente")?;
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut reader = BufReader::new(output);
            loop {
                let mut length = 0;
                loop {
                    let mut line = String::new();
                    if reader.read_line(&mut line).unwrap_or(0) == 0 {
                        return;
                    }
                    if line == "\r\n" || line == "\n" {
                        break;
                    }
                    if let Some(value) = line.strip_prefix("Content-Length:") {
                        length = value.trim().parse::<usize>().unwrap_or(0);
                    }
                }
                if length == 0 || length > 500_000 {
                    return;
                }
                let mut body = vec![0; length];
                if reader.read_exact(&mut body).is_err() {
                    return;
                }
                if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&body) {
                    if tx.send(value).is_err() {
                        return;
                    }
                }
            }
        });
        let send = |input: &mut std::process::ChildStdin,
                    value: serde_json::Value|
         -> Result<(), String> {
            let body = serde_json::to_string(&value).map_err(|e| e.to_string())?;
            write!(input, "Content-Length: {}\r\n\r\n{}", body.len(), body)
                .map_err(|e| e.to_string())?;
            input.flush().map_err(|e| e.to_string())
        };
        let uri = tauri::Url::from_file_path(path)
            .map_err(|_| "URI source invalide")?
            .to_string();
        let root_uri = tauri::Url::from_directory_path(path.parent().ok_or("Dossier absent")?)
            .map_err(|_| "URI projet invalide")?
            .to_string();
        send(
            &mut input,
            serde_json::json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":std::process::id(),"rootUri":root_uri,"capabilities":{}}}),
        )?;
        let started = Instant::now();
        let mut initialized = false;
        while started.elapsed() < Duration::from_secs(5) {
            if cancel.load(Ordering::Relaxed) {
                return Err("Annulé".into());
            }
            let Ok(message) = rx.recv_timeout(Duration::from_millis(25)) else {
                continue;
            };
            if message["method"].is_string() && !message["id"].is_null() {
                let response = if message["method"] == "workspace/configuration" {
                    serde_json::json!(message["params"]["items"]
                        .as_array()
                        .map(|items| vec![serde_json::Value::Null; items.len()])
                        .unwrap_or_default())
                } else if message["method"] == "workspace/applyEdit" {
                    serde_json::json!({"applied":false})
                } else {
                    serde_json::Value::Null
                };
                send(
                    &mut input,
                    serde_json::json!({"jsonrpc":"2.0","id":message["id"],"result":response}),
                )?;
                continue;
            }
            if message["id"] == 1 && !initialized {
                if !message["error"].is_null() {
                    return Err(format!("Initialisation LSP refusée : {}", message["error"]));
                }
                initialized = true;
                send(
                    &mut input,
                    serde_json::json!({"jsonrpc":"2.0","method":"initialized","params":{}}),
                )?;
                send(
                    &mut input,
                    serde_json::json!({"jsonrpc":"2.0","method":"textDocument/didOpen","params":{"textDocument":{"uri":uri,"languageId":"swift","version":1,"text":text}}}),
                )?;
                send(
                    &mut input,
                    serde_json::json!({"jsonrpc":"2.0","id":2,"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":uri}}}),
                )?;
            }
            if message["id"] == 2 {
                if !message["error"].is_null() {
                    return Err(format!("Navigation LSP : {}", message["error"]));
                }
                return Ok(message["result"].clone());
            }
        }
        Err("SourceKit-LSP : délai technique de 5s dépassé.".into())
    })();
    let _ = child.kill();
    let _ = child.wait();
    result
}

#[tauri::command]
pub async fn cortex_semantic(
    work: tauri::State<'_, WorkState>,
    state: tauri::State<'_, CortexState>,
    token: String,
    request_id: String,
    changes: Vec<Change>,
) -> Result<Vec<Check>, String> {
    let root = crate::work::root_for(&work, &token)?;
    let cancel = registration(&state, &request_id)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let copy = Scratch::new()?;
        patch_snapshot(&root, &copy.0, &changes)?;
        let mut checks = vec![];
        for change in changes
            .iter()
            .filter(|c| c.path.ends_with(".swift"))
            .take(2)
        {
            match lsp_symbols(&copy.0.join(&change.path), &change.after, &cancel) {
                Ok(symbols) => checks.push(check(
                    "structure",
                    "passed",
                    format!(
                        "SourceKit-LSP {} : {}",
                        change.path,
                        serde_json::to_string(&symbols)
                            .unwrap_or_default()
                            .chars()
                            .take(2400)
                            .collect::<String>()
                    ),
                )),
                Err(detail) => checks.push(check("structure", "unavailable", detail)),
            }
        }
        Ok::<Vec<Check>, String>(checks)
    })
    .await
    .map_err(|e| e.to_string())?;
    state
        .active
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&request_id);
    result
}

struct Scratch(PathBuf);
static NEXT_SCRATCH_ID: AtomicU64 = AtomicU64::new(0);
impl Scratch {
    fn new() -> Result<Self, String> {
        let name = format!(
            "solar-cortex-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_nanos(),
            NEXT_SCRATCH_ID.fetch_add(1, Ordering::Relaxed),
        );
        let path = std::env::temp_dir().join(name);
        std::fs::create_dir(&path).map_err(|e| e.to_string())?;
        Ok(Self(path.canonicalize().map_err(|e| e.to_string())?))
    }
}
impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn safe_relative(path: &str) -> bool {
    !path.is_empty()
        && path.len() < 250
        && !path.contains('\\')
        && Path::new(path)
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_)))
        && path.split('/').all(|s| {
            !s.starts_with('.')
                && !matches!(s, "node_modules" | "target" | "dist" | "build" | "vendor")
                && !s.contains("secret")
                && !s.contains("credential")
                && !s.ends_with(".pem")
                && !s.ends_with(".key")
        })
}
fn copy_sources(
    root: &Path,
    dir: &Path,
    out: &Path,
    count: &mut usize,
    bytes: &mut u64,
    cancel: &AtomicBool,
) -> Result<(), String> {
    if cancel.load(Ordering::Relaxed) {
        return Err("Annulé".into());
    }
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let relative = path.strip_prefix(root).map_err(|e| e.to_string())?;
        if !safe_relative(&relative.to_string_lossy()) {
            continue;
        }
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_symlink() {
            continue;
        }
        let target = out.join(relative);
        if metadata.is_dir() {
            std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            copy_sources(root, &path, out, count, bytes, cancel)?;
        } else if metadata.is_file() && metadata.len() <= 2_000_000 {
            *count += 1;
            *bytes += metadata.len();
            if *count > 3000 || *bytes > 60_000_000 {
                return Err(
                    "Projet trop volumineux pour la copie de vérification initiale.".into(),
                );
            }
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            std::fs::copy(path, target).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
fn patch_snapshot(root: &Path, copy: &Path, changes: &[Change]) -> Result<(), String> {
    if changes.len() > 20 || changes.iter().map(|c| c.after.len()).sum::<usize>() > 2_000_000 {
        return Err("Lot de vérification trop volumineux.".into());
    }
    for change in changes {
        if !safe_relative(&change.path) {
            return Err("Chemin de proposition interdit.".into());
        }
        let original = root.join(&change.path);
        if change.created {
            if original.exists() || !change.before.is_empty() {
                return Err("Création en conflit.".into());
            }
        } else {
            let real = original.canonicalize().map_err(|e| e.to_string())?;
            if !real.starts_with(root)
                || std::fs::symlink_metadata(&original)
                    .map_err(|e| e.to_string())?
                    .file_type()
                    .is_symlink()
            {
                return Err("Chemin hors projet.".into());
            }
            if std::fs::read_to_string(&real).map_err(|e| e.to_string())? != change.before {
                return Err(format!("{} a changé depuis la lecture.", change.path));
            }
        }
        let target = copy.join(&change.path);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(target, &change.after).map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn binary(name: &str) -> Option<PathBuf> {
    [
        format!("/opt/homebrew/bin/{name}"),
        format!("/usr/local/bin/{name}"),
        format!("/usr/bin/{name}"),
    ]
    .iter()
    .map(PathBuf::from)
    .find(|p| p.is_file())
}
fn collect(mut pipe: impl Read) -> String {
    let mut output = Vec::new();
    let mut buf = [0; 4096];
    while let Ok(n) = pipe.read(&mut buf) {
        if n == 0 {
            break;
        }
        if output.len() < 48_000 {
            output.extend_from_slice(&buf[..n.min(48_000 - output.len())]);
        }
    }
    String::from_utf8_lossy(&output).into_owned()
}
fn run(
    mut command: Command,
    cancel: &AtomicBool,
    timeout: Duration,
) -> Result<(bool, String), String> {
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("Sortie indisponible")?;
    let stderr = child.stderr.take().ok_or("Erreur indisponible")?;
    let out = std::thread::spawn(move || collect(stdout));
    let err = std::thread::spawn(move || collect(stderr));
    let started = Instant::now();
    let result = loop {
        if cancel.load(Ordering::Relaxed) || started.elapsed() > timeout {
            #[cfg(unix)]
            unsafe {
                libc::kill(-(child.id() as i32), libc::SIGKILL);
            }
            let _ = child.kill();
            let _ = child.wait();
            break Err(if cancel.load(Ordering::Relaxed) {
                "Annulé"
            } else {
                "Délai de vérification dépassé"
            }
            .to_string());
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status.success()),
            Ok(None) => std::thread::sleep(Duration::from_millis(30)),
            Err(e) => break Err(e.to_string()),
        }
    };
    // Kill any subprocess which retained output handles after the parent exited.
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    let output = format!(
        "{}\n{}",
        out.join().unwrap_or_default(),
        err.join().unwrap_or_default()
    );
    result.map(|ok| (ok, output.chars().take(6000).collect()))
}
#[tauri::command]
pub fn cortex_cancel(state: tauri::State<'_, CortexState>, request_id: String) {
    if let Ok(active) = state.active.lock() {
        if let Some(cancel) = active.get(&request_id) {
            cancel.store(true, Ordering::Relaxed);
        }
    }
}
fn registration(state: &CortexState, id: &str) -> Result<Arc<AtomicBool>, String> {
    if id.len() > 100 {
        return Err("Identifiant invalide".into());
    }
    let flag = Arc::new(AtomicBool::new(false));
    state
        .active
        .lock()
        .map_err(|e| e.to_string())?
        .insert(id.into(), flag.clone());
    Ok(flag)
}

#[tauri::command]
pub async fn cortex_check(
    app: tauri::AppHandle,
    work: tauri::State<'_, WorkState>,
    state: tauri::State<'_, CortexState>,
    token: String,
    task_id: String,
    request_id: String,
    changes: Vec<Change>,
    capture: Option<bool>,
    temporal: Option<bool>,
    reference: Option<String>,
    options: Option<serde_json::Value>,
) -> Result<Vec<Check>, String> {
    validate_inspection(&options)?;
    if task_id.len() > 100 || reference.as_ref().is_some_and(|s| s.len() > 8_000_000) {
        return Err("Paramètres de vérification hors limites.".into());
    }
    let root = crate::work::root_for(&work, &token)?;
    let cancel = registration(&state, &request_id)?;
    let grant = format!("{token}:{task_id}");
    if !state
        .grants
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&grant)
    {
        let consent=app.dialog().message("Autoriser la compilation et les tests du code proposé pour cette tâche Cortex ? Solar travaille sur une copie temporaire. Les scripts du projet et le code testé s’exécutent avec vos permissions macOS : la copie n’est pas un bac à sable système. Autorisez seulement les projets et propositions de confiance.").title("Vérifications Solar Cortex").buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancel).blocking_show();
        if !consent {
            state
                .active
                .lock()
                .map_err(|e| e.to_string())?
                .remove(&request_id);
            return Ok(vec![check(
                "build",
                "unavailable",
                "Exécution non autorisée. Aucun build ou test lancé.".into(),
            )]);
        }
        let mut grants = state.grants.lock().map_err(|e| e.to_string())?;
        if grants.len() > 100 {
            grants.clear();
        }
        grants.insert(grant);
    }
    if cancel.load(Ordering::Relaxed) {
        state
            .active
            .lock()
            .map_err(|e| e.to_string())?
            .remove(&request_id);
        return Err("Annulé".into());
    }
    let export_destination = if options.as_ref().and_then(|o|o.get("remotion")).and_then(|o|o.get("exportVideo")).and_then(|v|v.as_bool()) == Some(true) {
        match app.dialog().file().set_file_name("cortex-video.mp4").blocking_save_file() {
            Some(file) => Some(file.into_path().map_err(|e|e.to_string())?),
            None => { state.active.lock().map_err(|e|e.to_string())?.remove(&request_id); return Ok(vec![check("temporal","unavailable","Export vidéo annulé par l’utilisateur.".into())]); }
        }
    } else { None };
    let result = tauri::async_runtime::spawn_blocking(move || {
        check_project_with_options(
            &root,
            &changes,
            &cancel,
            capture.unwrap_or(false),
            temporal.unwrap_or(false),
            reference,
            options,
            export_destination,
        )
    })
    .await
    .map_err(|e| e.to_string())?;
    state
        .active
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&request_id);
    result
}
#[cfg(test)]
fn check_project(
    root: &Path,
    changes: &[Change],
    cancel: &AtomicBool,
    capture: bool,
    temporal: bool,
    reference: Option<String>,
) -> Result<Vec<Check>, String> {
    check_project_with_options(root, changes, cancel, capture, temporal, reference, None, None)
}
fn check_project_with_options(
    root: &Path,
    changes: &[Change],
    cancel: &AtomicBool,
    capture: bool,
    temporal: bool,
    reference: Option<String>,
    options: Option<serde_json::Value>,
    export_destination: Option<PathBuf>,
) -> Result<Vec<Check>, String> {
    let copy = Scratch::new()?;
    copy_sources(root, root, &copy.0, &mut 0, &mut 0, cancel)?;
    patch_snapshot(root, &copy.0, changes)?;
    let mut checks = vec![];
    if copy.0.join("package.json").is_file() {
        let package: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(copy.0.join("package.json")).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        let original_package: serde_json::Value = serde_json::from_str(
            &std::fs::read_to_string(root.join("package.json")).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        if package.get("scripts") != original_package.get("scripts") {
            return Ok(vec![check("build","unavailable","Les scripts npm ont été modifiés dans la proposition. Examine et approuve ces changements séparément avant de les exécuter; aucun script proposé par le modèle n’a été lancé.".into())]);
        }
        #[cfg(unix)]
        if root.join("node_modules").is_dir() {
            std::os::unix::fs::symlink(root.join("node_modules"), copy.0.join("node_modules"))
                .map_err(|e| e.to_string())?;
        }
        for id in ["build", "tests"] {
            let key = if id == "tests" { "test" } else { "build" };
            if package
                .get("scripts")
                .and_then(|s| s.get(key))
                .and_then(|s| s.as_str())
                .is_none()
            {
                continue;
            }
            let Some(npm) = binary("npm") else {
                checks.push(check(
                    id,
                    "unavailable",
                    "npm introuvable. Installe Node.js pour les vérifications du projet.".into(),
                ));
                continue;
            };
            let mut command = Command::new(npm);
            command
                .current_dir(&copy.0)
                .args(["run", key])
                .env("CI", "1")
                .env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin");
            let (ok, output) = run(command, cancel, Duration::from_secs(90))?;
            checks.push(check(
                id,
                if ok { "passed" } else { "failed" },
                format!("npm run {key}\n{output}"),
            ));
        }
        if checks.is_empty() && copy.0.join("tsconfig.json").is_file() {
            let compiler = root.join("node_modules/typescript/bin/tsc");
            if compiler.is_file() {
                if let Some(node) = binary("node") {
                    let mut cmd = Command::new(node);
                    cmd.current_dir(&copy.0)
                        .arg(compiler)
                        .args(["--noEmit", "--pretty", "false"]);
                    let (ok, output) = run(cmd, cancel, Duration::from_secs(90))?;
                    checks.push(check(
                        "build",
                        if ok { "passed" } else { "failed" },
                        format!("TypeScript --noEmit\n{output}"),
                    ));
                }
            }
        }
    } else if copy.0.join("Cargo.toml").is_file() {
        if let Some(cargo) = binary("cargo").or_else(|| {
            std::env::var_os("HOME")
                .map(PathBuf::from)
                .map(|p| p.join(".cargo/bin/cargo"))
                .filter(|p| p.is_file())
        }) {
            for (kind, args) in [
                ("build", vec!["check", "--offline"]),
                ("tests", vec!["test", "--offline"]),
            ] {
                let mut cmd = Command::new(&cargo);
                cmd.current_dir(&copy.0).args(args);
                let (ok, output) = run(cmd, cancel, Duration::from_secs(120))?;
                checks.push(check(kind, if ok { "passed" } else { "failed" }, output));
            }
        }
    } else if changes.iter().any(|c| c.path.ends_with(".swift")) {
        let files: Vec<_> = changes
            .iter()
            .filter(|c| c.path.ends_with(".swift"))
            .map(|c| copy.0.join(&c.path))
            .collect();
        let mut cmd = Command::new("/usr/bin/xcrun");
        cmd.arg("swiftc")
            .arg("-typecheck")
            .args(files)
            .current_dir(&copy.0);
        let (ok, output) = run(cmd, cancel, Duration::from_secs(90))?;
        checks.push(check(
            "build",
            if ok { "passed" } else { "failed" },
            format!("Swift typecheck des fichiers proposés (hors projet Xcode)\n{output}"),
        ));
    } else if changes
        .iter()
        .all(|c| c.path.ends_with(".html") || c.path.ends_with(".css") || c.path.ends_with(".md"))
    {
        checks.push(check("structure","passed","Fichiers autonomes : aucune compilation requise; les vérifications syntaxiques/visuelles restent séparées.".into()));
    }
    let remotion_package=copy.0.join("package.json").is_file() && std::fs::read_to_string(copy.0.join("package.json")).ok().and_then(|s|serde_json::from_str::<serde_json::Value>(&s).ok()).is_some_and(|p|p["dependencies"].get("remotion").is_some()||p["devDependencies"].get("remotion").is_some());
    if capture && (remotion_package || options.as_ref().is_some_and(|o|o.get("remotion").is_some())) && !checks.iter().any(|c| c.status=="failed") {
        match render_remotion(&copy.0, options.as_ref().and_then(|o|o.get("remotion")), export_destination.as_deref(), cancel) {
            Ok(report) => {
                let mut measured=check("visual","passed",format!("Remotion : {} images clés réellement rendues.{}", report["frames"].as_array().map_or(0,|f|f.len()), report.get("export").map_or(String::new(),|e|format!(" MP4 exporté : {} ({} octets).",e["path"],e["bytes"]))));
                measured.render_report=Some(report);checks.push(measured);
            },
            Err(error)=>checks.push(check("temporal","unavailable",format!("Rendu Remotion non effectué : {error}"))),
        }
    } else if capture
        && !checks.iter().any(|c| c.status == "failed")
        && (copy.0.join("dist/index.html").is_file() || copy.0.join("index.html").is_file())
    {
        let times = if temporal {
            vec![0, 80, 160, 280, 420, 650, 1000]
        } else {
            vec![0]
        };
        let preview = if copy.0.join("dist/index.html").is_file() {
            copy.0.join("dist")
        } else {
            copy.0.clone()
        };
        match render_dist_with_options(&preview, times.clone(), reference.clone(), cancel, options.clone()) {
            Ok(mut report) => {
                if temporal && report["motionClock"]=="gsap" && options.as_ref().and_then(|o|o.get("reducedMotion")).and_then(|v|v.as_bool())!=Some(true) {
                    let mut reduced=options.clone().unwrap_or_else(||serde_json::json!({}));reduced["reducedMotion"]=serde_json::json!(true);
                    match render_dist_with_options(&preview,times,reference,cancel,Some(reduced)) {
                        Ok(observed)=>{report["reducedReport"]=observed;},
                        Err(error)=>checks.push(check("temporal","unavailable",format!("Capture GSAP mouvement réduit indisponible : {error}"))),
                    }
                }
                let frames = report["frames"].as_array().map(|a| a.len()).unwrap_or(0);
                let errors = report["errors"].as_array().map(|a| a.len()).unwrap_or(1);
                let overflow = report["frames"]
                    .as_array()
                    .map(|a| {
                        a.iter()
                            .any(|f| f["overflow"].as_f64().unwrap_or(0.0) > 2.0)
                    })
                    .unwrap_or(true);
                checks.push(check("visual",if frames>0&&errors==0&&!overflow{"passed"}else{"failed"},format!("Aperçu Vite/React réellement capturé par WebKit : {frames} image(s), {errors} erreur(s), débordement : {overflow}.")));
                if let Some(check) = checks.last_mut() {
                    check.render_report = Some(report.clone());
                }
                if temporal {
                    let changed = report["frames"].as_array().is_some_and(|a| measured_motion(a));
                    checks.push(check("temporal",if frames>=5&&changed{"passed"}else{"failed"},format!("{frames} instants capturés sur CSS/Web Animations/GSAP exposé; mouvement géométrique ou visuel mesuré : {changed}. Les horloges JavaScript arbitraires ne sont pas virtualisées.")));
                    if let Some(reduced)=report.get("reducedReport") {
                        let samples=reduced["frames"].as_array();
                        let static_motion=samples.is_some_and(|a|a.len()>=2&&a.iter().all(|f|f["reducedMotion"]==true)&&!measured_motion(a));
                        checks.push(check("temporal",if static_motion{"passed"}else{"failed"},"GSAP prefers-reduced-motion : stabilité des états DOM capturés séparément.".into()));
                    }
                }
            }
            Err(error) => checks.push(check("visual", "unavailable", error)),
        }
    }
    if checks.is_empty() {
        checks.push(check(
            "build",
            "unavailable",
            "Aucun vérificateur de compilation compatible disponible pour ce projet.".into(),
        ));
    }
    Ok(checks)
}

fn render_remotion(root:&Path, options:Option<&serde_json::Value>, export_destination:Option<&Path>, cancel:&AtomicBool) -> Result<serde_json::Value,String> {
    let node=binary("node").ok_or("Node.js local absent")?;
    let scratch=Scratch::new()?;
    let source=scratch.0.join("remotion.mjs");
    let input=scratch.0.join("input.json");
    std::fs::write(&source,include_str!("cortex-remotion.mjs")).map_err(|e|e.to_string())?;
    let entries=["src/index.ts","src/index.tsx","src/remotion/index.ts","src/remotion/index.tsx"].into_iter().filter(|p|root.join(p).is_file()).collect::<Vec<_>>();
    let mut request=serde_json::json!({"root":root,"outputDir":scratch.0,"authorized":true,"projectFiles":entries,"exportVideo":export_destination.is_some(),"exportAuthorized":export_destination.is_some()});
    if let Some(options)=options { for key in ["entryPoint","compositionId","frames"] { if let Some(value)=options.get(key) { request[key]=value.clone(); } } }
    std::fs::write(&input,serde_json::to_vec(&request).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let mut command=Command::new(node);command.arg(source).arg(input).current_dir(root).env("CI","1");
    let (ok,output)=run(command,cancel,Duration::from_secs(if export_destination.is_some(){180}else{120}))?;
    if !ok {return Err(output);}
    let bytes=std::fs::read(scratch.0.join("remotion-report.json")).map_err(|e|e.to_string())?;
    if bytes.len()>16_000_000 {return Err("Rapport Remotion trop volumineux".into());}
    let mut report:serde_json::Value=serde_json::from_slice(&bytes).map_err(|e|e.to_string())?;
    if report["supported"]!=true || report["frames"].as_array().is_none_or(|f|f.is_empty()||f.len()>12) {return Err("Rapport de rendu incomplet".into());}
    if let Some(destination)=export_destination {
        if cancel.load(Ordering::Relaxed) {return Err("Annulé".into());}
        let video=scratch.0.join("video.mp4");
        if std::fs::metadata(&video).map_err(|e|e.to_string())?.len()==0 {return Err("Export vidéo vide".into());}
        std::fs::copy(video,destination).map_err(|e|e.to_string())?;
        report["export"]["path"]=serde_json::json!(destination);
    }
    Ok(report)
}

fn render_in_helper(
    input: serde_json::Value,
    cancel: &AtomicBool,
) -> Result<serde_json::Value, String> {
    let scratch = Scratch::new()?;
    let source = scratch.0.join("render.swift");
    let input_path = scratch.0.join("input.json");
    std::fs::write(&source, include_str!("cortex-render.swift")).map_err(|e| e.to_string())?;
    std::fs::write(
        &input_path,
        serde_json::to_vec(&input).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    let mut cmd = Command::new("/usr/bin/swift");
    cmd.arg(source).arg(input_path).current_dir(&scratch.0);
    let (ok, output) = run(cmd, cancel, Duration::from_secs(90))?;
    if !ok {
        return Err(format!("Capture WebKit indisponible : {output}"));
    }
    let report =
        std::fs::read_to_string(scratch.0.join("report.json")).map_err(|e| e.to_string())?;
    serde_json::from_str(&report).map_err(|e| e.to_string())
}
#[cfg(test)]
fn render_dist(
    dist: &Path,
    times: Vec<u64>,
    reference: Option<String>,
    cancel: &AtomicBool,
) -> Result<serde_json::Value, String> {
    render_dist_with_options(dist, times, reference, cancel, None)
}
fn render_dist_with_options(
    dist: &Path,
    times: Vec<u64>,
    reference: Option<String>,
    cancel: &AtomicBool,
    options: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let root = dist.canonicalize().map_err(|e| e.to_string())?;
    let stop = Arc::new(AtomicBool::new(false));
    let done = stop.clone();
    let server = std::thread::spawn(move || {
        while !done.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(1)));
                    let _ = stream.set_write_timeout(Some(Duration::from_secs(1)));
                    let mut request = [0; 8192];
                    let n = stream.read(&mut request).unwrap_or(0);
                    let text = String::from_utf8_lossy(&request[..n]);
                    let route = text
                        .lines()
                        .next()
                        .and_then(|s| s.split_whitespace().nth(1))
                        .unwrap_or("/")
                        .split('?')
                        .next()
                        .unwrap_or("/");
                    let relative = if route == "/" {
                        "index.html"
                    } else {
                        route.trim_start_matches('/')
                    };
                    if !safe_relative(relative) {
                        let _ = stream
                            .write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
                        continue;
                    }
                    let path = root.join(relative).canonicalize().ok();
                    let data = path
                        .as_ref()
                        .filter(|p| p.starts_with(&root))
                        .and_then(|p| std::fs::read(p).ok())
                        .filter(|d| d.len() < 10_000_000);
                    if let Some(data) = data {
                        let mime = match relative.rsplit('.').next().unwrap_or("") {
                            "js" => "text/javascript",
                            "css" => "text/css",
                            "html" => "text/html",
                            "svg" => "image/svg+xml",
                            "png" => "image/png",
                            "woff2" => "font/woff2",
                            _ => "application/octet-stream",
                        };
                        let headers=format!("HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nContent-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'\r\nConnection: close\r\n\r\n",data.len());
                        let _ = stream.write_all(headers.as_bytes());
                        let _ = stream.write_all(&data);
                    } else {
                        let _ = stream
                            .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                    }
                }
                Err(_) => std::thread::sleep(Duration::from_millis(10)),
            }
        }
    });
    let result = render_in_helper(
        serde_json::json!({"html":"","url":format!("http://127.0.0.1:{port}/"),"times":options.as_ref().and_then(|o|o.get("timeline")).unwrap_or(&serde_json::json!(times)),"reference":reference,"viewport":options.as_ref().and_then(|o|o.get("viewport")),"interactions":options.as_ref().and_then(|o|o.get("interactions")),"reducedMotion":options.as_ref().and_then(|o|o.get("reducedMotion")),"expectations":options.as_ref().and_then(|o|o.get("expectations")),"transitionCapture":options.as_ref().and_then(|o|o.get("transitionCapture")),"selectors":options.as_ref().and_then(|o|o.get("selectors")),"motionClock":options.as_ref().and_then(|o|o.get("motionClock"))}),
        cancel,
    );
    stop.store(true, Ordering::Relaxed);
    let _ = server.join();
    result
}

#[tauri::command]
pub async fn cortex_render(
    state: tauri::State<'_, CortexState>,
    html: String,
    times: Vec<u64>,
    request_id: String,
    reference: Option<String>,
    options: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    validate_inspection(&options)?;
    if html.len() > 500_000
        || times.is_empty()
        || times.len() > 12
        || times.iter().any(|t| *t > 10000)
        || reference.as_ref().is_some_and(|s| s.len() > 8_000_000)
    {
        return Err("Rendu hors limites.".into());
    }
    let cancel = registration(&state, &request_id)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        render_in_helper(
            serde_json::json!({"html":html,"times":times,"reference":reference,"viewport":options.as_ref().and_then(|o|o.get("viewport")),"interactions":options.as_ref().and_then(|o|o.get("interactions")),"reducedMotion":options.as_ref().and_then(|o|o.get("reducedMotion")),"expectations":options.as_ref().and_then(|o|o.get("expectations")),"transitionCapture":options.as_ref().and_then(|o|o.get("transitionCapture")),"selectors":options.as_ref().and_then(|o|o.get("selectors")),"motionClock":options.as_ref().and_then(|o|o.get("motionClock")),"referenceOnly":options.as_ref().and_then(|o|o.get("referenceOnly"))}),
            &cancel,
        )
    })
    .await
    .map_err(|e| e.to_string())?;
    state
        .active
        .lock()
        .map_err(|e| e.to_string())?
        .remove(&request_id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn motion_uses_measured_properties_not_text_or_full_dom_equality() {
        let frame=|x:f64,text:&str|serde_json::json!({"elements":[{"selector":"#box","x":x,"y":0,"width":40,"height":40,"opacity":1,"transform":"none","filter":"none","visible":true,"text":text}]});
        assert!(!measured_motion(&[frame(0.0,"before"),frame(0.0,"after")]));
        assert!(measured_motion(&[frame(0.0,"same"),frame(20.0,"same"),frame(0.0,"same")]));
        assert!(!measured_motion(&[frame(0.0,"same"),frame(0.5,"same")]));
    }
    #[test]
    fn inspection_discriminates_click_and_fill() {
        let click = Some(serde_json::json!({"interactions":[{"type":"click","selector":"#trigger"}]}));
        let fill = Some(serde_json::json!({"interactions":[{"type":"fill","selector":"#field","value":"text"}]}));
        assert!(validate_inspection(&click).is_ok());
        assert!(validate_inspection(&fill).is_ok());
        for invalid in [
            serde_json::json!({"interactions":[{"type":"click","selector":"#trigger","value":"bad"}]}),
            serde_json::json!({"interactions":[{"type":"fill","selector":"#field"}]}),
            serde_json::json!({"interactions":[{"type":"click","selector":""}]}),
            serde_json::json!({"interactions":[{"type":"click","selector":"#trigger","command":"forbidden"}]}),
        ] { assert!(validate_inspection(&Some(invalid)).is_err()); }
    }
    #[test]
    fn real_sourcekit_navigation_on_copy() {
        if !Path::new("/usr/bin/sourcekit-lsp").is_file() {
            return;
        }
        let root = Scratch::new().unwrap();
        let text = "func twice(_ value: Int) -> Int { return value * 2 }";
        let path = root.0.join("Value.swift");
        std::fs::write(&path, text).unwrap();
        let symbols = lsp_symbols(&path, text, &AtomicBool::new(false)).unwrap();
        assert!(symbols.to_string().contains("twice"));
    }
    #[test]
    fn snapshot_isolated_and_conflict_checked() {
        let root = Scratch::new().unwrap();
        std::fs::write(root.0.join("a.ts"), "before").unwrap();
        let copy = Scratch::new().unwrap();
        copy_sources(
            &root.0,
            &root.0,
            &copy.0,
            &mut 0,
            &mut 0,
            &AtomicBool::new(false),
        )
        .unwrap();
        let c = Change {
            path: "a.ts".into(),
            before: "before".into(),
            after: "after".into(),
            created: false,
        };
        patch_snapshot(&root.0, &copy.0, &[c]).unwrap();
        assert_eq!(
            std::fs::read_to_string(root.0.join("a.ts")).unwrap(),
            "before"
        );
        assert_eq!(
            std::fs::read_to_string(copy.0.join("a.ts")).unwrap(),
            "after"
        );
        assert!(!safe_relative("../secret"));
        assert!(!safe_relative(".env"));
    }
    #[test]
    fn execution_can_be_cancelled() {
        let flag = AtomicBool::new(true);
        let mut cmd = Command::new("/bin/sleep");
        cmd.arg("10");
        let before = Instant::now();
        assert!(run(cmd, &flag, Duration::from_secs(20)).is_err());
        assert!(before.elapsed() < Duration::from_secs(2));
    }
    #[test]
    fn real_build_test_repair_on_copy() {
        let root = Scratch::new().unwrap();
        std::fs::create_dir(root.0.join("src")).unwrap();
        std::fs::create_dir(root.0.join("tests")).unwrap();
        std::fs::write(root.0.join("package.json"),r#"{"scripts":{"build":"node --check src/value.cjs","test":"node --test tests/value.test.cjs"}}"#).unwrap();
        std::fs::write(root.0.join("src/value.cjs"), "module.exports = 0;").unwrap();
        std::fs::write(
            root.0.join("tests/value.test.cjs"),
            "require('node:assert/strict').equal(require('../src/value.cjs'),1);",
        )
        .unwrap();
        let bad = Change {
            path: "src/value.cjs".into(),
            before: "module.exports = 0;".into(),
            after: "module.exports = ;".into(),
            created: false,
        };
        let failed =
            check_project(&root.0, &[bad], &AtomicBool::new(false), false, false, None).unwrap();
        assert!(failed.iter().any(|c| !c.success));
        let good = Change {
            path: "src/value.cjs".into(),
            before: "module.exports = 0;".into(),
            after: "module.exports = 1;".into(),
            created: false,
        };
        let passed = check_project(
            &root.0,
            &[good],
            &AtomicBool::new(false),
            false,
            false,
            None,
        )
        .unwrap();
        assert!(passed.iter().all(|c| c.success));
        assert!(passed.iter().any(|c| c.r#type == "tests"));
        assert_eq!(
            std::fs::read_to_string(root.0.join("src/value.cjs")).unwrap(),
            "module.exports = 0;"
        );
    }
    #[test]
    fn real_bundled_preview() {
        let root = Scratch::new().unwrap();
        std::fs::write(root.0.join("index.html"),"<!doctype html><html><body style='margin:0'><main><h1>Fixture</h1><button>Button</button></main></body></html>").unwrap();
        let report = render_dist(&root.0, vec![0], None, &AtomicBool::new(false)).unwrap();
        assert_eq!(report["frames"].as_array().unwrap().len(), 1);
        assert!(report["errors"].as_array().unwrap().is_empty());
    }
    #[test]
    fn refuses_model_changed_execution_scripts() {
        let root = Scratch::new().unwrap();
        let before = r#"{"scripts":{"build":"node --version"}}"#;
        std::fs::write(root.0.join("package.json"), before).unwrap();
        let change = Change {
            path: "package.json".into(),
            before: before.into(),
            after: r#"{"scripts":{"build":"node -e 'process.exit(99)'"}}"#.into(),
            created: false,
        };
        let result = check_project(
            &root.0,
            &[change],
            &AtomicBool::new(false),
            false,
            false,
            None,
        )
        .unwrap();
        assert_eq!(result[0].status, "unavailable");
        assert!(result[0].output.contains("aucun script"));
    }
}
