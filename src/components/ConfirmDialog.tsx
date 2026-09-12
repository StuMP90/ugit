interface Props {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  message,
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button className="toolbar-btn subtle" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className={danger ? "danger-btn" : "primary-btn"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
