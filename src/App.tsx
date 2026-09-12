import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type {
  BranchInfo,
  CommitInfo,
  FileDiff,
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
import RepoOpen from "./components/RepoOpen";
import PromptModal from "./components/PromptModal";
import "./App.css";

type Modal = null | "branch" | "stash";

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

  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileSelection | null>(null);
  const [workingDiff, setWorkingDiff] = useState<FileDiff | null>(null);
  const [workingDiffLoading, setWorkingDiffLoading] = useState(false);

  const [commitFiles, setCommitFiles] = useState<FileDiff[]>([]);
  const [commitFilesLoading, setCommitFilesLoading] = useState(false);
  const [selectedCommitPath, setSelectedCommitPath] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

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
    const [s, l, b, t, st] = await Promise.all([
      api.getStatus(),
      api.getLog(500),
      api.getBranches(),
      api.getTags(),
      api.stashList(),
    ]);
    setStatus(s);
    setCommits(l);
    setBranches(b);
    setTags(t);
    setStashes(st);
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
    } catch (e) {
      setOpenError(String(e));
    }
  }

  async function handleSelect(sel: Selection) {
    setSelection(sel);
    setSelectedFile(null);
    setWorkingDiff(null);
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

  async function refreshWorkingSelection() {
    const s = await api.getStatus();
    setStatus(s);
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
          onDeleteBranch={(name, isRemote) => {
            if (!window.confirm(`Delete branch "${name}"?`)) return;
            runAction(async () => {
              await api.deleteBranch(name, isRemote);
              await refreshAll();
            });
          }}
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
            if (!window.confirm("Drop this stash?")) return;
            runAction(async () => {
              await api.stashDrop(i);
              await refreshAll();
            });
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
              onDiscard={(path) => {
                if (!window.confirm(`Discard changes to "${path}"? This cannot be undone.`)) return;
                runAction(async () => {
                  await api.discardFileChanges(path);
                  await refreshWorkingSelection();
                });
              }}
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
          {selection?.kind === "working" && (
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
    </div>
  );
}
