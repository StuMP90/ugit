import { open } from "@tauri-apps/plugin-dialog";

const LAST_DIR_KEY = "ugit:lastDir";

function parentDir(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

function getLastDir(): string | undefined {
  try {
    return localStorage.getItem(LAST_DIR_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberDir(path: string) {
  try {
    localStorage.setItem(LAST_DIR_KEY, parentDir(path));
  } catch {
    // ignore — falls back to the platform default next time
  }
}

interface Props {
  onOpen: (path: string) => void;
  onCreate: (path: string) => void;
  onHelp: () => void;
  error: string | null;
}

export default function RepoOpen({ onOpen, onCreate, onHelp, error }: Props) {
  async function pickFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open Git Repository",
      defaultPath: getLastDir(),
    });
    if (typeof selected === "string") {
      rememberDir(selected);
      onOpen(selected);
    }
  }

  async function pickFolderForNew() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose a Folder for the New Repository",
      defaultPath: getLastDir(),
    });
    if (typeof selected === "string") {
      rememberDir(selected);
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
