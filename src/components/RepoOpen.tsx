import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getLastDir, rememberDir } from "../lastDir";
import { api } from "../api";
import GitHubModal from "./GitHubModal";

interface Props {
  onOpen: (path: string) => void;
  onCreate: (path: string) => void;
  onClone: () => void;
  onHelp: () => void;
  error: string | null;
}

export default function RepoOpen({ onOpen, onCreate, onClone, onHelp, error }: Props) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    api
      .githubIsSignedIn()
      .then(setSignedIn)
      .catch(() => setSignedIn(false));
  }, []);
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
        <button className="toolbar-btn" onClick={onClone}>
          Clone from GitHub…
        </button>
        {signedIn === false && (
          <button className="toolbar-btn" onClick={() => setSignInOpen(true)}>
            Sign in to GitHub…
          </button>
        )}
      </div>
      <button className="link-btn repo-open-help" onClick={onHelp}>
        Need help getting started?
      </button>
      {error && <div className="error-banner">{error}</div>}
      {signInOpen && (
        <GitHubModal
          purpose="signin"
          onCancel={() => setSignInOpen(false)}
          onRepoReady={() => {}}
          onCloned={() => {}}
          onSignedIn={() => {
            setSignedIn(true);
            setSignInOpen(false);
          }}
          onError={() => setSignInOpen(false)}
        />
      )}
    </div>
  );
}
