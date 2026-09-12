import type { RepoStatus } from "../types";

interface Props {
  status: RepoStatus | null;
  busy: boolean;
  onRefresh: () => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onStash: () => void;
  onNewBranch: () => void;
}

export default function TopBar({
  status,
  busy,
  onRefresh,
  onFetch,
  onPull,
  onPush,
  onStash,
  onNewBranch,
}: Props) {
  return (
    <div className="top-bar">
      <div className="top-bar-repo">
        {status?.branch && <span className="repo-branch">{status.branch}</span>}
        {status?.detached && <span className="repo-branch detached">detached</span>}
      </div>
      <div className="top-bar-actions">
        <button
          className="toolbar-btn"
          title="Refresh (F5) — reload status, branches, and log from disk"
          onClick={onRefresh}
          disabled={busy}
        >
          ⟳ Refresh
        </button>
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
      </div>
    </div>
  );
}
