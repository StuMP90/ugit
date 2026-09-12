import type { RepoStatus, RepoSummary } from "../types";

interface Props {
  repo: RepoSummary;
  status: RepoStatus | null;
  busy: boolean;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onStash: () => void;
  onNewBranch: () => void;
  onCloseRepo: () => void;
}

export default function TopBar({
  repo,
  status,
  busy,
  onFetch,
  onPull,
  onPush,
  onStash,
  onNewBranch,
  onCloseRepo,
}: Props) {
  return (
    <div className="top-bar">
      <div className="top-bar-repo">
        <span className="repo-name">{repo.name}</span>
        {status?.branch && <span className="repo-branch">{status.branch}</span>}
        {status?.detached && <span className="repo-branch detached">detached</span>}
      </div>
      <div className="top-bar-actions">
        <button className="toolbar-btn" onClick={onFetch} disabled={busy}>
          Fetch
        </button>
        <button className="toolbar-btn" onClick={onPull} disabled={busy}>
          Pull
        </button>
        <button className="toolbar-btn" onClick={onPush} disabled={busy}>
          Push
        </button>
        <button className="toolbar-btn" onClick={onNewBranch} disabled={busy}>
          Branch
        </button>
        <button className="toolbar-btn" onClick={onStash} disabled={busy}>
          Stash
        </button>
        <button className="toolbar-btn subtle" onClick={onCloseRepo}>
          Switch repo
        </button>
      </div>
    </div>
  );
}
