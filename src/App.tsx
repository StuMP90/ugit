import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import RepoOpen from "./components/RepoOpen";
import TabBar, { RepoTab } from "./components/TabBar";
import HelpModal from "./components/HelpModal";
import GitHubModal from "./components/GitHubModal";
import RepoView from "./RepoView";
import type { RepoSummary } from "./types";
import "./App.css";

const SESSION_KEY = "ugit:openTabs";

interface SavedSession {
  paths: string[];
  activePath: string | null;
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: SavedSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore — session just won't be restored next launch
  }
}

export default function App() {
  const [tabs, setTabs] = useState<RepoTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const restoringRef = useRef(true);

  useEffect(() => {
    const session = loadSession();
    if (!session || session.paths.length === 0) {
      restoringRef.current = false;
      setRestoring(false);
      return;
    }
    (async () => {
      const restored: RepoTab[] = [];
      for (const path of session.paths) {
        try {
          const summary = await api.openRepository(path);
          restored.push({ id: `${summary.path}-${Date.now()}-${restored.length}`, path: summary.path, name: summary.name });
        } catch {
          // repo no longer exists / moved — silently drop it from the restored session
        }
      }
      setTabs(restored);
      const match = restored.find((t) => t.path === session.activePath);
      setActiveId(match ? match.id : restored[0]?.id ?? null);
      restoringRef.current = false;
      setRestoring(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restoringRef.current) return;
    const activePath = tabs.find((t) => t.id === activeId)?.path ?? null;
    saveSession({ paths: tabs.map((t) => t.path), activePath });
  }, [tabs, activeId]);

  function addTab(summary: RepoSummary) {
    const existing = tabs.find((t) => t.path === summary.path);
    if (existing) {
      setActiveId(existing.id);
      return;
    }
    const id = `${summary.path}-${Date.now()}`;
    setTabs((prev) => [...prev, { id, path: summary.path, name: summary.name }]);
    setActiveId(id);
  }

  async function handleOpen(path: string) {
    setOpenError(null);
    try {
      addTab(await api.openRepository(path));
    } catch (e) {
      setOpenError(String(e));
    }
  }

  async function handleCreate(path: string) {
    setOpenError(null);
    try {
      addTab(await api.initRepository(path));
    } catch (e) {
      setOpenError(String(e));
    }
  }

  function handleClose(id: string) {
    setTabs((prev) => {
      const closingIndex = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (activeId === id) {
        const fallback = next[closingIndex] ?? next[closingIndex - 1] ?? null;
        setActiveId(fallback ? fallback.id : null);
      }
      return next;
    });
  }

  if (restoring) {
    return <div className="app-restoring" />;
  }

  const cloneModal = cloneOpen && (
    <GitHubModal
      purpose="clone"
      onCancel={() => setCloneOpen(false)}
      onRepoReady={() => {}}
      onCloned={async (path) => {
        setCloneOpen(false);
        await handleOpen(path);
      }}
      onError={(msg) => {
        setCloneOpen(false);
        setOpenError(msg);
      }}
    />
  );

  if (tabs.length === 0) {
    return (
      <>
        <RepoOpen
          onOpen={handleOpen}
          onCreate={handleCreate}
          onClone={() => setCloneOpen(true)}
          onHelp={() => setHelpOpen(true)}
          error={openError}
        />
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
        {cloneModal}
      </>
    );
  }

  return (
    <div className="app-shell">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={handleClose}
        onNewTab={() => setActiveId(null)}
        onHelp={() => setHelpOpen(true)}
      />
      <div className="app-shell-body">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="app-shell-pane"
            style={{ display: tab.id === activeId ? "flex" : "none" }}
          >
            <RepoView repoPath={tab.path} />
          </div>
        ))}
        {activeId === null && (
          <RepoOpen
            onOpen={handleOpen}
            onCreate={handleCreate}
            onClone={() => setCloneOpen(true)}
            onHelp={() => setHelpOpen(true)}
            error={openError}
          />
        )}
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {cloneModal}
    </div>
  );
}
