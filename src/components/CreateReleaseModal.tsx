import { useState } from "react";

interface Props {
  tagName: string;
  onConfirm: (name: string, body: string, draft: boolean, prerelease: boolean) => void;
  onCancel: () => void;
}

export default function CreateReleaseModal({ tagName, onConfirm, onCancel }: Props) {
  const [name, setName] = useState(tagName);
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);
  const [prerelease, setPrerelease] = useState(false);

  function submit() {
    onConfirm(name.trim(), body.trim(), draft, prerelease);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create GitHub release</h3>
        <p className="empty-hint">
          From tag <code>{tagName}</code>.
        </p>
        <label>
          Title
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onCancel()}
          />
        </label>
        <label>
          Release notes (optional)
          <textarea
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's changed…"
          />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          Save as draft (not published yet)
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={prerelease}
            onChange={(e) => setPrerelease(e.target.checked)}
          />
          Mark as pre-release
        </label>
        <div className="modal-actions">
          <button className="toolbar-btn subtle" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn" onClick={submit}>
            Create release
          </button>
        </div>
      </div>
    </div>
  );
}
