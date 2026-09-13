import { useEffect, useState } from "react";

const COLLAPSE_THRESHOLD = 12;

function ContextBlock({
  text,
  editable,
  onChange,
}: {
  text: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  const lineCount = text.split("\n").length;
  const collapsible = lineCount > COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(!collapsible);

  return (
    <div className="conflict-context-wrap">
      {collapsible && (
        <button className="conflict-context-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? "▾" : "▸"} {lineCount} unchanged lines
        </button>
      )}
      {expanded &&
        (editable ? (
          <textarea
            className="conflict-context-editable"
            value={text}
            rows={lineCount}
            spellCheck={false}
            onChange={(e) => onChange?.(e.target.value)}
          />
        ) : (
          <pre className="conflict-context">{text}</pre>
        ))}
    </div>
  );
}

interface ContextSegment {
  type: "context";
  text: string;
}
interface ConflictSegment {
  type: "conflict";
  ours: string;
  theirs: string;
  resolvedText: string;
  decided: boolean;
}
type Segment = ContextSegment | ConflictSegment;

function parseIntoSegments(content: string): Segment[] {
  const lines = content.split("\n");
  const segments: Segment[] = [];
  let i = 0;
  let contextStart = 0;

  const flushContext = (end: number) => {
    if (end > contextStart) {
      segments.push({ type: "context", text: lines.slice(contextStart, end).join("\n") });
    }
  };

  while (i < lines.length) {
    if (lines[i].startsWith("<<<<<<<")) {
      flushContext(i);
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
      i++; // skip >>>>>>> label
      segments.push({
        type: "conflict",
        ours: oursLines.join("\n"),
        theirs: theirsLines.join("\n"),
        resolvedText: "",
        decided: false,
      });
      contextStart = i;
    } else {
      i++;
    }
  }
  flushContext(lines.length);
  return segments;
}

function joinSegments(segments: Segment[]): string {
  return segments.map((s) => (s.type === "context" ? s.text : s.resolvedText)).join("\n");
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
  const [segments, setSegments] = useState<Segment[]>(() => parseIntoSegments(content ?? ""));
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState("");

  useEffect(() => {
    setSegments(parseIntoSegments(content ?? ""));
    setRawMode(false);
  }, [content]);

  const remaining = segments.filter((s) => s.type === "conflict" && !s.decided).length;

  function updateContext(index: number, text: string) {
    setSegments((prev) =>
      prev.map((s, i) => (i === index && s.type === "context" ? { ...s, text } : s))
    );
  }

  function updateConflictText(index: number, text: string) {
    setSegments((prev) =>
      prev.map((s, i) =>
        i === index && s.type === "conflict" ? { ...s, resolvedText: text, decided: true } : s
      )
    );
  }

  function pickSide(index: number, side: "ours" | "theirs" | "both") {
    setSegments((prev) =>
      prev.map((s, i) => {
        if (i !== index || s.type !== "conflict") return s;
        const resolved = side === "ours" ? s.ours : side === "theirs" ? s.theirs : `${s.ours}\n${s.theirs}`;
        return { ...s, resolvedText: resolved, decided: true };
      })
    );
  }

  function toggleRawMode() {
    if (rawMode) {
      setSegments(parseIntoSegments(rawText));
      setRawMode(false);
    } else {
      setRawText(joinSegments(segments));
      setRawMode(true);
    }
  }

  function handleSave() {
    onSave(rawMode ? rawText : joinSegments(segments));
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
        <button className="toolbar-btn" onClick={toggleRawMode}>
          {rawMode ? "3-way view" : "Raw editor"}
        </button>
        <button className="primary-btn" onClick={handleSave}>
          Save &amp; Mark Resolved
        </button>
      </div>

      {rawMode ? (
        <textarea
          className="conflict-raw-editor"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="conflict-3pane">
          <div className="conflict-3pane-top">
            <div className="conflict-pane conflict-pane-local">
              <div className="conflict-pane-header">Local (yours)</div>
              <div className="conflict-pane-body">
                {segments.map((seg, i) =>
                  seg.type === "context" ? (
                    <ContextBlock key={i} text={seg.text} />
                  ) : (
                    <div key={i} className="conflict-side-block conflict-side-ours">
                      <pre>{seg.ours}</pre>
                      <button className="conflict-take-btn" onClick={() => pickSide(i, "ours")}>
                        Use Local →
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
            <div className="conflict-pane conflict-pane-remote">
              <div className="conflict-pane-header">Remote (theirs)</div>
              <div className="conflict-pane-body">
                {segments.map((seg, i) =>
                  seg.type === "context" ? (
                    <ContextBlock key={i} text={seg.text} />
                  ) : (
                    <div key={i} className="conflict-side-block conflict-side-theirs">
                      <pre>{seg.theirs}</pre>
                      <button className="conflict-take-btn" onClick={() => pickSide(i, "theirs")}>
                        ← Use Remote
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
          <div className="conflict-pane conflict-pane-result">
            <div className="conflict-pane-header">
              Result <span className="conflict-pane-header-hint">— edit freely; resolved conflicts stay marked and editable</span>
            </div>
            <div className="conflict-pane-body">
              {segments.map((seg, i) =>
                seg.type === "context" ? (
                  <ContextBlock
                    key={i}
                    text={seg.text}
                    editable
                    onChange={(v) => updateContext(i, v)}
                  />
                ) : (
                  <div
                    key={i}
                    className={"conflict-result-block" + (seg.decided ? " decided" : " undecided")}
                  >
                    <div className="conflict-result-block-header">
                      <span>{seg.decided ? "Resolved conflict" : "Unresolved conflict"}</span>
                      <div className="conflict-result-block-actions">
                        <button className="toolbar-btn" onClick={() => pickSide(i, "ours")}>
                          Use Local
                        </button>
                        <button className="toolbar-btn" onClick={() => pickSide(i, "theirs")}>
                          Use Remote
                        </button>
                        <button className="toolbar-btn" onClick={() => pickSide(i, "both")}>
                          Use Both
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="conflict-result-editable"
                      value={seg.resolvedText}
                      rows={Math.max(1, seg.resolvedText.split("\n").length)}
                      spellCheck={false}
                      placeholder="Pick a side above, or type the merged result directly…"
                      onChange={(e) => updateConflictText(i, e.target.value)}
                    />
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
