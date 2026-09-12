interface Props {
  path: string;
  content: string | null;
  loading: boolean;
  onUseOurs: () => void;
  onUseTheirs: () => void;
  onMarkResolved: () => void;
}

function renderLines(text: string) {
  const lines = text.split("\n");
  let section: "context" | "ours" | "theirs" = "context";
  return lines.map((line, i) => {
    let cls = "diff-line ctx";
    if (line.startsWith("<<<<<<<")) {
      section = "ours";
      cls = "diff-line conflict-marker";
    } else if (line.startsWith("=======")) {
      section = "theirs";
      cls = "diff-line conflict-marker";
    } else if (line.startsWith(">>>>>>>")) {
      section = "context";
      cls = "diff-line conflict-marker";
    } else if (section === "ours") {
      cls = "diff-line conflict-ours";
    } else if (section === "theirs") {
      cls = "diff-line conflict-theirs";
    }
    return (
      <div key={i} className={cls}>
        <span className="diff-content">{line}</span>
      </div>
    );
  });
}

export default function ConflictView({ path, content, loading, onUseOurs, onUseTheirs, onMarkResolved }: Props) {
  if (loading || content === null) {
    return <div className="diff-view empty">Loading conflict…</div>;
  }

  return (
    <div className="diff-view">
      <div className="diff-file-header">
        <span>{path}</span>
      </div>
      <div className="conflict-actions">
        <button className="toolbar-btn" onClick={onUseOurs}>
          Use Ours
        </button>
        <button className="toolbar-btn" onClick={onUseTheirs}>
          Use Theirs
        </button>
        <button className="primary-btn" onClick={onMarkResolved}>
          Mark Resolved
        </button>
      </div>
      <div className="conflict-hint">
        Current file content — edit externally to hand-resolve, then Mark Resolved to stage it.
      </div>
      <div className="diff-body">{renderLines(content)}</div>
    </div>
  );
}
