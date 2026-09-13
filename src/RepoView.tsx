import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type {
  BranchInfo,
  CommitInfo,
  FileDiff,
  RebaseProgress,
  RemoteInfo,
  RepoState,
  RepoStatus,
  Selection,
  StashInfo,
  TagInfo,
} from "./types";
import TopBar from "./components/TopBar";
import Sidebar from "./components/Sidebar";
import CommitGraph from "./components/CommitGraph";
import ChangesPanel, { FileSelection } from "./components/ChangesPanel";
import CommitDetails from "./components/CommitDetails";
import DiffView from "./components/DiffView";
import ConflictView from "./components/ConflictView";
import MergeRebaseBanner from "./components/MergeRebaseBanner";
import PromptModal from "./components/PromptModal";
import ConfirmDialog from "./components/ConfirmDialog";
import AddRemoteModal from "./components/AddRemoteModal";
import GitHubModal from "./components/GitHubModal";

type Modal = null | "branch" | "stash";

interface ConfirmState {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

interface Props {
  repoPath: string;
}

export default function RepoView({ repoPath }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [stashes, setStashes] = useState<StashInfo[]>([]);
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [repoState, setRepoState] = useState<RepoState | null>(null);
  const [rebaseProgress, setRebaseProgress] = useState<RebaseProgress | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileSelection | null>(null);
  const [workingDiff, setWorkingDiff] = useState<FileDiff | null>(null);
  const [workingDiffLoading, setWorkingDiffLoading] = useState(false);

  const [conflictPath, setConflictPath] = useState<string | null>(null);
  const [conflictContent, setConflictContent] = useState<string | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);

  const [commitFiles, setCommitFiles] = useState<FileDiff[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  const [selectedCommitPath, setSelectedCommitPath] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [addRemoteOpen, setAddRemoteOpen] = useState(false);
  const [noRemoteChoiceOpen, setNoRemoteChoiceOpen] = useState(false);
  const [githubPushOpen, setGithubPushOpen] = useState(false);
  const [needsGithubAuthOpen, setNeedsGithubAuthOpen] = useState(false);
  const pendingGithubRetryRef = useRef<(() => void) | null>(null);

  const [commitSearch, setCommitSearch] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);

  // Wraps a fetch/pull/push action so that if it fails specifically because
  // no GitHub auth is available for an otherwise-recoverable SSH remote (see
  // git.rs's NEEDS_GITHUB_AUTH sentinel), the sign-in flow opens right here
  // instead of just showing a dead-end error — and the same action is
  // retried automatically once sign-in completes.
  function withGithubAuthRetry(action: () => Promise<void>) {
    return () =>
      runAction(async () => {
        try {
          await action();
        } catch (e) {
          if (String(e).includes("NEEDS_GITHUB_AUTH")) {
            pendingGithubRetryRef.current = () => runAction(action);
            setNeedsGithubAuthOpen(true);
            return;
          }
          throw e;
        }
      });
  }

  function askConfirm(message: string, onConfirm: () => void, confirmLabel?: string) {
    setConfirmState({ message, onConfirm, confirmLabel });
  }

  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const [s, l, b, t, st, rs, rm] = await Promise.all([
      api.getStatus(repoPath),
      api.getLog(repoPath, 500),
      api.getBranches(repoPath),
      api.getTags(repoPath),
      api.stashList(repoPath),
      api.getRepoState(repoPath),
      api.getRemotes(repoPath),
    ]);
    setStatus(s);
    setCommits(l);
    setBranches(b);
    setTags(t);
    setStashes(st);
    setRepoState(rs);
    setRemotes(rm);
  }, [repoPath]);

  useEffect(() => {
    runAction(refreshAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isReloadKey = e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r");
      if (isReloadKey) {
        e.preventDefault();
        runAction(refreshAll);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [refreshAll]);

  async function handleSelect(sel: Selection) {
    setSelection(sel);
    setSelectedFile(null);
    setWorkingDiff(null);
    setConflictPath(null);
    setConflictContent(null);
    setSelectedCommitPath(null);
    setCommitFiles([]);
    if (sel.kind === "commit") {
      setCommitFilesLoading(true);
      try {
        const files = await api.getCommitDiff(repoPath, sel.id);
        setCommitFiles(files);
        if (files.length > 0) setSelectedCommitPath(files[0].path);
      } catch (e) {
        setError(String(e));
      } finally {
        setCommitFilesLoading(false);
      }
    }
  }

  async function handleSelectFile(sel: FileSelection) {
    setConflictPath(null);
    setConflictContent(null);
    setSelectedFile(sel);
    setWorkingDiffLoading(true);
    try {
      const diff = await api.getWorkingDiff(repoPath, sel.path, sel.staged);
      setWorkingDiff(diff);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorkingDiffLoading(false);
    }
  }

  async function loadConflictContent(path: string) {
    setConflictLoading(true);
    try {
      const content = await api.readWorkingFile(repoPath, path);
      setConflictContent(content);
    } catch (e) {
      setError(String(e));
    } finally {
      setConflictLoading(false);
    }
  }

  async function handleSelectConflict(path: string) {
    setSelectedFile(null);
    setWorkingDiff(null);
    setConflictPath(path);
    await loadConflictContent(path);
  }

  async function refreshWorkingSelection() {
    const [s, rs] = await Promise.all([api.getStatus(repoPath), api.getRepoState(repoPath)]);
    setStatus(s);
    setRepoState(rs);
    if (selectedFile) {
      const stillThere = (selectedFile.staged ? s.staged : s.unstaged).some(
        (f) => f.path === selectedFile.path
      );
      if (stillThere) {
        const diff = await api.getWorkingDiff(repoPath, selectedFile.path, selectedFile.staged);
        setWorkingDiff(diff);
      } else {
        setSelectedFile(null);
        setWorkingDiff(null);
      }
    }
    if (conflictPath) {
      const stillConflicted = s.conflicted.some((f) => f.path === conflictPath);
      if (!stillConflicted) {
        setConflictPath(null);
        setConflictContent(null);
      }
    }
  }

  const selectedCommit =
    selection?.kind === "commit" ? commits.find((c) => c.id === selection.id) ?? null : null;
  const isHeadCommit =
    !!selectedCommit && branches.some((b) => b.is_head && b.target === selectedCommit.id);
  const selectedCommitFileDiff =
    selectedCommit && selectedCommitPath
      ? commitFiles.find((f) => f.path === selectedCommitPath) ?? null
      : null;

  const searchQuery = commitSearch.trim().toLowerCase();
  const searchMatches = searchQuery
    ? commits.filter(
        (c) =>
          c.summary.toLowerCase().includes(searchQuery) ||
          c.message.toLowerCase().includes(searchQuery) ||
          c.author_name.toLowerCase().includes(searchQuery) ||
          c.refs.some((r) => r.toLowerCase().includes(searchQuery))
      )
    : [];
  const matchIds = new Set(searchMatches.map((c) => c.id));
  const currentMatchIndex = searchMatches.length > 0 ? matchIndex % searchMatches.length : -1;

  async function selectCommitAndScroll(id: string) {
    await handleSelect({ kind: "commit", id });
    requestAnimationFrame(() => {
      document.getElementById(`commit-row-${id}`)?.scrollIntoView({ block: "center" });
    });
  }

  function jumpToMatch(index: number) {
    if (searchMatches.length === 0) return;
    const wrapped = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length;
    setMatchIndex(wrapped);
    selectCommitAndScroll(searchMatches[wrapped].id);
  }

  function handleSearchChange(value: string) {
    setCommitSearch(value);
    setMatchIndex(0);
  }

  useEffect(() => {
    if (searchQuery && searchMatches.length > 0) {
      jumpToMatch(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  return (
    <div className="app">
      <TopBar
        status={status}
        busy={busy}
        onRefresh={() => runAction(async () => {
          await refreshAll();
          setInfo("Refreshed");
        })}
        onFetch={withGithubAuthRetry(async () => {
          await api.fetch(repoPath);
          await refreshAll();
          setInfo("Fetched");
        })}
        onPull={withGithubAuthRetry(async () => {
          const msg = await api.pull(repoPath);
          await refreshAll();
          setInfo(msg);
        })}
        onPush={() => {
          if (remotes.length === 0) {
            setNoRemoteChoiceOpen(true);
            return;
          }
          withGithubAuthRetry(async () => {
            if (!status?.branch) throw new Error("No current branch");
            const b = branches.find((br) => !br.is_remote && br.name === status.branch);
            await api.push(repoPath, "origin", status.branch, !b?.upstream);
            await refreshAll();
            setInfo("Pushed");
          })();
        }}
        onStash={() => setModal("stash")}
        onNewBranch={() => setModal("branch")}
      />

      {repoState && repoState.state !== "clean" && (
        <MergeRebaseBanner
          repoState={repoState}
          rebaseProgress={rebaseProgress}
          busy={busy}
          onContinueRebase={() =>
            runAction(async () => {
              const progress = await api.rebaseContinue(repoPath);
              setRebaseProgress(progress);
              await refreshAll();
              if (progress.status === "conflicts") {
                setSelection({ kind: "working" });
              } else {
                setInfo("Rebase complete");
              }
            })
          }
          onAbortRebase={() =>
            askConfirm(
              "Abort the in-progress rebase and restore the branch to its previous state?",
              () =>
                runAction(async () => {
                  await api.rebaseAbort(repoPath);
                  setRebaseProgress(null);
                  setConflictPath(null);
                  setConflictContent(null);
                  setSelectedFile(null);
                  setWorkingDiff(null);
                  await refreshAll();
                }),
              "Abort rebase"
            )
          }
          onAbortMerge={() =>
            askConfirm(
              "Abort the in-progress merge and discard merge changes?",
              () =>
                runAction(async () => {
                  await api.mergeAbort(repoPath);
                  setConflictPath(null);
                  setConflictContent(null);
                  setSelectedFile(null);
                  setWorkingDiff(null);
                  await refreshAll();
                }),
              "Abort merge"
            )
          }
        />
      )}

      {error && (
        <div className="error-banner dismissible" onClick={() => setError(null)}>
          {error}
        </div>
      )}
      {info && !error && (
        <div className="info-banner dismissible" onClick={() => setInfo(null)}>
          {info}
        </div>
      )}

      <div className="main-body">
        <Sidebar
          branches={branches}
          tags={tags}
          stashes={stashes}
          remotes={remotes}
          onAddRemote={() => setAddRemoteOpen(true)}
          onCheckout={(name) =>
            runAction(async () => {
              const already = branches.find((b) => b.is_head && b.name === name);
              if (already) {
                if (already.target) await selectCommitAndScroll(already.target);
                return;
              }
              await api.checkoutBranch(repoPath, name);
              await refreshAll();
              const fresh = await api.getBranches(repoPath);
              const head = fresh.find((b) => b.is_head);
              if (head?.target) await selectCommitAndScroll(head.target);
            })
          }
          onCreateBranch={() => setModal("branch")}
          onDeleteBranch={(name, isRemote) =>
            askConfirm(
              `Delete branch "${name}"?`,
              () =>
                runAction(async () => {
                  await api.deleteBranch(repoPath, name, isRemote);
                  await refreshAll();
                }),
              "Delete branch"
            )
          }
          onMergeBranch={(name) =>
            runAction(async () => {
              const outcome = await api.mergeBranch(repoPath, name);
              await refreshAll();
              if (outcome.status === "conflicts") {
                setSelection({ kind: "working" });
                setInfo(null);
              } else if (outcome.status === "up_to_date") {
                setInfo("Already up to date");
              } else if (outcome.status === "fast_forward") {
                setInfo(`Fast-forwarded to ${name}`);
              } else {
                setInfo(`Merged ${name}`);
              }
            })
          }
          onRebaseOnto={(name) =>
            askConfirm(
              `Rebase the current branch onto '${name}'? This rewrites commit history for the current branch.`,
              () =>
                runAction(async () => {
                  const progress = await api.startRebase(repoPath, name);
                  setRebaseProgress(progress);
                  await refreshAll();
                  if (progress.status === "conflicts") {
                    setSelection({ kind: "working" });
                  } else {
                    setInfo("Rebase complete");
                  }
                }),
              "Rebase"
            )
          }
          onStashApply={(i) =>
            runAction(async () => {
              await api.stashApply(repoPath, i);
              await refreshAll();
            })
          }
          onStashPop={(i) =>
            runAction(async () => {
              await api.stashPop(repoPath, i);
              await refreshAll();
            })
          }
          onStashDrop={(i) => {
            askConfirm("Drop this stash?", () =>
              runAction(async () => {
                await api.stashDrop(repoPath, i);
                await refreshAll();
              })
            );
          }}
        />

        <div className="graph-column">
          <div className="graph-search-bar">
            <input
              className="graph-search-input"
              placeholder="Search commits (message, author, ref)…"
              value={commitSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  jumpToMatch(currentMatchIndex + (e.shiftKey ? -1 : 1));
                }
              }}
            />
            {searchQuery && (
              <>
                <span className="graph-search-count">
                  {searchMatches.length > 0
                    ? `${currentMatchIndex + 1} of ${searchMatches.length}`
                    : "No matches"}
                </span>
                <div className="graph-search-nav">
                  <button
                    className="toolbar-btn"
                    disabled={searchMatches.length === 0}
                    onClick={() => jumpToMatch(currentMatchIndex - 1)}
                  >
                    ◂ Prev
                  </button>
                  <button
                    className="toolbar-btn"
                    disabled={searchMatches.length === 0}
                    onClick={() => jumpToMatch(currentMatchIndex + 1)}
                  >
                    Next ▸
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="graph-scroll-wrapper">
            <CommitGraph
              commits={commits}
              status={status}
              selection={selection}
              onSelect={handleSelect}
              matchIds={matchIds}
            />
          </div>
        </div>

        <div className="detail-column">
          {selection?.kind === "working" && status && (
            <ChangesPanel
              status={status}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              selectedConflictPath={conflictPath}
              onSelectConflict={handleSelectConflict}
              committing={committing}
              onStage={(path) =>
                runAction(async () => {
                  await api.stageFile(repoPath, path);
                  await refreshWorkingSelection();
                })
              }
              onUnstage={(path) =>
                runAction(async () => {
                  await api.unstageFile(repoPath, path);
                  await refreshWorkingSelection();
                })
              }
              onStageAll={() =>
                runAction(async () => {
                  await api.stageAll(repoPath);
                  await refreshWorkingSelection();
                })
              }
              onUnstageAll={() =>
                runAction(async () => {
                  await api.unstageAll(repoPath);
                  await refreshWorkingSelection();
                })
              }
              onDiscard={(path) =>
                askConfirm(
                  `Discard changes to "${path}"? This cannot be undone.`,
                  () =>
                    runAction(async () => {
                      await api.discardFileChanges(repoPath, path);
                      await refreshWorkingSelection();
                    }),
                  "Discard"
                )
              }
              onCommit={(message) => {
                setCommitting(true);
                runAction(async () => {
                  await api.commit(repoPath, message);
                  await refreshAll();
                  setSelection(null);
                  setSelectedFile(null);
                  setWorkingDiff(null);
                }).finally(() => setCommitting(false));
              }}
            />
          )}

          {selectedCommit && (
            <CommitDetails
              commit={selectedCommit}
              files={commitFiles}
              loading={commitFilesLoading}
              selectedPath={selectedCommitPath}
              onSelectPath={setSelectedCommitPath}
              isHead={isHeadCommit}
              onReset={(mode) => {
                const messages: Record<string, string> = {
                  soft: `Soft reset the current branch to "${selectedCommit.short_id}"? This moves the branch pointer here but keeps all changes staged.`,
                  mixed: `Mixed reset the current branch to "${selectedCommit.short_id}"? This moves the branch pointer here and unstages changes, but keeps them in your working directory.`,
                  hard: `Hard reset the current branch to "${selectedCommit.short_id}"? This discards ALL uncommitted changes and makes any commits after this point unreachable. This cannot be undone.`,
                };
                askConfirm(
                  messages[mode],
                  () =>
                    runAction(async () => {
                      await api.resetToCommit(repoPath, selectedCommit.id, mode);
                      await refreshAll();
                      setSelection(null);
                      setSelectedFile(null);
                      setWorkingDiff(null);
                    }),
                  mode === "hard" ? "Hard reset" : "Reset"
                );
              }}
            />
          )}

          {!selection && (
            <div className="diff-view empty">Select a commit or "Uncommitted changes" to view details</div>
          )}
        </div>

        <div className="diff-column">
          {selection?.kind === "working" && conflictPath && (
            <ConflictView
              path={conflictPath}
              content={conflictContent}
              loading={conflictLoading}
              onUseOurs={() =>
                runAction(async () => {
                  await api.resolveConflict(repoPath, conflictPath, "ours");
                  await refreshWorkingSelection();
                  setConflictPath(null);
                  setConflictContent(null);
                })
              }
              onUseTheirs={() =>
                runAction(async () => {
                  await api.resolveConflict(repoPath, conflictPath, "theirs");
                  await refreshWorkingSelection();
                  setConflictPath(null);
                  setConflictContent(null);
                })
              }
              onSave={(newContent) =>
                runAction(async () => {
                  await api.writeWorkingFile(repoPath, conflictPath, newContent);
                  await api.stageFile(repoPath, conflictPath);
                  await refreshWorkingSelection();
                  setConflictPath(null);
                  setConflictContent(null);
                })
              }
              onReload={() => runAction(() => loadConflictContent(conflictPath))}
            />
          )}
          {selection?.kind === "working" && !conflictPath && (
            <DiffView diff={workingDiff} loading={workingDiffLoading} />
          )}
          {selection?.kind === "commit" && (
            <DiffView diff={selectedCommitFileDiff} loading={commitFilesLoading} />
          )}
          {!selection && <div className="diff-view empty" />}
        </div>
      </div>

      {modal === "branch" && (
        <PromptModal
          title="Create new branch"
          placeholder="branch-name"
          confirmLabel="Create"
          onCancel={() => setModal(null)}
          onConfirm={(name) => {
            setModal(null);
            runAction(async () => {
              await api.createBranch(repoPath, name, null, true);
              await refreshAll();
            });
          }}
        />
      )}

      {modal === "stash" && (
        <PromptModal
          title="Stash changes"
          placeholder="Stash message (optional)"
          confirmLabel="Stash"
          allowEmpty
          onCancel={() => setModal(null)}
          onConfirm={(msg) => {
            setModal(null);
            runAction(async () => {
              await api.stashSave(repoPath, msg || null, true);
              await refreshAll();
            });
          }}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState.onConfirm;
            setConfirmState(null);
            action();
          }}
        />
      )}

      {addRemoteOpen && (
        <AddRemoteModal
          onCancel={() => setAddRemoteOpen(false)}
          onConfirm={(name, url) => {
            setAddRemoteOpen(false);
            runAction(async () => {
              await api.addRemote(repoPath, name, url);
              await refreshAll();
              setInfo(`Added remote "${name}"`);
            });
          }}
        />
      )}

      {noRemoteChoiceOpen && (
        <div className="modal-backdrop" onClick={() => setNoRemoteChoiceOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">There are no remotes to push to. Would you like to add one?</p>
            <div className="modal-actions">
              <button className="toolbar-btn subtle" onClick={() => setNoRemoteChoiceOpen(false)}>
                Cancel
              </button>
              <button
                className="toolbar-btn"
                onClick={() => {
                  setNoRemoteChoiceOpen(false);
                  setAddRemoteOpen(true);
                }}
              >
                Add existing remote…
              </button>
              <button
                className="primary-btn"
                onClick={() => {
                  setNoRemoteChoiceOpen(false);
                  setGithubPushOpen(true);
                }}
              >
                Create on GitHub…
              </button>
            </div>
          </div>
        </div>
      )}

      {githubPushOpen && (
        <GitHubModal
          purpose="push"
          suggestedName={repoPath.split(/[/\\]/).filter(Boolean).pop()}
          onCancel={() => setGithubPushOpen(false)}
          onCloned={() => {}}
          onRepoReady={(repo) => {
            setGithubPushOpen(false);
            runAction(async () => {
              await api.addRemote(repoPath, "origin", repo.clone_url);
              await refreshAll();
              if (!status?.branch) throw new Error("No current branch");
              await api.push(repoPath, "origin", status.branch, true);
              await refreshAll();
              setInfo(`Created ${repo.full_name} and pushed`);
            });
          }}
          onError={(msg) => {
            setGithubPushOpen(false);
            setError(msg);
          }}
        />
      )}

      {needsGithubAuthOpen && (
        <GitHubModal
          purpose="signin"
          onCancel={() => {
            setNeedsGithubAuthOpen(false);
            pendingGithubRetryRef.current = null;
          }}
          onRepoReady={() => {}}
          onCloned={() => {}}
          onSignedIn={() => {
            setNeedsGithubAuthOpen(false);
            const retry = pendingGithubRetryRef.current;
            pendingGithubRetryRef.current = null;
            retry?.();
          }}
          onError={(msg) => {
            setNeedsGithubAuthOpen(false);
            pendingGithubRetryRef.current = null;
            setError(msg);
          }}
        />
      )}
    </div>
  );
}
