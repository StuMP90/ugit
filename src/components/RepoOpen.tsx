import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onOpen: (path: string) => void;
  onCreate: (path: string) => void;
  onHelp: () => void;
  error: string | null;
}

export default function RepoOpen({ onOpen, onCreate, onHelp, error }: Props) {
  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false, title: "Open Git Repository" });
    if (typeof selected === "string") {
      onOpen(selected);
    }
  }

  async function pickFolderForNew() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose a Folder for the New Repository",
    });
    if (typeof selected === "string") {
      onCreate(selected);
    }
  }

  return (
    <div className="repo-open">
      <h1>uGit</h1>
      <p>An interactive git client</p>
      <div className="repo-open-actions">
        <button className="primary-btn" onClick={pickFolder}>
          Open Repository…
        </button>
        <button className="toolbar-btn" onClick={pickFolderForNew}>
          New Repository…
        </button>
      </div>
      <button className="link-btn repo-open-help" onClick={onHelp}>
        Need help getting started?
      </button>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
