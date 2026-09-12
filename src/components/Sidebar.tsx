import { useState } from "react";
import type { BranchInfo, StashInfo, TagInfo } from "../types";

interface Props {
  branches: BranchInfo[];
  tags: TagInfo[];
  stashes: StashInfo[];
  onCheckout: (name: string) => void;
  onCreateBranch: () => void;
  onDeleteBranch: (name: string, isRemote: boolean) => void;
  onStashApply: (index: number) => void;
  onStashPop: (index: number) => void;
  onStashDrop: (index: number) => void;
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-header" onClick={() => setOpen(!open)}>
        <span className="sidebar-caret">{open ? "▾" : "▸"}</span>
        <span>
          {title} ({count})
        </span>
        {action}
      </div>
      {open && <div className="sidebar-section-body">{children}</div>}
    </div>
  );
}

export default function Sidebar({
  branches,
  tags,
  stashes,
  onCheckout,
  onCreateBranch,
  onDeleteBranch,
  onStashApply,
  onStashPop,
  onStashDrop,
}: Props) {
  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);

  return (
    <div className="sidebar">
      <Section
        title="Local branches"
        count={local.length}
        action={
          <button
            className="icon-btn"
            title="New branch"
            onClick={(e) => {
              e.stopPropagation();
              onCreateBranch();
            }}
          >
            +
          </button>
        }
      >
        {local.map((b) => (
          <div
            key={b.full_name}
            className={"sidebar-item" + (b.is_head ? " active" : "")}
            onClick={() => !b.is_head && onCheckout(b.name)}
            title={b.upstream ? `tracking ${b.upstream}` : undefined}
          >
            <span className="sidebar-item-label">{b.name}</span>
            {(b.ahead > 0 || b.behind > 0) && (
              <span className="branch-ab">
                {b.ahead > 0 ? `↑${b.ahead}` : ""}
                {b.behind > 0 ? `↓${b.behind}` : ""}
              </span>
            )}
            {!b.is_head && (
              <button
                className="icon-btn"
                title="Delete branch"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBranch(b.name, false);
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </Section>

      <Section title="Remote branches" count={remote.length}>
        {remote.map((b) => (
          <div key={b.full_name} className="sidebar-item" onClick={() => onCheckout(b.name)}>
            <span className="sidebar-item-label">{b.name}</span>
          </div>
        ))}
      </Section>

      <Section title="Tags" count={tags.length}>
        {tags.map((t) => (
          <div key={t.name} className="sidebar-item">
            <span className="sidebar-item-label">{t.name}</span>
          </div>
        ))}
      </Section>

      <Section title="Stashes" count={stashes.length}>
        {stashes.map((s) => (
          <div key={s.index} className="sidebar-item">
            <span className="sidebar-item-label" title={s.message}>
              {s.message}
            </span>
            <button className="icon-btn" title="Apply" onClick={() => onStashApply(s.index)}>
              ⇩
            </button>
            <button className="icon-btn" title="Pop" onClick={() => onStashPop(s.index)}>
              ⇪
            </button>
            <button className="icon-btn" title="Drop" onClick={() => onStashDrop(s.index)}>
              ✕
            </button>
          </div>
        ))}
      </Section>
    </div>
  );
}
