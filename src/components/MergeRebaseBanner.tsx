import type { RebaseProgress, RepoState } from "../types";

interface Props {
  repoState: RepoState;
  rebaseProgress: RebaseProgress | null;
  busy: boolean;
  onContinueRebase: () => void;
  onAbortRebase: () => void;
  onAbortMerge: () => void;
}

export default function MergeRebaseBanner({
  repoState,
  rebaseProgress,
  busy,
  onContinueRebase,
  onAbortRebase,
  onAbortMerge,
}: Props) {
  if (repoState.state === "merge") {
    return (
      <div className="merge-banner">
        <span>
          Merging {repoState.merge_summary ?? "changes"}
          {repoState.conflict_count > 0
            ? ` — ${repoState.conflict_count} conflict(s) remaining`
            : " — resolved, ready to commit"}
        </span>
        <div className="merge-banner-actions">
          <button className="toolbar-btn subtle" disabled={busy} onClick={onAbortMerge}>
            Abort merge
          </button>
        </div>
      </div>
    );
  }

  if (repoState.state === "rebase") {
    return (
      <div className="merge-banner">
        <span>
          Rebasing
          {rebaseProgress ? ` — step ${rebaseProgress.current} of ${rebaseProgress.total}: ${rebaseProgress.current_summary}` : ""}
          {repoState.conflict_count > 0 ? ` — ${repoState.conflict_count} conflict(s) remaining` : ""}
        </span>
        <div className="merge-banner-actions">
          <button
            className="toolbar-btn"
            disabled={busy || repoState.conflict_count > 0}
            onClick={onContinueRebase}
          >
            Continue rebase
          </button>
          <button className="toolbar-btn subtle" disabled={busy} onClick={onAbortRebase}>
            Abort rebase
          </button>
        </div>
      </div>
    );
  }

  return null;
}
