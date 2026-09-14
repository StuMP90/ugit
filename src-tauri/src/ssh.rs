use serde::Serialize;
use ssh_key::rand_core::OsRng;
use ssh_key::{Algorithm, LineEnding, PrivateKey};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Filenames git.rs's own SSH auth chain searches for in `~/.ssh`, in the
/// order it tries them — kept here as the single source of truth so the UI
/// can show what's already auto-detected without duplicating this list.
pub const DEFAULT_KEY_NAMES: [&str; 3] = ["id_ed25519", "id_rsa", "id_ecdsa"];

/// Filename used for a key uGit generates itself — deliberately distinct
/// from the default names above so generating a key can never silently
/// overwrite an existing one of yours.
const GENERATED_KEY_NAME: &str = "id_ed25519_ugit";

const SETTINGS_FILE: &str = "ssh_key_override.txt";

pub fn home_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    PathBuf::from(home)
}

pub fn ssh_dir() -> PathBuf {
    home_dir().join(".ssh")
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(SETTINGS_FILE))
}

/// The user's explicitly configured override key path, if any. Tried first
/// by git.rs's credentials callback, before the fixed `~/.ssh` default-name
/// search — an explicit choice should win over a guess.
pub fn load_custom_key_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let path = settings_path(app).ok()?;
    let raw = fs::read_to_string(path).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

fn save_custom_key_path(app: &tauri::AppHandle, key_path: &str) -> Result<(), String> {
    let path = settings_path(app)?;
    fs::write(path, key_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ssh_set_custom_key(app: tauri::AppHandle, path: String) -> Result<(), String> {
    if !PathBuf::from(&path).exists() {
        return Err(format!("{path} doesn't exist"));
    }
    save_custom_key_path(&app, &path)
}

#[tauri::command]
pub fn ssh_clear_custom_key(app: tauri::AppHandle) -> Result<(), String> {
    save_custom_key_path(&app, "")
}

#[derive(Serialize)]
pub struct DetectedKey {
    pub name: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Serialize)]
pub struct SshStatus {
    pub default_keys: Vec<DetectedKey>,
    pub custom_key_path: Option<String>,
    pub custom_key_exists: bool,
    /// `~/.ssh` — a dot-folder, so GTK/native file pickers hide it from
    /// their default view. Handed to the frontend as the browse dialog's
    /// starting folder so "Use existing key…" opens straight into it
    /// instead of making the user hunt for a hidden folder themselves.
    pub ssh_dir: String,
}

#[tauri::command]
pub fn ssh_status(app: tauri::AppHandle) -> Result<SshStatus, String> {
    let dir = ssh_dir();
    let default_keys = DEFAULT_KEY_NAMES
        .iter()
        .map(|name| {
            let path = dir.join(name);
            DetectedKey {
                name: name.to_string(),
                exists: path.exists(),
                path: path.to_string_lossy().to_string(),
            }
        })
        .collect();
    let custom_key_path = load_custom_key_path(&app);
    let custom_key_exists = custom_key_path.as_ref().map(|p| p.exists()).unwrap_or(false);
    Ok(SshStatus {
        default_keys,
        custom_key_path: custom_key_path.map(|p| p.to_string_lossy().to_string()),
        custom_key_exists,
        ssh_dir: dir.to_string_lossy().to_string(),
    })
}

#[derive(Serialize)]
pub struct GeneratedKey {
    pub private_key_path: String,
    /// The full "ssh-ed25519 AAAA... comment" line, ready to paste into
    /// GitHub's "Add new SSH key" form.
    pub public_key: String,
}

/// Restricts a private key file's NTFS ACL to just the current user,
/// mirroring `chmod 600` for Windows' OpenSSH client (which checks ACLs,
/// not permission bits, and rejects a key anyone else can read).
#[cfg(windows)]
fn restrict_windows_key_permissions(path: &std::path::Path) -> Result<(), String> {
    let user = std::env::var("USERNAME").map_err(|_| "USERNAME environment variable not set".to_string())?;
    let path_str = path.to_string_lossy();

    // Drop inherited ACEs from the containing folder first — otherwise the
    // /grant below only adds to an already-too-open ACL instead of
    // replacing it.
    let inherit = Command::new("icacls")
        .args([path_str.as_ref(), "/inheritance:r"])
        .output()
        .map_err(|e| format!("Couldn't run icacls to secure the new key ({e})"))?;
    if !inherit.status.success() {
        return Err(format!(
            "icacls /inheritance:r failed: {}",
            String::from_utf8_lossy(&inherit.stderr)
        ));
    }

    let grant = Command::new("icacls")
        .args([path_str.as_ref(), "/grant:r", &format!("{user}:(R)")])
        .output()
        .map_err(|e| format!("Couldn't run icacls to secure the new key ({e})"))?;
    if !grant.status.success() {
        return Err(format!(
            "icacls /grant failed: {}",
            String::from_utf8_lossy(&grant.stderr)
        ));
    }
    Ok(())
}

/// Generates a new Ed25519 keypair (pure Rust — no dependency on an
/// external `ssh-keygen` binary, which isn't guaranteed to be on PATH,
/// especially on Windows), saves it under a name that can never collide
/// with an existing key, and registers it as the active override so it's
/// used immediately. Refuses to run if that filename is already taken,
/// rather than risk clobbering a previously generated key.
#[tauri::command]
pub fn ssh_generate_key(app: tauri::AppHandle) -> Result<GeneratedKey, String> {
    let dir = ssh_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let priv_path = dir.join(GENERATED_KEY_NAME);
    let pub_path = dir.join(format!("{GENERATED_KEY_NAME}.pub"));
    if priv_path.exists() || pub_path.exists() {
        return Err(format!(
            "{} already exists — remove it first (or use \"Use existing key…\" to point uGit at it) if you want to generate a new one",
            priv_path.display()
        ));
    }

    let mut key =
        PrivateKey::random(&mut OsRng, Algorithm::Ed25519).map_err(|e| e.to_string())?;
    let comment = "ugit";
    key.set_comment(comment);

    let private_pem = key.to_openssh(LineEnding::LF).map_err(|e| e.to_string())?;
    fs::write(&priv_path, private_pem.as_bytes()).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&priv_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    #[cfg(windows)]
    {
        // Windows' OpenSSH client checks the file's NTFS ACL, not Unix-style
        // permission bits — it refuses to use a private key that's
        // accessible to anyone but the owner ("Permissions ... are too
        // open. This private key will be ignored."). A freshly written file
        // otherwise just inherits the containing folder's ACL, which is
        // usually too open. Strip inherited entries and grant only the
        // current user access — the same fix Microsoft's own OpenSSH-for-
        // Windows docs recommend (`icacls` is a built-in Windows tool, not
        // an optional feature, so this doesn't add a new dependency risk
        // the way relying on `ssh.exe` itself does).
        restrict_windows_key_permissions(&priv_path)?;
    }

    let mut public_key = key.public_key().clone();
    public_key.set_comment(comment);
    let public_line = public_key.to_openssh().map_err(|e| e.to_string())?;
    fs::write(&pub_path, format!("{public_line}\n")).map_err(|e| e.to_string())?;

    save_custom_key_path(&app, &priv_path.to_string_lossy())?;

    Ok(GeneratedKey {
        private_key_path: priv_path.to_string_lossy().to_string(),
        public_key: public_line,
    })
}

#[derive(Serialize)]
pub struct SshTestResult {
    pub success: bool,
    pub message: String,
    pub tested_key: Option<String>,
}

/// Tests SSH auth against GitHub directly via the system `ssh` binary —
/// deliberately a separate process from anything OAuth/HTTPS-related, so a
/// signed-in GitHub account can never mask a real SSH problem by silently
/// making the "test" succeed some other way. If a custom key is configured,
/// tests that specific file (`-i` + `IdentitiesOnly=yes`, bypassing agent
/// and `~/.ssh/config` so the result reflects exactly the file uGit itself
/// would use); otherwise lets `ssh` resolve normally (agent, config,
/// default identity files), same as running `ssh -T git@github.com`
/// yourself would.
///
/// GitHub's SSH endpoint never grants a real shell, so `ssh` always exits
/// non-zero here even on success — the actual signal is a specific message
/// ("successfully authenticated") in its output, not the exit code.
#[tauri::command]
pub fn ssh_test_connection(app: tauri::AppHandle) -> Result<SshTestResult, String> {
    let custom_key = load_custom_key_path(&app);

    let mut cmd = Command::new("ssh");
    cmd.arg("-T")
        .arg("git@github.com")
        .arg("-o")
        .arg("BatchMode=yes")
        .arg("-o")
        .arg("StrictHostKeyChecking=accept-new")
        .arg("-o")
        .arg("ConnectTimeout=10");
    if let Some(key) = &custom_key {
        cmd.arg("-i").arg(key).arg("-o").arg("IdentitiesOnly=yes");
    }

    let output = cmd.output().map_err(|e| {
        format!("Couldn't run the system \"ssh\" command ({e}). Is an OpenSSH client installed?")
    })?;

    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let success = combined.contains("successfully authenticated");
    let message = combined.trim().to_string();

    Ok(SshTestResult {
        success,
        message: if message.is_empty() {
            "ssh produced no output — check your network connection".to_string()
        } else {
            message
        },
        tested_key: custom_key.map(|p| p.to_string_lossy().to_string()),
    })
}
