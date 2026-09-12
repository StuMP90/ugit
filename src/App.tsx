import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type {
  BranchInfo,
  CommitInfo,
  FileDiff,
  RebaseProgress,
  RepoState,
  RepoStatus,
  RepoSummary,
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
import RepoOpen from "./components/RepoOpen";
import PromptModal from "./components/PromptModal";
import ConfirmDialog from "./components/ConfirmDialog";
import "./App.css";

type Modal = null | "branch" | "stash";

interface ConfirmState {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export default function App() {
  const [repo, setRepo] = useState<RepoSummary | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
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
      api.getStatus(),
      api.getLog(500),
      api.getBranches(),
      api.getTags(),
      api.stashList(),
      api.getRepoState(),
    ]);
    setStatus(s);
    setCommits(l);
    setBranches(b);
    setTags(t);
    setStashes(st);
    setRepoState(rs);
  }, []);

  useEffect(() => {
    if (repo) {
      runAction(refreshAll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  async function handleOpenRepo(path: string) {
    setOpenError(null);
    try {
      const summary = await api.openRepository(path);
      setRepo(summary);
      setSelection(null);
      setSelectedFile(null);
      setWorkingDiff(null);
      setConflictPath(null);
      setConflictContent(null);
      setRebaseProgress(null);
    } catch (e) {
      setOpenError(String(e));
    }
  }

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
        const files = await api.getCommitDiff(sel.id);
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
      const diff = await api.getWorkingDiff(sel.path, sel.staged);
      setWorkingDiff(diff);
    } catch (e) {
      setError(String(e));
    } finally {
      setWorkingDiffLoading(false);
    }
  }

  async function handleSelectConflict(path: string) {
    setSelectedFile(null);
    setWorkingDiff(null);
    setConflictPath(path);
    setConflictLoading(true);
    try {
      const content = await api.readWorkingFile(path);
      setConflictContent(content);
    } catch (e) {
      setError(String(e));
    } finally {
      setConflictLoading(false);
    }
  }

  async function refreshWorkingSelection() {
    const [s, rs] = await Promise.all([api.getStatus(), api.getRepoState()]);
    setStatus(s);
    setRepoState(rs);
    if (selectedFile) {
      const stillThere = (selectedFile.staged ? s.staged : s.unstaged).some(
        (f) => f.path === selectedFile.path
      );
      if (stillThere) {
        const diff = await api.getWorkingDiff(selectedFile.path, selectedFile.staged);
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

  if (!repo) {
    return <RepoOpen onOpen={handleOpenRepo} error={openError} />;
  }

  return (
    <div className="app">
      <TopBar
        repo={repo}
        status={status}
        busy={busy}
        onFetch={() => runAction(async () => {
          await api.fetch();
          await refreshAll();
          setInfo("Fetched");
        })}
        onPull={() => runAction(async () => {
          const msg = await api.pull();
          await refreshAll();
          setInfo(msg);
        })}
        onPush={() => runAction(async () => {
          if (!status?.branch) throw new Error("No current branch");
          const b = branches.find((br) => !br.is_remote && br.name === status.branch);
          await api.push("origin", status.branch, !b?.upstream);
          await refreshAll();
          setInfo("Pushed");
        })}
        onStash={() => setModal("stash")}
        onNewBranch={() => setModal("branch")}
        onCloseRepo={() => {
          setRepo(null);
          setSelection(null);
        }}
      />

      {repoState && repoState.state !== "clean" && (
        <MergeRebaseBanner
          repoState={repoState}
          rebaseProgress={rebaseProgress}
          busy={busy}
          onContinueRebase={() =>
            runAction(async () => {
              const progress = await api.rebaseContinue();
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
                  await api.rebaseAbort();
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
                  await api.mergeAbort();
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
              await api.checkoutBranch(name);
              await refreshAll();
            })
          }
          onCreateBranch={() => setModal("branch")}
          onDeleteBranch={(name, isRemote) =>
            askConfirm(
              `Delete branch "${name}"?`,
              () =>
                runAction(async () => {
                  await api.deleteBranch(name, isRemote);
                  await refreshAll();
                }),
              "Delete branch"
            )
          }
          onMergeBranch={(name) =>
            runAction(async () => {
              const outcome = await api.mergeBranch(name);
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
                  const progress = await api.startRebase(name);
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
              await api.stashApply(i);
              await refreshAll();
            })
          }
          onStashPop={(i) =>
            runAction(async () => {
              await api.stashPop(i);
              await refreshAll();
            })
          }
          onStashDrop={(i) => {
            askConfirm("Drop this stash?", () =>
              runAction(async () => {
                await api.stashDrop(i);
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
                  await api.stageFile(path);
                  await refreshWorkingSelection();
                })
              }
              onUnstage={(path) =>
                runAction(async () => {
                  await api.unstageFile(path);
                  await refreshWorkingSelection();
                })
              }
              onStageAll={() =>
                runAction(async () => {
                  await api.stageAll();
                  await refreshWorkingSelection();
                })
              }
              onUnstageAll={() =>
                runAction(async () => {
                  await api.unstageAll();
                  await refreshWorkingSelection();
                })
              }
              onDiscard={(path) =>
                askConfirm(
                  `Discard changes to "${path}"? This cannot be undone.`,
                  () =>
                    runAction(async () => {
                      await api.discardFileChanges(path);
                      await refreshWorkingSelection();
                    }),
                  "Discard"
                )
              }
              onCommit={(message) => {
                setCommitting(true);
                runAction(async () => {
                  await api.commit(message);
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
                  await api.resolveConflict(conflictPath, "ours");
                  await refreshWorkingSelection();
                  setConflictPath(null);
                  setConflictContent(null);
                })
              }
              onUseTheirs={() =>
                runAction(async () => {
                  await api.resolveConflict(conflictPath, "theirs");
                  await refreshWorkingSelection();
                  setConflictPath(null);
                  setConflictContent(null);
                })
              }
              onMarkResolved={() =>
                runAction(async () => {
                  await api.stageFile(conflictPath);
                  await refreshWorkingSelection();
                  setConflictPath(null);
                  setConflictContent(null);
                })
              }
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
              await api.createBranch(name, null, true);
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
              await api.stashSave(msg || null, true);
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
