import type { CommitInfo, FileDiff } from "../types";
import { statusLetter } from "../statusUtils";

interface Props {
  commit: CommitInfo;
  files: FileDiff[];
  loading: boolean;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  onReset: (mode: "soft" | "mixed" | "hard") => void;
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

export default function CommitDetails({
  commit,
  files,
  loading,
  selectedPath,
  onSelectPath,
  onReset,
}: Props) {
  return (
    <div className="changes-panel">
      <div className="commit-details-header">
        <div className="commit-details-message">{commit.message || commit.summary}</div>
        <div className="commit-details-meta">
          <span>{commit.author_name}</span> · <span>{formatDate(commit.timestamp)}</span> ·{" "}
          <span className="commit-hash">{commit.short_id}</span>
        </div>
        <div className="reset-actions">
          <span className="reset-actions-label">Reset branch to here:</span>
          <button className="toolbar-btn" onClick={() => onReset("soft")}>
            Soft
          </button>
          <button className="toolbar-btn" onClick={() => onReset("mixed")}>
            Mixed
          </button>
          <button className="danger-btn" onClick={() => onReset("hard")}>
            Hard
          </button>
        </div>
      </div>
      <div className="changes-lists">
        <div className="changes-section">
          <div className="changes-section-header">
            <span>Changed files {loading ? "" : `(${files.length})`}</span>
          </div>
          {loading && <div className="empty-hint">Loading…</div>}
          {!loading &&
            files.map((f) => (
              <div
                key={f.path}
                className={"file-row" + (selectedPath === f.path ? " selected" : "")}
                onClick={() => onSelectPath(f.path)}
              >
                <span className={"file-status-badge status-" + f.status}>
                  {statusLetter(f.status)}
                </span>
                <span className="file-path">{f.path}</span>
                <span className="diff-stats">
                  <span className="add">+{f.additions}</span>{" "}
                  <span className="del">-{f.deletions}</span>
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
