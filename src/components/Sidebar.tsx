import { useState } from "react";
import type { BranchInfo, GithubRelease, RemoteInfo, StashInfo, TagInfo } from "../types";
import { isGithubRemoteUrl } from "../githubUtils";

const TAGS_COLLAPSE_THRESHOLD = 10;

interface Props {
  branches: BranchInfo[];
  tags: TagInfo[];
  stashes: StashInfo[];
  remotes: RemoteInfo[];
  onCheckout: (name: string) => void;
  onCreateBranch: () => void;
  onDeleteBranch: (name: string, isRemote: boolean) => void;
  onMergeBranch: (name: string) => void;
  onRebaseOnto: (name: string) => void;
  onStashApply: (index: number) => void;
  onStashPop: (index: number) => void;
  onStashDrop: (index: number) => void;
  onAddRemote: () => void;
  onCreateTag: () => void;
  onPushTag: (name: string) => void;
  onDeleteTag: (name: string) => void;
  onCreateRelease: (name: string) => void;
  onViewRelease: (url: string) => void;
  releases: GithubRelease[];
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
  remotes,
  onCheckout,
  onCreateBranch,
  onDeleteBranch,
  onMergeBranch,
  onRebaseOnto,
  onStashApply,
  onStashPop,
  onStashDrop,
  onAddRemote,
  onCreateTag,
  onPushTag,
  onDeleteTag,
  onCreateRelease,
  onViewRelease,
  releases,
}: Props) {
  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);
  // GitHub Releases are a GitHub-specific concept (not plain git) — only
  // offer the action when origin actually points at github.com, rather
  // than showing a button that would just fail for e.g. a GitLab remote.
  const isGithubOrigin = remotes.some(
    (r) => r.name === "origin" && isGithubRemoteUrl(r.url)
  );
  const releaseByTag = new Map(releases.map((r) => [r.tag_name, r]));
  // Backend already returns tags most-recent-first (by target commit time)
  // — just slice for display here.
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const visibleTags = tagsExpanded ? tags : tags.slice(0, TAGS_COLLAPSE_THRESHOLD);

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
            onClick={() => onCheckout(b.name)}
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
              <>
                <button
                  className="icon-btn"
                  title={`Merge '${b.name}' into current branch`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMergeBranch(b.name);
                  }}
                >
                  ⇄
                </button>
                <button
                  className="icon-btn"
                  title={`Rebase current branch onto '${b.name}'`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRebaseOnto(b.name);
                  }}
                >
                  ⤴
                </button>
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
              </>
            )}
          </div>
        ))}
      </Section>

      <Section
        title="Remotes"
        count={remotes.length}
        action={
          <button
            className="icon-btn"
            title="Add remote"
            onClick={(e) => {
              e.stopPropagation();
              onAddRemote();
            }}
          >
            +
          </button>
        }
      >
        {remotes.map((r) => (
          <div className="sidebar-item" key={r.name} title={r.url}>
            <span className="sidebar-item-label">{r.name}</span>
            <span className="remote-url">{r.url}</span>
          </div>
        ))}
      </Section>

      <Section title="Remote branches" count={remote.length}>
        {remote.map((b) => (
          <div key={b.full_name} className="sidebar-item" onClick={() => onCheckout(b.name)}>
            <span className="sidebar-item-label">{b.name}</span>
            <button
              className="icon-btn"
              title={`Merge '${b.name}' into current branch`}
              onClick={(e) => {
                e.stopPropagation();
                onMergeBranch(b.name);
              }}
            >
              ⇄
            </button>
            <button
              className="icon-btn"
              title={`Rebase current branch onto '${b.name}'`}
              onClick={(e) => {
                e.stopPropagation();
                onRebaseOnto(b.name);
              }}
            >
              ⤴
            </button>
          </div>
        ))}
      </Section>

      <Section
        title="Tags"
        count={tags.length}
        action={
          <button
            className="icon-btn"
            title="New tag"
            onClick={(e) => {
              e.stopPropagation();
              onCreateTag();
            }}
          >
            +
          </button>
        }
      >
        {visibleTags.map((t) => {
          const release = releaseByTag.get(t.name);
          return (
          <div key={t.name} className="sidebar-item">
            <span className="sidebar-item-label">{t.name}</span>
            {isGithubOrigin && (
              release ? (
                <button
                  className="icon-btn"
                  title={`View GitHub release for "${t.name}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewRelease(release.html_url);
                  }}
                >
                  ⇗
                </button>
              ) : (
                <button
                  className="icon-btn"
                  title={`Create a GitHub release from "${t.name}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateRelease(t.name);
                  }}
                >
                  R
                </button>
              )
            )}
            <button
              className="icon-btn"
              title={`Push tag "${t.name}" to origin`}
              onClick={(e) => {
                e.stopPropagation();
                onPushTag(t.name);
              }}
            >
              ⇧
            </button>
            <button
              className="icon-btn"
              title="Delete tag"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTag(t.name);
              }}
            >
              ✕
            </button>
          </div>
          );
        })}
        {tags.length > TAGS_COLLAPSE_THRESHOLD && (
          <button className="sidebar-show-more" onClick={() => setTagsExpanded((e) => !e)}>
            {tagsExpanded ? "Show fewer" : `Show all ${tags.length} tags…`}
          </button>
        )}
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
