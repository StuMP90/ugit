import { useState } from "react";
import type { FileStatusEntry, RepoStatus } from "../types";
import { statusLetter } from "../statusUtils";

export interface FileSelection {
  path: string;
  staged: boolean;
}

interface Props {
  status: RepoStatus;
  selectedFile: FileSelection | null;
  onSelectFile: (sel: FileSelection) => void;
  onStage: (path: string) => void;
  onUnstage: (path: string) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscard: (path: string) => void;
  onCommit: (message: string) => void;
  committing: boolean;
}

function FileRow({
  entry,
  staged,
  selected,
  onSelect,
  onToggle,
  onDiscard,
}: {
  entry: FileStatusEntry;
  staged: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDiscard?: () => void;
}) {
  return (
    <div className={"file-row" + (selected ? " selected" : "")} onClick={onSelect}>
      <span className={"file-status-badge status-" + entry.status}>
        {statusLetter(entry.status)}
      </span>
      <span className="file-path">{entry.path}</span>
      {onDiscard && (
        <button
          className="icon-btn"
          title="Discard changes"
          onClick={(e) => {
            e.stopPropagation();
            onDiscard();
          }}
        >
          ✕
        </button>
      )}
      <button
        className="icon-btn"
        title={staged ? "Unstage" : "Stage"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {staged ? "−" : "+"}
      </button>
    </div>
  );
}

export default function ChangesPanel({
  status,
  selectedFile,
  onSelectFile,
  onStage,
  onUnstage,
  onStageAll,
  onUnstageAll,
  onDiscard,
  onCommit,
  committing,
}: Props) {
  const [message, setMessage] = useState("");

  return (
    <div className="changes-panel">
      <div className="changes-lists">
        {status.conflicted.length > 0 && (
          <div className="changes-section">
            <div className="changes-section-header">
              <span>Conflicted ({status.conflicted.length})</span>
            </div>
            {status.conflicted.map((e) => (
              <FileRow
                key={e.path}
                entry={e}
                staged={false}
                selected={selectedFile?.path === e.path}
                onSelect={() => onSelectFile({ path: e.path, staged: false })}
                onToggle={() => onStage(e.path)}
              />
            ))}
          </div>
        )}

        <div className="changes-section">
          <div className="changes-section-header">
            <span>Staged ({status.staged.length})</span>
            {status.staged.length > 0 && (
              <button className="link-btn" onClick={onUnstageAll}>
                Unstage all
              </button>
            )}
          </div>
          {status.staged.map((e) => (
            <FileRow
              key={e.path}
              entry={e}
              staged={true}
              selected={selectedFile?.path === e.path && selectedFile.staged}
              onSelect={() => onSelectFile({ path: e.path, staged: true })}
              onToggle={() => onUnstage(e.path)}
            />
          ))}
        </div>

        <div className="changes-section">
          <div className="changes-section-header">
            <span>Unstaged ({status.unstaged.length})</span>
            {status.unstaged.length > 0 && (
              <button className="link-btn" onClick={onStageAll}>
                Stage all
              </button>
            )}
          </div>
          {status.unstaged.map((e) => (
            <FileRow
              key={e.path}
              entry={e}
              staged={false}
              selected={selectedFile?.path === e.path && !selectedFile.staged}
              onSelect={() => onSelectFile({ path: e.path, staged: false })}
              onToggle={() => onStage(e.path)}
              onDiscard={() => onDiscard(e.path)}
            />
          ))}
        </div>
      </div>

      <div className="commit-box">
        <textarea
          placeholder="Commit message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <button
          className="primary-btn"
          disabled={!message.trim() || status.staged.length === 0 || committing}
          onClick={() => {
            onCommit(message);
            setMessage("");
          }}
        >
          {committing ? "Committing…" : `Commit ${status.staged.length} file(s)`}
        </button>
      </div>
    </div>
  );
}
