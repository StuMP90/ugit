import { useState } from "react";
import { api } from "./api";
import RepoOpen from "./components/RepoOpen";
import TabBar, { RepoTab } from "./components/TabBar";
import HelpModal from "./components/HelpModal";
import RepoView from "./RepoView";
import type { RepoSummary } from "./types";
import "./App.css";

export default function App() {
  const [tabs, setTabs] = useState<RepoTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

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

  if (tabs.length === 0) {
    return (
      <>
        <RepoOpen
          onOpen={handleOpen}
          onCreate={handleCreate}
          onHelp={() => setHelpOpen(true)}
          error={openError}
        />
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
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
            onHelp={() => setHelpOpen(true)}
            error={openError}
          />
        )}
      </div>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
