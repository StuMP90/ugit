import { useState } from "react";

interface Props {
  title: string;
  placeholder?: string;
  confirmLabel?: string;
  defaultValue?: string;
  allowEmpty?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function PromptModal({
  title,
  placeholder,
  confirmLabel = "OK",
  defaultValue = "",
  allowEmpty = false,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (allowEmpty || value.trim())) onConfirm(value.trim());
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="modal-actions">
          <button className="toolbar-btn subtle" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary-btn"
            disabled={!allowEmpty && !value.trim()}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
