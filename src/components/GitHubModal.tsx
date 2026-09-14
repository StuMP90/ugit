import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { api } from "../api";
import type { DeviceCodeInfo, GithubRepo } from "../types";
import { getLastDir, rememberDir } from "../lastDir";

type Purpose = "push" | "clone" | "signin";

// Backend's github.rs NEEDS_GITHUB_AUTH sentinel: the stored token turned
// out to be unusable (expired, revoked) rather than an ordinary API error.
function isAuthSentinel(e: unknown) {
  return String(e).includes("NEEDS_GITHUB_AUTH");
}

interface Props {
  purpose: Purpose;
  suggestedName?: string;
  onCancel: () => void;
  onRepoReady: (repo: GithubRepo) => void;
  onCloned: (path: string) => void;
  onSignedIn?: () => void;
  onError: (message: string) => void;
}

export default function GitHubModal({
  purpose,
  suggestedName,
  onCancel,
  onRepoReady,
  onCloned,
  onSignedIn,
  onError,
}: Props) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceCodeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  const [repoName, setRepoName] = useState(suggestedName ?? "");
  const [isPrivate, setIsPrivate] = useState(true);
  const [description, setDescription] = useState("");

  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [cloneTarget, setCloneTarget] = useState<string | null>(null);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    api.githubIsSignedIn().then(async (v) => {
      if (cancelledRef.current) return;
      setSignedIn(v);
      if (v) {
        try {
          const u = await api.githubGetUsername();
          if (!cancelledRef.current) setUsername(u);
        } catch (e) {
          // A stored token that turns out to be dead (expired with no usable
          // refresh token, revoked, etc.) surfaces here as NEEDS_GITHUB_AUTH —
          // fall back to the sign-in screen instead of showing "signed in"
          // with no username and every action failing.
          if (!cancelledRef.current && isAuthSentinel(e)) setSignedIn(false);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (signedIn && purpose === "clone" && repos === null) {
      setBusy(true);
      api
        .githubListRepos()
        .then((r) => !cancelledRef.current && setRepos(r))
        .catch((e) => {
          if (cancelledRef.current) return;
          if (isAuthSentinel(e)) {
            setSignedIn(false);
            setUsername(null);
          } else {
            onError(String(e));
          }
        })
        .finally(() => !cancelledRef.current && setBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, purpose, repos]);

  async function startSignIn() {
    setBusy(true);
    try {
      const info = await api.githubStartDeviceFlow();
      if (cancelledRef.current) return;
      setDevice(info);
      openUrl(info.verification_uri).catch(() => {});
      pollLoop(info, info.interval * 1000);
    } catch (e) {
      onError(String(e));
      setBusy(false);
    }
  }

  function pollLoop(info: DeviceCodeInfo, delayMs: number) {
    setTimeout(async () => {
      if (cancelledRef.current) return;
      try {
        const res = await api.githubPollDeviceFlow(info.device_code);
        if (cancelledRef.current) return;
        if (res.status === "success") {
          setDevice(null);
          setSignedIn(true);
          setBusy(false);
          try {
            setUsername(await api.githubGetUsername());
          } catch {
            // ignore
          }
        } else if (res.status === "pending") {
          pollLoop(info, delayMs);
        } else if (res.status === "slow_down") {
          pollLoop(info, delayMs + 5000);
        } else {
          onError(res.message ?? `GitHub sign-in ${res.status}`);
          setDevice(null);
          setBusy(false);
        }
      } catch (e) {
        onError(String(e));
        setDevice(null);
        setBusy(false);
      }
    }, delayMs);
  }

  async function submitCreateRepo() {
    if (!repoName.trim()) return;
    setBusy(true);
    try {
      const repo = await api.githubCreateRepo(repoName.trim(), isPrivate, description.trim() || null);
      onRepoReady(repo);
    } catch (e) {
      if (isAuthSentinel(e)) {
        setSignedIn(false);
        setUsername(null);
      } else {
        onError(String(e));
      }
      setBusy(false);
    }
  }

  async function pickCloneFolder() {
    if (!selectedRepo) return;
    const parent = await openDialog({
      directory: true,
      multiple: false,
      title: `Choose where to create "${selectedRepo.name}"`,
      defaultPath: getLastDir(),
    });
    if (typeof parent !== "string") return;
    rememberDir(parent);
    setCloneTarget(`${parent}/${selectedRepo.name}`);
  }

  async function confirmClone() {
    if (!selectedRepo || !cloneTarget) return;
    setBusy(true);
    try {
      await api.cloneRepository(selectedRepo.clone_url, cloneTarget);
      onCloned(cloneTarget);
    } catch (e) {
      onError(String(e));
      setBusy(false);
    }
  }

  const filteredRepos = repos?.filter(
    (r) =>
      !filter.trim() ||
      r.full_name.toLowerCase().includes(filter.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal github-modal" onClick={(e) => e.stopPropagation()}>
        <h3>
          {purpose === "push"
            ? "Create a GitHub repository"
            : purpose === "clone"
            ? "Clone from GitHub"
            : "Sign in to GitHub"}
        </h3>

        {signedIn === null && <p className="empty-hint">Checking sign-in status…</p>}

        {signedIn === false && !device && (
          <>
            <p>
              {purpose === "push"
                ? "Sign in to GitHub to create a repository."
                : purpose === "clone"
                ? "Sign in to GitHub to browse your repositories."
                : "Sign in to GitHub so uGit can push, pull, and browse your repositories — including falling back to this automatically if an SSH remote (e.g. one set up by another tool) doesn't work."}
            </p>
            <div className="modal-actions">
              <button className="toolbar-btn subtle" onClick={onCancel}>
                Cancel
              </button>
              <button className="primary-btn" disabled={busy} onClick={startSignIn}>
                Sign in with GitHub
              </button>
            </div>
          </>
        )}

        {device && (
          <div className="github-device-flow">
            <p>
              Enter this code at <strong>{device.verification_uri}</strong> (opened in your browser):
            </p>
            <div className="github-device-code">{device.user_code}</div>
            <p className="empty-hint">Waiting for approval…</p>
            <div className="modal-actions">
              <button className="toolbar-btn subtle" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {signedIn === true && (
          <>
            {username && <p className="github-signed-in-as">Signed in as <strong>{username}</strong></p>}

            {purpose === "signin" && (
              <div className="modal-actions">
                <button className="primary-btn" onClick={() => onSignedIn?.()}>
                  Done
                </button>
              </div>
            )}

            {purpose === "push" && (
              <>
                <label>
                  Repository name
                  <input
                    autoFocus
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                  />
                </label>
                <label>
                  Description (optional)
                  <input value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <label className="github-visibility-row">
                  <select
                    value={isPrivate ? "private" : "public"}
                    onChange={(e) => setIsPrivate(e.target.value === "private")}
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <div className="modal-actions">
                  <button className="toolbar-btn subtle" onClick={onCancel}>
                    Cancel
                  </button>
                  <button
                    className="primary-btn"
                    disabled={busy || !repoName.trim()}
                    onClick={submitCreateRepo}
                  >
                    Create &amp; Push
                  </button>
                </div>
              </>
            )}

            {purpose === "clone" && cloneTarget && selectedRepo && (
              <>
                <p className="confirm-message">
                  Clone <strong>{selectedRepo.full_name}</strong> into:
                </p>
                <div className="github-clone-target">{cloneTarget}</div>
                <div className="modal-actions">
                  <button className="toolbar-btn subtle" onClick={onCancel}>
                    Cancel
                  </button>
                  <button className="toolbar-btn" disabled={busy} onClick={() => setCloneTarget(null)}>
                    Choose different folder
                  </button>
                  <button className="primary-btn" disabled={busy} onClick={confirmClone}>
                    Clone
                  </button>
                </div>
              </>
            )}

            {purpose === "clone" && !cloneTarget && (
              <>
                <input
                  className="github-repo-filter"
                  placeholder="Filter repositories…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  autoFocus
                />
                <div className="github-repo-list">
                  {busy && repos === null && <div className="empty-hint">Loading repositories…</div>}
                  {filteredRepos?.map((r) => (
                    <div
                      key={r.full_name}
                      className={"github-repo-row" + (selectedRepo?.full_name === r.full_name ? " selected" : "")}
                      onClick={() => setSelectedRepo(r)}
                    >
                      <span className="github-repo-name">{r.full_name}</span>
                      <span className={"github-repo-badge" + (r.private ? " private" : " public")}>
                        {r.private ? "Private" : "Public"}
                      </span>
                    </div>
                  ))}
                  {filteredRepos && filteredRepos.length === 0 && (
                    <div className="empty-hint">No matching repositories</div>
                  )}
                </div>
                <div className="modal-actions">
                  <button className="toolbar-btn subtle" onClick={onCancel}>
                    Cancel
                  </button>
                  <button className="primary-btn" disabled={busy || !selectedRepo} onClick={pickCloneFolder}>
                    Clone…
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
