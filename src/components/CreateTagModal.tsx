import { useState } from "react";
import { looksLikeMiscasedVersionTag } from "../tagUtils";

interface Props {
  onConfirm: (name: string, message: string, push: boolean) => void;
  onCancel: () => void;
}

export default function CreateTagModal({ onConfirm, onCancel }: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [push, setPush] = useState(true);

  const trimmedName = name.trim();
  const looksLikeMiscasedVersion = looksLikeMiscasedVersionTag(trimmedName);
  const canSubmit = trimmedName.length > 0 && !looksLikeMiscasedVersion;

  function submit() {
    if (canSubmit) onConfirm(trimmedName, message.trim(), push);
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create tag</h3>
        <label>
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="v1.0.0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) submit();
              if (e.key === "Escape") onCancel();
            }}
          />
        </label>
        {looksLikeMiscasedVersion && (
          <p className="field-error">
            Use a lowercase "v" — v{trimmedName.slice(1)}, not {trimmedName}. A capital V silently
            skips release automation that only triggers on lowercase-v tags.
          </p>
        )}
        <label>
          Message (optional — leave blank for a lightweight tag)
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Release 1.0.0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) submit();
              if (e.key === "Escape") onCancel();
            }}
          />
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
          Push to origin immediately
        </label>
        <p className="empty-hint">Tags the current commit (HEAD).</p>
        <div className="modal-actions">
          <button className="toolbar-btn subtle" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-btn" disabled={!canSubmit} onClick={submit}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
