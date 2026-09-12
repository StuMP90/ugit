import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type {
  BranchInfo,
  CommitInfo,
  FileDiff,
  RebaseProgress,
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
    const [s, l, b, t, st, rs] = await Promise.all([
      api.getStatus(repoPath),
      api.getLog(repoPath, 500),
      api.getBranches(repoPath),
      api.getTags(repoPath),
      api.stashList(repoPath),
      api.getRepoState(repoPath),
    ]);
    setStatus(s);
    setCommits(l);
    setBranches(b);
    setTags(t);
    setStashes(st);
    setRepoState(rs);
  }, [repoPath]);

  useEffect(() => {
    runAction(refreshAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

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
  const selectedCommitFileDiff =
    selectedCommit && selectedCommitPath
      ? commitFiles.find((f) => f.path === selectedCommitPath) ?? null
      : null;

  return (
    <div className="app">
      <TopBar
        status={status}
        busy={busy}
        onFetch={() => runAction(async () => {
          await api.fetch(repoPath);
          await refreshAll();
          setInfo("Fetched");
        })}
        onPull={() => runAction(async () => {
          const msg = await api.pull(repoPath);
          await refreshAll();
          setInfo(msg);
        })}
        onPush={() => runAction(async () => {
          if (!status?.branch) throw new Error("No current branch");
          const b = branches.find((br) => !br.is_remote && br.name === status.branch);
          await api.push(repoPath, "origin", status.branch, !b?.upstream);
          await refreshAll();
          setInfo("Pushed");
        })}
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
          onCheckout={(name) =>
            runAction(async () => {
              await api.checkoutBranch(repoPath, name);
              await refreshAll();
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
          <CommitGraph
            commits={commits}
            status={status}
            selection={selection}
            onSelect={handleSelect}
          />
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
    </div>
  );
}
