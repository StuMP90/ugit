import { useEffect, useMemo, useState } from "react";

interface ConflictBlock {
  type: "context" | "conflict";
  text: string;
  oursLabel?: string;
  theirsLabel?: string;
  ours?: string;
  theirs?: string;
  startLine: number;
  endLine: number;
}

function parseConflicts(content: string): ConflictBlock[] {
  const lines = content.split("\n");
  const blocks: ConflictBlock[] = [];
  let i = 0;
  let contextStart = 0;

  const flushContext = (end: number) => {
    if (end > contextStart) {
      blocks.push({
        type: "context",
        text: lines.slice(contextStart, end).join("\n"),
        startLine: contextStart,
        endLine: end,
      });
    }
  };

  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      flushContext(i);
      const startLine = i;
      const oursLabel = lines[i];
      i++;
      const oursLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("=======")) {
        oursLines.push(lines[i]);
        i++;
      }
      i++; // skip =======
      const theirsLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith(">>>>>>>")) {
        theirsLines.push(lines[i]);
        i++;
      }
      const theirsLabel = lines[i] ?? ">>>>>>>";
      i++;
      blocks.push({
        type: "conflict",
        text: "",
        oursLabel,
        theirsLabel,
        ours: oursLines.join("\n"),
        theirs: theirsLines.join("\n"),
        startLine,
        endLine: i,
      });
      contextStart = i;
    } else {
      i++;
    }
  }
  flushContext(lines.length);
  return blocks;
}

interface Props {
  path: string;
  content: string | null;
  loading: boolean;
  onUseOurs: () => void;
  onUseTheirs: () => void;
  onSave: (content: string) => void;
  onReload: () => void;
}

export default function ConflictView({
  path,
  content,
  loading,
  onUseOurs,
  onUseTheirs,
  onSave,
  onReload,
}: Props) {
  const [draft, setDraft] = useState(content ?? "");
  const [rawMode, setRawMode] = useState(false);

  useEffect(() => {
    setDraft(content ?? "");
  }, [content]);

  const blocks = useMemo(() => parseConflicts(draft), [draft]);
  const remaining = blocks.filter((b) => b.type === "conflict").length;

  function acceptHunk(block: ConflictBlock, side: "ours" | "theirs" | "both") {
    const lines = draft.split("\n");
    const resolved =
      side === "ours"
        ? block.ours ?? ""
        : side === "theirs"
        ? block.theirs ?? ""
        : `${block.ours ?? ""}\n${block.theirs ?? ""}`;
    const resolvedLines = resolved.split("\n");
    const newLines = [
      ...lines.slice(0, block.startLine),
      ...resolvedLines,
      ...lines.slice(block.endLine),
    ];
    setDraft(newLines.join("\n"));
  }

  if (loading || content === null) {
    return <div className="diff-view empty">Loading conflict…</div>;
  }

  return (
    <div className="diff-view conflict-view-root">
      <div className="diff-file-header">
        <span>{path}</span>
        <span className={remaining > 0 ? "conflict-remaining-badge" : "conflict-resolved-badge"}>
          {remaining > 0 ? `${remaining} conflict(s) remaining` : "No conflict markers"}
        </span>
      </div>
      <div className="conflict-actions">
        <button className="toolbar-btn" onClick={onUseOurs}>
          Use Ours (whole file)
        </button>
        <button className="toolbar-btn" onClick={onUseTheirs}>
          Use Theirs (whole file)
        </button>
        <button className="toolbar-btn subtle" onClick={onReload}>
          Reload from disk
        </button>
        <span className="conflict-actions-spacer" />
        <button className="toolbar-btn" onClick={() => setRawMode((r) => !r)}>
          {rawMode ? "Structured view" : "Raw editor"}
        </button>
        <button className="primary-btn" onClick={() => onSave(draft)}>
          Save &amp; Mark Resolved
        </button>
      </div>

      {rawMode ? (
        <textarea
          className="conflict-raw-editor"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="conflict-structured">
          {blocks.map((block, i) =>
            block.type === "context" ? (
              <pre key={i} className="conflict-context">
                {block.text}
              </pre>
            ) : (
              <div key={i} className="conflict-hunk">
                <div className="conflict-hunk-side conflict-hunk-ours">
                  <div className="conflict-hunk-header">
                    <span>{block.oursLabel}</span>
                    <button className="toolbar-btn" onClick={() => acceptHunk(block, "ours")}>
                      Accept Ours
                    </button>
                  </div>
                  <pre>{block.ours}</pre>
                </div>
                <div className="conflict-hunk-side conflict-hunk-theirs">
                  <div className="conflict-hunk-header">
                    <span>{block.theirsLabel}</span>
                    <button className="toolbar-btn" onClick={() => acceptHunk(block, "theirs")}>
                      Accept Theirs
                    </button>
                  </div>
                  <pre>{block.theirs}</pre>
                </div>
                <button className="link-btn conflict-accept-both" onClick={() => acceptHunk(block, "both")}>
                  Accept both (ours then theirs)
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
