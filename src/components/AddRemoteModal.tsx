import { useState } from "react";

interface Props {
  onConfirm: (name: string, url: string) => void;
  onCancel: () => void;
}

export default function AddRemoteModal({ onConfirm, onCancel }: Props) {
  const [name, setName] = useState("origin");
  const [url, setUrl] = useState("");

  const canSubmit = name.trim().length > 0 && url.trim().length > 0;

  function submit() {
    if (canSubmit) onConfirm(name.trim(), url.trim());
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add remote</h3>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="origin"
          />
        </label>
        <label>
          URL
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="git@github.com:you/repo.git"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) submit();
              if (e.key === "Escape") onCancel();
            }}
          />
        </label>
        <div className="modal-actions">
          <button className="toolbar-btn subtle" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn" disabled={!canSubmit} onClick={submit}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
