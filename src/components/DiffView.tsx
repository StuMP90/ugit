import type { FileDiff } from "../types";

interface Props {
  diff: FileDiff | null;
  loading: boolean;
}

function lineClass(origin: string) {
  if (origin === "+") return "diff-line add";
  if (origin === "-") return "diff-line del";
  if (origin === "H") return "diff-line hunk";
  return "diff-line ctx";
}

export default function DiffView({ diff, loading }: Props) {
  if (loading) {
    return <div className="diff-view empty">Loading diff…</div>;
  }
  if (!diff) {
    return <div className="diff-view empty">Select a file to view its diff</div>;
  }
  if (diff.binary) {
    return <div className="diff-view empty">Binary file not shown</div>;
  }
  if (diff.hunks.length === 0) {
    if (diff.status === "added") {
      return <div className="diff-view empty">Empty file added</div>;
    }
    if (diff.status === "deleted") {
      return <div className="diff-view empty">Empty file deleted</div>;
    }
    return <div className="diff-view empty">No changes</div>;
  }

  return (
    <div className="diff-view">
      <div className="diff-file-header">
        {diff.old_path && diff.old_path !== diff.path ? (
          <span>
            {diff.old_path} → {diff.path}
          </span>
        ) : (
          <span>{diff.path}</span>
        )}
        <span className="diff-stats">
          <span className="add">+{diff.additions}</span>{" "}
          <span className="del">-{diff.deletions}</span>
        </span>
      </div>
      <div className="diff-body">
        {diff.hunks.map((hunk, hi) => (
          <div key={hi}>
            <div className="diff-line hunk">{hunk.header}</div>
            {hunk.lines.map((line, li) => (
              <div key={li} className={lineClass(line.origin)}>
                <span className="diff-lineno">{line.old_lineno ?? ""}</span>
                <span className="diff-lineno">{line.new_lineno ?? ""}</span>
                <span className="diff-origin">
                  {line.origin === "+" || line.origin === "-" ? line.origin : " "}
                </span>
                <span className="diff-content">{line.content}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
