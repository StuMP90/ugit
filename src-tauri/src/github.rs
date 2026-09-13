use serde::{Deserialize, Serialize};

// Public by design: GitHub's Device Flow is for clients that can't keep a
// secret (CLIs, desktop apps) — there is no client secret to protect.
// Replace with your own OAuth App's Client ID (Settings > Developer settings
// > OAuth Apps > your app > enable "Device Flow").
const GITHUB_CLIENT_ID: &str = "Ov23liBRt1SEafkCSGwH";

const KEYRING_SERVICE: &str = "ugit";
const KEYRING_USERNAME: &str = "github";

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USERNAME).map_err(|e| e.to_string())
}

fn load_token() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn store_token(token: &str) -> Result<(), String> {
    keyring_entry()?.set_password(token).map_err(|e| e.to_string())
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().user_agent("uGit").build()
}

#[derive(Serialize, Clone)]
pub struct DeviceCodeInfo {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
    interval: u32,
}

#[tauri::command]
pub fn github_start_device_flow() -> Result<DeviceCodeInfo, String> {
    let resp: DeviceCodeResponse = agent()
        .post("https://github.com/login/device/code")
        .set("Accept", "application/json")
        .send_form(&[("client_id", GITHUB_CLIENT_ID), ("scope", "repo")])
        .map_err(|e| e.to_string())?
        .into_json()
        .map_err(|e| e.to_string())?;

    Ok(DeviceCodeInfo {
        device_code: resp.device_code,
        user_code: resp.user_code,
        verification_uri: resp.verification_uri,
        expires_in: resp.expires_in,
        interval: resp.interval,
    })
}

#[derive(Serialize)]
pub struct DevicePollResult {
    pub status: String, // "pending" | "success" | "denied" | "expired" | "slow_down" | "error"
    pub message: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    error: Option<String>,
}

#[tauri::command]
pub fn github_poll_device_flow(device_code: String) -> Result<DevicePollResult, String> {
    let resp = agent()
        .post("https://github.com/login/oauth/access_token")
        .set("Accept", "application/json")
        .send_form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("device_code", &device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .map_err(|e| e.to_string())?;

    let body: TokenResponse = resp.into_json().map_err(|e| e.to_string())?;

    if let Some(token) = body.access_token {
        store_token(&token)?;
        return Ok(DevicePollResult { status: "success".to_string(), message: None });
    }

    let status = match body.error.as_deref() {
        Some("authorization_pending") => "pending",
        Some("slow_down") => "slow_down",
        Some("expired_token") => "expired",
        Some("access_denied") => "denied",
        _ => "error",
    };

    Ok(DevicePollResult {
        status: status.to_string(),
        message: body.error,
    })
}

#[tauri::command]
pub fn github_is_signed_in() -> Result<bool, String> {
    Ok(load_token()?.is_some())
}

#[tauri::command]
pub fn github_sign_out() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Deserialize)]
struct GithubUser {
    login: String,
}

#[tauri::command]
pub fn github_get_username() -> Result<String, String> {
    let token = load_token()?.ok_or("Not signed in to GitHub")?;
    let user: GithubUser = agent()
        .get("https://api.github.com/user")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| e.to_string())?
        .into_json()
        .map_err(|e| e.to_string())?;
    Ok(user.login)
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GithubRepo {
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub description: Option<String>,
    pub clone_url: String,
    pub ssh_url: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn github_list_repos() -> Result<Vec<GithubRepo>, String> {
    let token = load_token()?.ok_or("Not signed in to GitHub")?;
    let repos: Vec<GithubRepo> = agent()
        .get("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| e.to_string())?
        .into_json()
        .map_err(|e| e.to_string())?;
    Ok(repos)
}

#[tauri::command]
pub fn github_create_repo(
    name: String,
    private: bool,
    description: Option<String>,
) -> Result<GithubRepo, String> {
    let token = load_token()?.ok_or("Not signed in to GitHub")?;
    let body = serde_json::json!({
        "name": name,
        "private": private,
        "description": description.unwrap_or_default(),
    });
    let repo: GithubRepo = agent()
        .post("https://api.github.com/user/repos")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/vnd.github+json")
        .send_json(body)
        .map_err(|e| e.to_string())?
        .into_json()
        .map_err(|e| e.to_string())?;
    Ok(repo)
}

/// Credentials for a github.com HTTPS remote, using the stored device-flow
/// token. Returns None if not signed in or the URL isn't a github.com HTTPS
/// remote, so callers can fall back to the normal ssh-agent/key/helper chain.
pub fn github_https_credentials(url: &str) -> Option<git2::Cred> {
    if !(url.starts_with("https://github.com/") || url.starts_with("https://www.github.com/")) {
        return None;
    }
    let token = load_token().ok().flatten()?;
    git2::Cred::userpass_plaintext(&token, "x-oauth-basic").ok()
}
