import { useState } from "react";
import { api } from "./api";
import RepoOpen from "./components/RepoOpen";
import TabBar, { RepoTab } from "./components/TabBar";
import RepoView from "./RepoView";
import "./App.css";

export default function App() {
  const [tabs, setTabs] = useState<RepoTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function handleOpen(path: string) {
    setOpenError(null);
    try {
      const summary = await api.openRepository(path);
      const existing = tabs.find((t) => t.path === summary.path);
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const id = `${summary.path}-${Date.now()}`;
      setTabs((prev) => [...prev, { id, path: summary.path, name: summary.name }]);
      setActiveId(id);
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
    return <RepoOpen onOpen={handleOpen} error={openError} />;
  }

  return (
    <div className="app-shell">
      <TabBar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={handleClose}
        onNewTab={() => setActiveId(null)}
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
        {activeId === null && <RepoOpen onOpen={handleOpen} error={openError} />}
      </div>
    </div>
  );
}
