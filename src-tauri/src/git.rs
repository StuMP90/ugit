use git2::{BranchType, Cred, CredentialType, DiffOptions, Repository, StatusOptions};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;

fn open_repo(repo_path: &str) -> Result<Repository, String> {
    Repository::open(repo_path).map_err(|e| e.to_string())
}

fn remote_callbacks<'a>() -> git2::RemoteCallbacks<'a> {
    let mut cb = git2::RemoteCallbacks::new();
    // libgit2 calls this callback again each time the previously-offered
    // credential is rejected, so it must remember what it has already tried
    // — otherwise a method that "succeeds" at construction time but always
    // fails authentication (e.g. an ssh-agent with no loaded keys) gets
    // re-offered forever, turning a fast, correct failure into a multi-retry
    // stall that can take the better part of a minute.
    let mut tried_agent = false;
    let mut tried_keys: Vec<PathBuf> = Vec::new();
    let mut tried_https = false;
    cb.credentials(move |url, username_from_url, allowed_types| {
        if allowed_types.contains(CredentialType::SSH_KEY) {
            if let Some(user) = username_from_url {
                if !tried_agent {
                    tried_agent = true;
                    if let Ok(cred) = Cred::ssh_key_from_agent(user) {
                        return Ok(cred);
                    }
                }
                let home = std::env::var("HOME")
                    .or_else(|_| std::env::var("USERPROFILE"))
                    .unwrap_or_default();
                for key in ["id_ed25519", "id_rsa", "id_ecdsa"] {
                    let priv_path = PathBuf::from(&home).join(".ssh").join(key);
                    if priv_path.exists() && !tried_keys.contains(&priv_path) {
                        tried_keys.push(priv_path.clone());
                        if let Ok(cred) = Cred::ssh_key(user, None, &priv_path, None) {
                            return Ok(cred);
                        }
                    }
                }
            }
        }
        if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT)
            || allowed_types.contains(CredentialType::DEFAULT)
        {
            if !tried_https {
                tried_https = true;
                if let Some(cred) = crate::github::github_https_credentials(url) {
                    return Ok(cred);
                }
                if let Ok(cfg) = git2::Config::open_default() {
                    if let Ok(cred) = Cred::credential_helper(&cfg, url, username_from_url) {
                        return Ok(cred);
                    }
                }
            }
        }
        Err(git2::Error::from_str(
            "No valid credentials found (tried ssh-agent, ~/.ssh keys, signed-in GitHub account, and git credential helper)",
        ))
    });
    cb
}

// ---------- Data types ----------

#[derive(Serialize, Clone)]
pub struct RepoSummary {
    pub path: String,
    pub name: String,
}

#[derive(Serialize, Clone)]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub summary: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_ids: Vec<String>,
    pub refs: Vec<String>,
    pub lane: usize,
    pub parent_lanes: Vec<usize>,
}

#[derive(Serialize, Clone)]
pub struct BranchInfo {
    pub name: String,
    pub full_name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub target: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

#[derive(Serialize, Clone)]
pub struct FileStatusEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
}

#[derive(Serialize, Clone)]
pub struct RepoStatus {
    pub staged: Vec<FileStatusEntry>,
    pub unstaged: Vec<FileStatusEntry>,
    pub conflicted: Vec<FileStatusEntry>,
    pub branch: Option<String>,
    pub detached: bool,
}

#[derive(Serialize, Clone)]
pub struct DiffLineInfo {
    pub origin: String,
    pub content: String,
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
}

#[derive(Serialize, Clone)]
pub struct DiffHunkInfo {
    pub header: String,
    pub lines: Vec<DiffLineInfo>,
}

#[derive(Serialize, Clone, Default)]
pub struct FileDiff {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub binary: bool,
    pub additions: u32,
    pub deletions: u32,
    pub hunks: Vec<DiffHunkInfo>,
}

fn delta_status_str(status: git2::Delta) -> &'static str {
    match status {
        git2::Delta::Added => "added",
        git2::Delta::Deleted => "deleted",
        git2::Delta::Renamed => "renamed",
        git2::Delta::Copied => "copied",
        git2::Delta::Typechange => "typechange",
        git2::Delta::Untracked => "untracked",
        git2::Delta::Conflicted => "conflicted",
        _ => "modified",
    }
}

#[derive(Serialize, Clone)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Clone)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub oid: String,
}

#[derive(Serialize, Clone)]
pub struct TagInfo {
    pub name: String,
    pub target: String,
}

// ---------- Helpers ----------

fn diff_to_file_diffs(diff: &git2::Diff) -> Result<Vec<FileDiff>, git2::Error> {
    use std::cell::RefCell;
    let files: RefCell<Vec<FileDiff>> = RefCell::new(Vec::new());

    diff.foreach(
        &mut |delta, _progress| {
            let new_path = delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let old_path = delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string());
            let is_rename = old_path.as_deref() != Some(new_path.as_str());
            files.borrow_mut().push(FileDiff {
                path: new_path,
                old_path: if is_rename { old_path } else { None },
                status: delta_status_str(delta.status()).to_string(),
                binary: delta.flags().contains(git2::DiffFlags::BINARY),
                ..Default::default()
            });
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            let mut files_ref = files.borrow_mut();
            if let Some(f) = files_ref.last_mut() {
                f.hunks.push(DiffHunkInfo {
                    header: String::from_utf8_lossy(hunk.header())
                        .trim_end()
                        .to_string(),
                    lines: vec![],
                });
            }
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let mut files_ref = files.borrow_mut();
            if let Some(f) = files_ref.last_mut() {
                let origin = line.origin();
                match origin {
                    '+' => f.additions += 1,
                    '-' => f.deletions += 1,
                    _ => {}
                }
                if let Some(h) = f.hunks.last_mut() {
                    h.lines.push(DiffLineInfo {
                        origin: origin.to_string(),
                        content: String::from_utf8_lossy(line.content())
                            .trim_end_matches('\n')
                            .to_string(),
                        old_lineno: line.old_lineno(),
                        new_lineno: line.new_lineno(),
                    });
                }
            }
            true
        }),
    )?;

    Ok(files.into_inner())
}

fn compute_graph_lanes(commits: &mut [CommitInfo]) {
    let mut lanes: Vec<Option<String>> = Vec::new();

    for c in commits.iter_mut() {
        let lane = match lanes.iter().position(|l| l.as_deref() == Some(c.id.as_str())) {
            Some(i) => i,
            None => match lanes.iter().position(|l| l.is_none()) {
                Some(i) => i,
                None => {
                    lanes.push(None);
                    lanes.len() - 1
                }
            },
        };

        // Any other lane also waiting for this same commit (a branch that forked
        // from it and is now converging back) is done — free it here too, or it
        // would sit reserved forever and lanes would only ever grow.
        for l in lanes.iter_mut() {
            if l.as_deref() == Some(c.id.as_str()) {
                *l = None;
            }
        }
        let mut parent_lanes = Vec::new();

        for (pi, pid) in c.parent_ids.iter().enumerate() {
            if pi == 0 {
                lanes[lane] = Some(pid.clone());
                parent_lanes.push(lane);
            } else if let Some(i) = lanes.iter().position(|l| l.as_deref() == Some(pid.as_str())) {
                parent_lanes.push(i);
            } else if let Some(i) = lanes.iter().position(|l| l.is_none()) {
                lanes[i] = Some(pid.clone());
                parent_lanes.push(i);
            } else {
                lanes.push(Some(pid.clone()));
                parent_lanes.push(lanes.len() - 1);
            }
        }

        c.lane = lane;
        c.parent_lanes = parent_lanes;
    }
}

fn status_char(status: git2::Status, staged: bool) -> Option<&'static str> {
    if staged {
        if status.is_index_new() {
            Some("added")
        } else if status.is_index_modified() {
            Some("modified")
        } else if status.is_index_deleted() {
            Some("deleted")
        } else if status.is_index_renamed() {
            Some("renamed")
        } else if status.is_index_typechange() {
            Some("typechange")
        } else {
            None
        }
    } else if status.is_wt_new() {
        Some("untracked")
    } else if status.is_wt_modified() {
        Some("modified")
    } else if status.is_wt_deleted() {
        Some("deleted")
    } else if status.is_wt_renamed() {
        Some("renamed")
    } else if status.is_wt_typechange() {
        Some("typechange")
    } else {
        None
    }
}

// ---------- Commands ----------
//
// Every command takes `repo_path` explicitly rather than relying on shared
// app state, so the frontend can have any number of repos open at once
// (each tab just remembers its own path) without the backend needing to
// track which one is "current".

#[tauri::command]
pub fn open_repository(path: String) -> Result<RepoSummary, String> {
    let repo = Repository::discover(&path).map_err(|e| e.to_string())?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory (bare repo?)".to_string())?
        .to_path_buf();
    let name = workdir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| workdir.to_string_lossy().to_string());

    Ok(RepoSummary {
        path: workdir.to_string_lossy().to_string(),
        name,
    })
}

#[tauri::command]
pub fn init_repository(path: String) -> Result<RepoSummary, String> {
    let repo = Repository::init(&path).map_err(|e| e.to_string())?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Repository has no working directory (bare repo?)".to_string())?
        .to_path_buf();
    let name = workdir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| workdir.to_string_lossy().to_string());

    Ok(RepoSummary {
        path: workdir.to_string_lossy().to_string(),
        name,
    })
}

#[tauri::command]
pub fn clone_repository(url: String, into: String) -> Result<RepoSummary, String> {
    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(remote_callbacks());
    let repo = git2::build::RepoBuilder::new()
        .fetch_options(fetch_opts)
        .clone(&url, std::path::Path::new(&into))
        .map_err(|e| e.to_string())?;
    let workdir = repo
        .workdir()
        .ok_or_else(|| "Cloned repository has no working directory (bare repo?)".to_string())?
        .to_path_buf();
    let name = workdir
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| workdir.to_string_lossy().to_string());

    Ok(RepoSummary {
        path: workdir.to_string_lossy().to_string(),
        name,
    })
}

#[tauri::command]
pub fn add_remote(repo_path: String, name: String, url: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    repo.remote(&name, &url).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_status(repo_path: String) -> Result<RepoStatus, String> {
    let repo = open_repo(&repo_path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.to_string())?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut conflicted = Vec::new();

    for entry in statuses.iter() {
        let status = entry.status();
        let path = entry.path().unwrap_or("").to_string();

        if status.is_conflicted() {
            conflicted.push(FileStatusEntry {
                path,
                old_path: None,
                status: "conflicted".to_string(),
            });
            continue;
        }

        if let Some(s) = status_char(status, true) {
            let old_path = entry
                .head_to_index()
                .and_then(|d| d.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .filter(|p| p != &path);
            staged.push(FileStatusEntry {
                path: path.clone(),
                old_path,
                status: s.to_string(),
            });
        }
        if let Some(s) = status_char(status, false) {
            let old_path = entry
                .index_to_workdir()
                .and_then(|d| d.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .filter(|p| p != &path);
            unstaged.push(FileStatusEntry {
                path,
                old_path,
                status: s.to_string(),
            });
        }
    }

    let head = repo.head().ok();
    let branch = head
        .as_ref()
        .and_then(|h| h.shorthand())
        .map(|s| s.to_string());
    let detached = repo.head_detached().unwrap_or(false);

    Ok(RepoStatus {
        staged,
        unstaged,
        conflicted,
        branch,
        detached,
    })
}

#[tauri::command]
pub fn get_log(repo_path: String, limit: Option<usize>) -> Result<Vec<CommitInfo>, String> {
    let repo = open_repo(&repo_path)?;
    let limit = limit.unwrap_or(500);

    let mut oid_to_refs: HashMap<String, Vec<String>> = HashMap::new();
    for r in repo.references().map_err(|e| e.to_string())?.flatten() {
        if let Some(target) = r.target() {
            if let Some(name) = r.shorthand() {
                if r.is_tag() || r.is_branch() || r.is_remote() {
                    oid_to_refs
                        .entry(target.to_string())
                        .or_default()
                        .push(name.to_string());
                }
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| e.to_string())?;
    let _ = revwalk.push_glob("refs/heads/*");
    let _ = revwalk.push_glob("refs/remotes/*");
    let _ = revwalk.push_head();

    let mut commits = Vec::new();
    for oid in revwalk.flatten().take(limit) {
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let id = oid.to_string();
        let author = commit.author();
        commits.push(CommitInfo {
            short_id: id[..id.len().min(7)].to_string(),
            id: id.clone(),
            summary: commit.summary().unwrap_or("").to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author_name: author.name().unwrap_or("").to_string(),
            author_email: author.email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parent_ids: commit.parent_ids().map(|p| p.to_string()).collect(),
            refs: oid_to_refs.remove(&id).unwrap_or_default(),
            lane: 0,
            parent_lanes: Vec::new(),
        });
    }

    compute_graph_lanes(&mut commits);
    Ok(commits)
}

#[tauri::command]
pub fn get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = open_repo(&repo_path)?;
    let head_name = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()));

    let mut out = Vec::new();
    for item in repo.branches(None).map_err(|e| e.to_string())?.flatten() {
        let (branch, btype) = item;
        let name = match branch.name().map_err(|e| e.to_string())? {
            Some(n) => n.to_string(),
            None => continue,
        };
        let is_remote = btype == BranchType::Remote;
        let full_name = branch
            .get()
            .name()
            .unwrap_or(&name)
            .to_string();
        let target = branch.get().target().map(|o| o.to_string());
        let is_head = !is_remote && head_name.as_deref() == Some(name.as_str());

        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        let (ahead, behind) = if let (Some(local_oid), Ok(up)) = (branch.get().target(), branch.upstream()) {
            if let Some(up_oid) = up.get().target() {
                repo.graph_ahead_behind(local_oid, up_oid).unwrap_or((0, 0))
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        out.push(BranchInfo {
            name,
            full_name,
            is_head,
            is_remote,
            upstream,
            target,
            ahead,
            behind,
        });
    }

    Ok(out)
}

#[tauri::command]
pub fn get_remotes(repo_path: String) -> Result<Vec<RemoteInfo>, String> {
    let repo = open_repo(&repo_path)?;
    let names = repo.remotes().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for name in names.iter().flatten() {
        if let Ok(remote) = repo.find_remote(name) {
            out.push(RemoteInfo {
                name: name.to_string(),
                url: remote.url().unwrap_or("").to_string(),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn get_tags(repo_path: String) -> Result<Vec<TagInfo>, String> {
    let repo = open_repo(&repo_path)?;
    let mut out = Vec::new();
    repo.tag_foreach(|oid, name| {
        let name = String::from_utf8_lossy(name)
            .trim_start_matches("refs/tags/")
            .to_string();
        out.push(TagInfo {
            name,
            target: oid.to_string(),
        });
        true
    })
    .map_err(|e| e.to_string())?;
    Ok(out)
}

#[tauri::command]
pub fn get_commit_diff(repo_path: String, commit_id: String) -> Result<Vec<FileDiff>, String> {
    let repo = open_repo(&repo_path)?;
    let oid = git2::Oid::from_str(&commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let mut opts = DiffOptions::new();
    opts.context_lines(3);

    let diff = if commit.parent_count() == 0 {
        repo.diff_tree_to_tree(None, Some(&tree), Some(&mut opts))
            .map_err(|e| e.to_string())?
    } else {
        let parent = commit.parent(0).map_err(|e| e.to_string())?;
        let parent_tree = parent.tree().map_err(|e| e.to_string())?;
        repo.diff_tree_to_tree(Some(&parent_tree), Some(&tree), Some(&mut opts))
            .map_err(|e| e.to_string())?
    };

    diff_to_file_diffs(&diff).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_working_diff(
    repo_path: String,
    path: String,
    staged: bool,
) -> Result<FileDiff, String> {
    let repo = open_repo(&repo_path)?;
    let mut opts = DiffOptions::new();
    opts.context_lines(3);
    opts.pathspec(&path);
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let diff = if staged {
        let head_tree = repo
            .head()
            .ok()
            .and_then(|h| h.peel_to_tree().ok());
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut opts))
            .map_err(|e| e.to_string())?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut opts))
            .map_err(|e| e.to_string())?
    };

    let mut files = diff_to_file_diffs(&diff).map_err(|e| e.to_string())?;
    Ok(files.pop().unwrap_or(FileDiff {
        path,
        ..Default::default()
    }))
}

#[tauri::command]
pub fn stage_file(repo_path: String, path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let full_path = repo.workdir().unwrap().join(&path);
    if full_path.exists() {
        index.add_path(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
    } else {
        index.remove_path(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn unstage_file(repo_path: String, path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    match head {
        Some(commit) => {
            repo.reset_default(Some(commit.as_object()), [path.as_str()].iter())
                .map_err(|e| e.to_string())?;
        }
        None => {
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.remove_path(std::path::Path::new(&path)).map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn stage_all(repo_path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn unstage_all(repo_path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    if let Some(commit) = head {
        repo.reset_default(Some(commit.as_object()), ["*"].iter())
            .map_err(|e| e.to_string())?;
    } else {
        let mut index = repo.index().map_err(|e| e.to_string())?;
        index.clear().map_err(|e| e.to_string())?;
        index.write().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn discard_file_changes(repo_path: String, path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut opts = git2::build::CheckoutBuilder::new();
    opts.path(&path).force();
    repo.checkout_head(Some(&mut opts)).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn commit(repo_path: String, message: String) -> Result<CommitInfo, String> {
    let mut repo = open_repo(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    if index.has_conflicts() {
        return Err("Cannot commit: unresolved conflicts remain".to_string());
    }

    let mut parent_oids: Vec<git2::Oid> = Vec::new();
    if let Ok(head) = repo.head() {
        if let Ok(c) = head.peel_to_commit() {
            parent_oids.push(c.id());
        }
    }

    // Finishing a `git merge` that paused for conflicts needs the merge
    // head(s) as extra parents, same as a normal `git commit` would do.
    let is_merging = repo.state() == git2::RepositoryState::Merge;
    if is_merging {
        let mut merge_oids = Vec::new();
        let _ = repo.mergehead_foreach(|oid| {
            merge_oids.push(*oid);
            true
        });
        parent_oids.extend(merge_oids);
    }

    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let parents: Vec<git2::Commit> = parent_oids
        .iter()
        .filter_map(|oid| repo.find_commit(*oid).ok())
        .collect();
    let parent_refs: Vec<&git2::Commit> = parents.iter().collect();

    let oid = repo
        .commit(Some("HEAD"), &sig, &sig, &message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;

    if is_merging {
        repo.cleanup_state().map_err(|e| e.to_string())?;
    }

    let new_commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let id = oid.to_string();
    let info = CommitInfo {
        short_id: id[..id.len().min(7)].to_string(),
        id,
        summary: new_commit.summary().unwrap_or("").to_string(),
        message: new_commit.message().unwrap_or("").to_string(),
        author_name: new_commit.author().name().unwrap_or("").to_string(),
        author_email: new_commit.author().email().unwrap_or("").to_string(),
        timestamp: new_commit.time().seconds(),
        parent_ids: new_commit.parent_ids().map(|p| p.to_string()).collect(),
        refs: Vec::new(),
        lane: 0,
        parent_lanes: Vec::new(),
    };
    Ok(info)
}

#[tauri::command]
pub fn checkout_branch(repo_path: String, name: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let (object, reference) = repo
        .revparse_ext(&name)
        .map_err(|e| e.to_string())?;
    repo.checkout_tree(&object, None).map_err(|e| e.to_string())?;
    match reference {
        Some(r) => repo.set_head(r.name().ok_or("invalid ref name")?),
        None => repo.set_head_detached(object.id()),
    }
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_branch(
    repo_path: String,
    name: String,
    start_point: Option<String>,
    checkout: bool,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let target_commit = match start_point {
        Some(sp) => {
            let (obj, _) = repo.revparse_ext(&sp).map_err(|e| e.to_string())?;
            obj.peel_to_commit().map_err(|e| e.to_string())?
        }
        None => repo.head().map_err(|e| e.to_string())?.peel_to_commit().map_err(|e| e.to_string())?,
    };
    repo.branch(&name, &target_commit, false)
        .map_err(|e| e.to_string())?;
    if checkout {
        checkout_branch(repo_path, name)?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_branch(repo_path: String, name: String, is_remote: bool) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let btype = if is_remote {
        BranchType::Remote
    } else {
        BranchType::Local
    };
    let mut branch = repo.find_branch(&name, btype).map_err(|e| e.to_string())?;
    branch.delete().map_err(|e| e.to_string())?;
    Ok(())
}

/// Retries a failed fetch over HTTPS with the signed-in GitHub token, without
/// ever touching the repo's persisted remote config — so other tools reading
/// the same repo (e.g. GitKraken, pointed at an SSH remote it manages its own
/// key for) are completely unaffected by this fallback ever having happened.
fn fetch_via_https_fallback(
    repo: &Repository,
    original_url: Option<&str>,
    refspecs: &[&str],
    original_err: &git2::Error,
) -> Result<(), String> {
    let https_url = match original_url.and_then(crate::github::github_ssh_to_https) {
        Some(u) => u,
        None => return Err(original_err.to_string()),
    };
    if !crate::github::has_stored_token() {
        return Err(crate::github::NEEDS_GITHUB_AUTH.to_string());
    }
    let mut anon = repo.remote_anonymous(&https_url).map_err(|e| e.to_string())?;
    let mut opts = git2::FetchOptions::new();
    opts.remote_callbacks(remote_callbacks());
    anon.fetch(refspecs, Some(&mut opts), None)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fetch(repo_path: String, remote: Option<String>) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let remote_name = remote.unwrap_or_else(|| "origin".to_string());
    let mut r = repo.find_remote(&remote_name).map_err(|e| e.to_string())?;
    let mut opts = git2::FetchOptions::new();
    opts.remote_callbacks(remote_callbacks());
    match r.fetch(&[] as &[&str], Some(&mut opts), None) {
        Err(e) => fetch_via_https_fallback(&repo, r.url(), &[], &e),
        Ok(()) => Ok(()),
    }
}

#[tauri::command]
pub fn pull(repo_path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;
    let head_ref = repo.head().map_err(|e| e.to_string())?;
    let branch_name = head_ref
        .shorthand()
        .ok_or("Cannot pull in detached HEAD state")?
        .to_string();

    let branch = repo
        .find_branch(&branch_name, BranchType::Local)
        .map_err(|e| e.to_string())?;
    let upstream = branch
        .upstream()
        .map_err(|_| "Current branch has no upstream configured".to_string())?;
    let upstream_name = upstream
        .name()
        .map_err(|e| e.to_string())?
        .ok_or("Invalid upstream name")?
        .to_string();
    let (remote_name, remote_branch) = upstream_name
        .split_once('/')
        .ok_or("Unexpected upstream name format")?;

    let mut r = repo.find_remote(remote_name).map_err(|e| e.to_string())?;
    let mut opts = git2::FetchOptions::new();
    opts.remote_callbacks(remote_callbacks());
    let refspec = format!("refs/heads/{remote_branch}");
    match r.fetch(&[refspec.as_str()], Some(&mut opts), None) {
        Err(e) => fetch_via_https_fallback(&repo, r.url(), &[refspec.as_str()], &e)?,
        Ok(()) => {}
    }

    let fetch_head = repo.find_reference("FETCH_HEAD").map_err(|e| e.to_string())?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| e.to_string())?;

    let analysis = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;

    if analysis.0.is_up_to_date() {
        return Ok("Already up to date".to_string());
    }
    if analysis.0.is_fast_forward() {
        let refname = head_ref.name().ok_or("invalid head ref")?;
        let mut reference = repo.find_reference(refname).map_err(|e| e.to_string())?;
        reference
            .set_target(fetch_commit.id(), "Fast-forward")
            .map_err(|e| e.to_string())?;
        repo.set_head(refname).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .map_err(|e| e.to_string())?;
        return Ok("Fast-forwarded".to_string());
    }

    Err("Cannot fast-forward: branches have diverged. Merge manually.".to_string())
}

#[tauri::command]
pub fn push(
    repo_path: String,
    remote: String,
    branch: String,
    set_upstream: bool,
) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut r = repo.find_remote(&remote).map_err(|e| e.to_string())?;
    let mut opts = git2::PushOptions::new();
    opts.remote_callbacks(remote_callbacks());
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    match r.push(&[refspec.as_str()], Some(&mut opts)) {
        Err(e) => {
            let https_url = match r.url().and_then(crate::github::github_ssh_to_https) {
                Some(u) => u,
                None => return Err(e.to_string()),
            };
            if !crate::github::has_stored_token() {
                return Err(crate::github::NEEDS_GITHUB_AUTH.to_string());
            }
            let mut anon = repo.remote_anonymous(&https_url).map_err(|e| e.to_string())?;
            let mut opts2 = git2::PushOptions::new();
            opts2.remote_callbacks(remote_callbacks());
            anon.push(&[refspec.as_str()], Some(&mut opts2))
                .map_err(|e| e.to_string())?;
            // Unlike a push through the named remote, an anonymous remote has
            // no configured refspec to auto-update the local remote-tracking
            // branch — without this, origin/<branch> would keep pointing at
            // the pre-push commit even though the push itself succeeded.
            let local_oid = repo
                .find_branch(&branch, BranchType::Local)
                .and_then(|b| b.get().target().ok_or_else(|| git2::Error::from_str("no target")))
                .map_err(|e| e.to_string())?;
            repo.reference(
                &format!("refs/remotes/{remote}/{branch}"),
                local_oid,
                true,
                "push (https fallback)",
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(()) => {}
    }

    if set_upstream {
        let mut local_branch = repo
            .find_branch(&branch, BranchType::Local)
            .map_err(|e| e.to_string())?;
        local_branch
            .set_upstream(Some(&format!("{remote}/{branch}")))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn stash_list(repo_path: String) -> Result<Vec<StashInfo>, String> {
    let mut repo = open_repo(&repo_path)?;
    let mut out = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        out.push(StashInfo {
            index,
            message: message.to_string(),
            oid: oid.to_string(),
        });
        true
    })
    .map_err(|e| e.to_string())?;
    Ok(out)
}

#[tauri::command]
pub fn stash_save(
    repo_path: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), String> {
    let mut repo = open_repo(&repo_path)?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let flags = if include_untracked {
        git2::StashFlags::INCLUDE_UNTRACKED
    } else {
        git2::StashFlags::DEFAULT
    };
    repo.stash_save(&sig, message.as_deref().unwrap_or("WIP"), Some(flags))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn stash_pop(repo_path: String, index: usize) -> Result<(), String> {
    let mut repo = open_repo(&repo_path)?;
    repo.stash_pop(index, None).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn stash_apply(repo_path: String, index: usize) -> Result<(), String> {
    let mut repo = open_repo(&repo_path)?;
    repo.stash_apply(index, None).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn stash_drop(repo_path: String, index: usize) -> Result<(), String> {
    let mut repo = open_repo(&repo_path)?;
    repo.stash_drop(index).map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Merge / Rebase / Conflicts ----------

#[derive(Serialize, Clone)]
pub struct RepoState {
    pub state: String,
    pub merge_summary: Option<String>,
    pub conflict_count: usize,
}

#[derive(Serialize, Clone)]
pub struct MergeOutcome {
    pub status: String,
    pub conflict_count: usize,
}

#[derive(Serialize, Clone)]
pub struct RebaseProgress {
    pub status: String,
    pub current: usize,
    pub total: usize,
    pub current_summary: String,
}

fn conflict_count(repo: &Repository) -> usize {
    match repo.index() {
        Ok(index) => index.conflicts().map(|c| c.count()).unwrap_or(0),
        Err(_) => 0,
    }
}

fn ref_name_for_oid(repo: &Repository, oid: git2::Oid) -> Option<String> {
    repo.references().ok().and_then(|refs| {
        refs.flatten()
            .find(|r| r.target() == Some(oid) && (r.is_branch() || r.is_remote()))
            .and_then(|r| r.shorthand().map(|s| s.to_string()))
    })
}

#[tauri::command]
pub fn get_repo_state(repo_path: String) -> Result<RepoState, String> {
    let mut repo = open_repo(&repo_path)?;

    let state_str = match repo.state() {
        git2::RepositoryState::Clean => "clean",
        git2::RepositoryState::Merge => "merge",
        git2::RepositoryState::Rebase
        | git2::RepositoryState::RebaseInteractive
        | git2::RepositoryState::RebaseMerge => "rebase",
        git2::RepositoryState::CherryPick | git2::RepositoryState::CherryPickSequence => {
            "cherrypick"
        }
        git2::RepositoryState::Revert | git2::RepositoryState::RevertSequence => "revert",
        _ => "other",
    };

    let merge_summary = if state_str == "merge" {
        let mut oids = Vec::new();
        let _ = repo.mergehead_foreach(|oid| {
            oids.push(*oid);
            true
        });
        oids.first().and_then(|oid| {
            repo.find_commit(*oid).ok().map(|c| {
                let name = ref_name_for_oid(&repo, *oid)
                    .unwrap_or_else(|| oid.to_string()[..7.min(oid.to_string().len())].to_string());
                format!("{} ({})", name, c.summary().unwrap_or(""))
            })
        })
    } else {
        None
    };

    Ok(RepoState {
        state: state_str.to_string(),
        merge_summary,
        conflict_count: conflict_count(&repo),
    })
}

#[tauri::command]
pub fn merge_branch(repo_path: String, name: String) -> Result<MergeOutcome, String> {
    let repo = open_repo(&repo_path)?;
    let (obj, _) = repo.revparse_ext(&name).map_err(|e| e.to_string())?;
    let their_commit = obj.peel_to_commit().map_err(|e| e.to_string())?;
    let their_annotated = repo
        .find_annotated_commit(their_commit.id())
        .map_err(|e| e.to_string())?;

    let analysis = repo
        .merge_analysis(&[&their_annotated])
        .map_err(|e| e.to_string())?;

    if analysis.0.is_up_to_date() {
        return Ok(MergeOutcome {
            status: "up_to_date".to_string(),
            conflict_count: 0,
        });
    }

    if analysis.0.is_fast_forward() {
        let head_ref_name = repo
            .head()
            .map_err(|e| e.to_string())?
            .name()
            .ok_or("invalid head ref")?
            .to_string();
        let mut reference = repo
            .find_reference(&head_ref_name)
            .map_err(|e| e.to_string())?;
        reference
            .set_target(their_commit.id(), "Fast-forward merge")
            .map_err(|e| e.to_string())?;
        repo.set_head(&head_ref_name).map_err(|e| e.to_string())?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::new().force()))
            .map_err(|e| e.to_string())?;
        return Ok(MergeOutcome {
            status: "fast_forward".to_string(),
            conflict_count: 0,
        });
    }

    repo.merge(&[&their_annotated], None, None)
        .map_err(|e| e.to_string())?;

    if conflict_count(&repo) > 0 {
        return Ok(MergeOutcome {
            status: "conflicts".to_string(),
            conflict_count: conflict_count(&repo),
        });
    }

    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let head_commit = repo
        .head()
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?;
    let current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s.to_string()))
        .unwrap_or_default();
    let message = format!("Merge {} into {}", name, current_branch);
    repo.commit(
        Some("HEAD"),
        &sig,
        &sig,
        &message,
        &tree,
        &[&head_commit, &their_commit],
    )
    .map_err(|e| e.to_string())?;
    repo.cleanup_state().map_err(|e| e.to_string())?;

    Ok(MergeOutcome {
        status: "merged".to_string(),
        conflict_count: 0,
    })
}

#[tauri::command]
pub fn merge_abort(repo_path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let head_commit = repo
        .head()
        .map_err(|e| e.to_string())?
        .peel_to_commit()
        .map_err(|e| e.to_string())?;
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.reset(
        head_commit.as_object(),
        git2::ResetType::Hard,
        Some(&mut checkout),
    )
    .map_err(|e| e.to_string())?;
    repo.cleanup_state().map_err(|e| e.to_string())?;
    Ok(())
}

fn drive_rebase(repo: &Repository, rebase: &mut git2::Rebase) -> Result<RebaseProgress, String> {
    let sig = repo.signature().map_err(|e| e.to_string())?;
    let total = rebase.len();

    while let Some(op_result) = rebase.next() {
        let op = op_result.map_err(|e| e.to_string())?;
        let op_id = op.id();

        if conflict_count(repo) > 0 {
            let current = rebase.operation_current().unwrap_or(0) + 1;
            let summary = repo
                .find_commit(op_id)
                .ok()
                .and_then(|c| c.summary().map(|s| s.to_string()))
                .unwrap_or_default();
            return Ok(RebaseProgress {
                status: "conflicts".to_string(),
                current,
                total,
                current_summary: summary,
            });
        }

        rebase.commit(None, &sig, None).map_err(|e| e.to_string())?;
    }

    rebase.finish(Some(&sig)).map_err(|e| e.to_string())?;
    Ok(RebaseProgress {
        status: "complete".to_string(),
        current: total,
        total,
        current_summary: String::new(),
    })
}

#[tauri::command]
pub fn start_rebase(repo_path: String, onto: String) -> Result<RebaseProgress, String> {
    let repo = open_repo(&repo_path)?;
    let head_ref = repo.head().map_err(|e| e.to_string())?;
    let branch_annotated = repo
        .reference_to_annotated_commit(&head_ref)
        .map_err(|e| e.to_string())?;

    let (onto_obj, _) = repo.revparse_ext(&onto).map_err(|e| e.to_string())?;
    let onto_annotated = repo
        .find_annotated_commit(onto_obj.id())
        .map_err(|e| e.to_string())?;

    let mut rebase = repo
        .rebase(Some(&branch_annotated), None, Some(&onto_annotated), None)
        .map_err(|e| e.to_string())?;

    drive_rebase(&repo, &mut rebase)
}

#[tauri::command]
pub fn rebase_continue(repo_path: String) -> Result<RebaseProgress, String> {
    let repo = open_repo(&repo_path)?;
    if conflict_count(&repo) > 0 {
        return Err("Resolve all conflicts before continuing the rebase".to_string());
    }

    let mut rebase = repo.open_rebase(None).map_err(|e| e.to_string())?;
    let sig = repo.signature().map_err(|e| e.to_string())?;

    // The operation that paused on conflicts was already applied to the
    // index/workdir; now that it's resolved, commit it before advancing.
    if rebase.operation_current().is_some() {
        rebase
            .commit(None, &sig, None)
            .map_err(|e| e.to_string())?;
    }

    drive_rebase(&repo, &mut rebase)
}

#[tauri::command]
pub fn rebase_abort(repo_path: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut rebase = repo.open_rebase(None).map_err(|e| e.to_string())?;
    rebase.abort().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_working_file(repo_path: String, path: String) -> Result<String, String> {
    let repo = open_repo(&repo_path)?;
    let full_path = repo.workdir().ok_or("No working directory")?.join(&path);
    std::fs::read_to_string(&full_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_working_file(repo_path: String, path: String, content: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let full_path = repo.workdir().ok_or("No working directory")?.join(&path);
    std::fs::write(&full_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reset_to_commit(repo_path: String, commit_id: String, mode: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let oid = git2::Oid::from_str(&commit_id).map_err(|e| e.to_string())?;
    let object = repo.find_object(oid, None).map_err(|e| e.to_string())?;
    let reset_type = match mode.as_str() {
        "soft" => git2::ResetType::Soft,
        "mixed" => git2::ResetType::Mixed,
        "hard" => git2::ResetType::Hard,
        other => return Err(format!("Unknown reset mode: {other}")),
    };
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.reset(&object, reset_type, Some(&mut checkout))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn resolve_conflict(repo_path: String, path: String, side: String) -> Result<(), String> {
    let repo = open_repo(&repo_path)?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let full_path = repo.workdir().ok_or("No working directory")?.join(&path);

    let mut resolved_entry: Option<git2::IndexEntry> = None;
    for conflict in index.conflicts().map_err(|e| e.to_string())?.flatten() {
        let matches_path = |entry: &Option<git2::IndexEntry>| {
            entry
                .as_ref()
                .map(|e| String::from_utf8_lossy(&e.path) == path)
                .unwrap_or(false)
        };
        if matches_path(&conflict.our) || matches_path(&conflict.their) || matches_path(&conflict.ancestor) {
            resolved_entry = if side == "ours" {
                conflict.our
            } else {
                conflict.their
            };
            break;
        }
    }

    match resolved_entry {
        Some(entry) => {
            let blob = repo.find_blob(entry.id).map_err(|e| e.to_string())?;
            std::fs::write(&full_path, blob.content()).map_err(|e| e.to_string())?;
            index
                .add_path(std::path::Path::new(&path))
                .map_err(|e| e.to_string())?;
        }
        None => {
            let _ = std::fs::remove_file(&full_path);
            index
                .remove_path(std::path::Path::new(&path))
                .map_err(|e| e.to_string())?;
        }
    }
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}
