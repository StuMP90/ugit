export interface RepoTab {
  id: string;
  path: string;
  name: string;
}

interface Props {
  tabs: RepoTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
}

export default function TabBar({ tabs, activeId, onSelect, onClose, onNewTab }: Props) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={"tab" + (tab.id === activeId ? " active" : "")}
          onClick={() => onSelect(tab.id)}
          title={tab.path}
        >
          <span className="tab-label">{tab.name}</span>
          <button
            className="tab-close"
            title="Close repository"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="tab-new" title="Open another repository" onClick={onNewTab}>
        +
      </button>
    </div>
  );
}
