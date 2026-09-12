import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onOpen: (path: string) => void;
  error: string | null;
}

export default function RepoOpen({ onOpen, error }: Props) {
  async function pickFolder() {
    const selected = await open({ directory: true, multiple: false, title: "Open Git Repository" });
    if (typeof selected === "string") {
      onOpen(selected);
    }
  }

  return (
    <div className="repo-open">
      <h1>uGit</h1>
      <p>An interactive git client</p>
      <button className="primary-btn" onClick={pickFolder}>
        Open Repository…
      </button>
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}
