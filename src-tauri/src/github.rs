use serde::{Deserialize, Serialize};

// Public by design: GitHub's Device Flow is for clients that can't keep a
// secret (CLIs, desktop apps) — there is no client secret to protect.
// Replace with your own OAuth App's Client ID (Settings > Developer settings
// > OAuth Apps > your app > enable "Device Flow").
const GITHUB_CLIENT_ID: &str = "Ov23liBRt1SEafkCSGwH";

const KEYRING_SERVICE: &str = "ugit";
const KEYRING_USERNAME: &str = "github";
const KEYRING_REFRESH_USERNAME: &str = "github-refresh";

/// Sentinel error string: signals "this operation would have a real recovery
/// path (the HTTPS-with-token fallback) if the user were signed in to
/// GitHub, but isn't" — distinct from an ordinary failure, so the frontend
/// can offer the sign-in flow directly instead of just showing a dead-end
/// error banner.
pub const NEEDS_GITHUB_AUTH: &str = "NEEDS_GITHUB_AUTH";

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USERNAME).map_err(|e| e.to_string())
}

fn refresh_keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_REFRESH_USERNAME).map_err(|e| e.to_string())
}

/// If GitHub issued a refresh token alongside the access token (only
/// happens when this OAuth App has expiring user tokens enabled — either
/// via its own settings or an organization's policy), it's stored here
/// together with both tokens' expiry times so we know when to use it.
#[derive(Serialize, Deserialize)]
struct StoredRefresh {
    refresh_token: String,
    access_expires_at: Option<u64>,
    refresh_expires_at: Option<u64>,
}

fn now_unix() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn load_token() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn load_refresh() -> Option<StoredRefresh> {
    let raw = refresh_keyring_entry().ok()?.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

fn store_refresh(stored: &StoredRefresh) -> Result<(), String> {
    let raw = serde_json::to_string(stored).map_err(|e| e.to_string())?;
    refresh_keyring_entry()?.set_password(&raw).map_err(|e| e.to_string())
}

fn clear_refresh() {
    if let Ok(entry) = refresh_keyring_entry() {
        let _ = entry.delete_credential();
    }
}

/// Store a freshly obtained (or refreshed) access token, plus its refresh
/// token and expiry info if GitHub provided any. Apps without expiring
/// tokens enabled never send these, in which case any previously stored
/// refresh info is cleared and the access token is treated as non-expiring,
/// same as before this was added.
fn store_tokens(
    access_token: &str,
    refresh_token: Option<&str>,
    expires_in: Option<u32>,
    refresh_token_expires_in: Option<u32>,
) -> Result<(), String> {
    keyring_entry()?.set_password(access_token).map_err(|e| e.to_string())?;
    match refresh_token {
        Some(rt) => {
            let now = now_unix();
            store_refresh(&StoredRefresh {
                refresh_token: rt.to_string(),
                access_expires_at: expires_in.map(|s| now + s as u64),
                refresh_expires_at: refresh_token_expires_in.map(|s| now + s as u64),
            })?;
        }
        None => clear_refresh(),
    }
    Ok(())
}

fn clear_all_tokens() {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
    clear_refresh();
}

#[derive(Deserialize)]
struct RefreshResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u32>,
    refresh_token_expires_in: Option<u32>,
}

/// Exchange a stored refresh token for a new access token. Returns
/// `Ok(None)` (never an error) whenever refreshing isn't possible or
/// doesn't succeed — no refresh token stored, the refresh token itself has
/// expired, or GitHub rejects the request (for example if this OAuth App's
/// refresh flow turns out to require a client secret, which uGit
/// deliberately never embeds in the distributed binary — see the
/// GITHUB_CLIENT_ID comment above). Any of those cases just clears the
/// stale tokens so the caller falls back to a normal Device Flow sign-in,
/// same as if refresh support didn't exist at all.
fn try_refresh_access_token() -> Option<String> {
    let stored = load_refresh()?;
    if let Some(exp) = stored.refresh_expires_at {
        if now_unix() >= exp {
            clear_all_tokens();
            return None;
        }
    }

    let resp = agent()
        .post("https://github.com/login/oauth/access_token")
        .set("Accept", "application/json")
        .send_form(&[
            ("client_id", GITHUB_CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", &stored.refresh_token),
        ])
        .ok()?;
    let body: RefreshResponse = resp.into_json().ok()?;

    match body.access_token {
        Some(new_token) => {
            let new_refresh = body.refresh_token.as_deref().unwrap_or(&stored.refresh_token);
            store_tokens(&new_token, Some(new_refresh), body.expires_in, body.refresh_token_expires_in).ok()?;
            Some(new_token)
        }
        None => {
            clear_all_tokens();
            None
        }
    }
}

/// The access token to actually use for an API call: the stored one, or —
/// if it's expired (or about to be) and a refresh token is on hand — a
/// freshly refreshed one. Returns `Ok(None)` if there's nothing usable and
/// the user needs to sign in again.
fn valid_access_token() -> Result<Option<String>, String> {
    let Some(token) = load_token()? else { return Ok(None) };
    if let Some(stored) = load_refresh() {
        if let Some(exp) = stored.access_expires_at {
            // Refresh a little early rather than racing the actual expiry.
            if now_unix() + 30 >= exp {
                return Ok(try_refresh_access_token());
            }
        }
    }
    Ok(Some(token))
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new().user_agent("uGit").build()
}

/// Maps a ureq error to a plain string, except a 401 — which means the
/// access token we sent was rejected outright (expired with no usable
/// refresh token, revoked, etc.) — which instead clears the now-known-bad
/// stored token and returns the NEEDS_GITHUB_AUTH sentinel, so the frontend
/// offers sign-in again instead of a dead-end "status code 401".
fn map_api_error(e: ureq::Error) -> String {
    match e {
        ureq::Error::Status(401, _) => {
            clear_all_tokens();
            NEEDS_GITHUB_AUTH.to_string()
        }
        other => other.to_string(),
    }
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
    refresh_token: Option<String>,
    expires_in: Option<u32>,
    refresh_token_expires_in: Option<u32>,
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
        store_tokens(
            &token,
            body.refresh_token.as_deref(),
            body.expires_in,
            body.refresh_token_expires_in,
        )?;
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
    let result = match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    };
    clear_refresh();
    result
}

#[derive(Deserialize)]
struct GithubUser {
    login: String,
}

#[tauri::command]
pub fn github_get_username() -> Result<String, String> {
    let token = valid_access_token()?.ok_or(NEEDS_GITHUB_AUTH)?;
    let user: GithubUser = agent()
        .get("https://api.github.com/user")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(map_api_error)?
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
    let token = valid_access_token()?.ok_or(NEEDS_GITHUB_AUTH)?;
    let repos: Vec<GithubRepo> = agent()
        .get("https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(map_api_error)?
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
    let token = valid_access_token()?.ok_or(NEEDS_GITHUB_AUTH)?;
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
        .map_err(map_api_error)?
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
    let token = valid_access_token().ok().flatten()?;
    git2::Cred::userpass_plaintext(&token, "x-oauth-basic").ok()
}

/// Whether a GitHub token is currently stored, without making any network or
/// git calls — used to decide up front whether an HTTPS fallback is even
/// worth attempting. Deliberately checks only for *presence*, not validity
/// (that would require a network round-trip); an expired-with-no-refresh
/// token still counts as "stored" here; the actual fallback attempt that
/// follows will surface NEEDS_GITHUB_AUTH if it turns out to be unusable.
pub fn has_stored_token() -> bool {
    load_token().ok().flatten().is_some()
}

/// If `url` is a github.com SSH remote (either form git normally produces —
/// the `git@github.com:owner/repo.git` scp-like syntax, or `ssh://`), return
/// the equivalent HTTPS URL. Used to retry over HTTPS (with the signed-in
/// token) when SSH auth fails, without ever touching the repo's configured
/// remote — so other tools (e.g. GitKraken) that rely on the SSH remote
/// staying exactly as they set it up are unaffected.
pub fn github_ssh_to_https(url: &str) -> Option<String> {
    let rest = url
        .strip_prefix("git@github.com:")
        .or_else(|| url.strip_prefix("ssh://git@github.com/"))?;
    let rest = rest.trim_end_matches('/');
    if rest.is_empty() {
        return None;
    }
    Some(format!("https://github.com/{rest}"))
}
