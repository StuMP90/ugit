import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import SshKeyModal from "./SshKeyModal";

const REPO_URL = "https://github.com/StuMP90/ugit";

interface Topic {
  id: string;
  title: string;
  body: React.ReactNode;
}

function sshKeysTopic(onManage: () => void): Topic {
  return {
    id: "ssh-keys",
    title: "Set up an SSH key for GitHub",
    body: (
      <>
        <p>
          If you don't already have SSH set up with GitHub, uGit can generate a new key for you
          (or use one you already have) — click <strong>Manage SSH keys…</strong> below. Either
          way, the private key never leaves this machine; only the public half gets pasted into
          GitHub.
        </p>
        <div className="modal-actions">
          <button className="toolbar-btn" onClick={onManage}>
            Manage SSH keys…
          </button>
        </div>
      </>
    ),
  };
}

const TOPICS: Topic[] = [
  {
    id: "securing-ssh-keys-windows",
    title: "Securing SSH keys on Windows",
    body: (
      <>
        <p>
          Windows' OpenSSH client checks a private key file's NTFS permissions, not Unix-style
          permission bits — if anyone other than you (SYSTEM/Administrators are exempted) can
          read it, it's silently rejected with something like{" "}
          <em>"Permissions ... are too open. This private key will be ignored."</em> A key just
          written to disk usually inherits its folder's permissions, which are typically too
          open, so this can affect a key you created manually, copied from another machine, or
          generated with a uGit version older than 0.1.10 (from 0.1.10 on, uGit fixes this
          automatically for keys it generates).
        </p>
        <p>
          <strong>PowerShell</strong> — replace the path with your key's:
        </p>
        <pre>{`icacls "C:\\path\\to\\your\\key" /inheritance:r
icacls "C:\\path\\to\\your\\key" /grant:r "$($env:USERNAME):(R)"`}</pre>
        <p>
          The first command strips inherited permissions (usually the source of the problem); the
          second grants read access to just your own account. Target the private key file itself
          (no <code>.pub</code> extension) — the public key's permissions don't matter.
        </p>
        <p>
          <strong>Or, using File Explorer:</strong>
        </p>
        <p>
          Right-click the key file → <strong>Properties</strong> → <strong>Security</strong> tab
          → <strong>Advanced</strong> → <strong>Disable inheritance</strong> → "Remove all
          inherited permissions from this object" → then add an entry granting only your own user
          account Read access.
        </p>
        <p>
          <strong>To verify it worked:</strong> point <strong>Manage SSH keys… → Use existing
          key…</strong> at the file, then click <strong>Test connection</strong> — or run{" "}
          <code>ssh -T git@github.com -i "C:\path\to\your\key"</code> directly. If it's still
          rejected, the error names the exact problem.
        </p>
      </>
    ),
  },
  {
    id: "ssh-aliases",
    title: "Using multiple accounts (e.g. personal + work GitHub)",
    body: (
      <>
        <p>
          uGit doesn't have a credential manager yet — it authenticates the same way the{" "}
          <code>git</code> command line does (your SSH agent, an SSH key file, or your system's
          git credential helper). The standard way to use two different identities with the same
          host (e.g. two GitHub accounts) is an SSH config alias, which needs no changes in uGit
          at all.
        </p>
        <p>
          <strong>1.</strong> Add an entry per account to <code>~/.ssh/config</code>:
        </p>
        <pre>{`Host github.com-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_personal

Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_work`}</pre>
        <p>
          <strong>2.</strong> Use the alias host in the remote URL instead of{" "}
          <code>github.com</code>:
        </p>
        <pre>{`git@github.com-personal:yourname/personal-repo.git
git@github.com-work:yourcompany/work-repo.git`}</pre>
        <p>
          Set this when you add the remote (see "Connect a local repository to an existing
          remote" below) — uGit's SSH-agent lookup will then pick up whichever key the alias
          points at automatically.
        </p>
      </>
    ),
  },
  {
    id: "new-repo",
    title: "Create a new local repository",
    body: (
      <>
        <p>
          Click <strong>New Repository…</strong> on the open-repo screen (or the "+" tab, then New
          Repository), then choose or create a folder. That's the same as running:
        </p>
        <pre>{`git init`}</pre>
        <p>in that folder — uGit then opens it as a normal empty repository, ready to add files and commit.</p>
      </>
    ),
  },
  {
    id: "link-remote",
    title: "Connect a local repository to an existing remote",
    body: (
      <>
        <p>
          With the repo open, find <strong>Remotes</strong> in the left sidebar and click the "+"
          next to it. Give it a name (usually <code>origin</code>) and the remote's URL — this is
          equivalent to:
        </p>
        <pre>{`git remote add origin <url>`}</pre>
        <p>
          Once it's added, use the <strong>Push</strong> button in the top bar — the first push
          from a branch with no upstream will set one automatically (like{" "}
          <code>git push -u origin &lt;branch&gt;</code>).
        </p>
      </>
    ),
  },
  {
    id: "new-remote",
    title: "Create a brand-new remote from a local repo",
    body: (
      <>
        <p>
          For GitHub specifically, uGit can do this for you: hit <strong>Push</strong> on a repo
          with no remotes and choose <strong>Create on GitHub…</strong>. It'll ask you to sign in
          (a device code you approve in your browser, no password stored in uGit), then let you
          name the new repository, set it public or private, and it creates it, sets it as{" "}
          <code>origin</code>, and pushes — all in one step.
        </p>
        <p>For any other host (GitLab, Bitbucket, etc.), the steps are still manual:</p>
        <p>
          <strong>1.</strong> On the hosting site, create a new, empty repository (don't let it
          add a README, license, or .gitignore — an empty local and empty remote merge cleanest).
        </p>
        <p>
          <strong>2.</strong> Copy the URL it gives you (SSH form is usually easiest, e.g.{" "}
          <code>git@gitlab.com:you/repo.git</code>).
        </p>
        <p>
          <strong>3.</strong> Back in uGit, follow "Connect a local repository to an existing
          remote" above using that URL, then <strong>Push</strong>.
        </p>
      </>
    ),
  },
];

interface Props {
  onClose: () => void;
}

export default function HelpModal({ onClose }: Props) {
  const [openId, setOpenId] = useState<string>("ssh-keys");
  const [version, setVersion] = useState<string | null>(null);
  const [sshModalOpen, setSshModalOpen] = useState(false);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  const topics = [sshKeysTopic(() => setSshModalOpen(true)), ...TOPICS];

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
          <div className="help-modal-header">
            <h3>Help</h3>
            <button className="icon-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
          <div className="help-modal-body">
            {topics.map((topic) => {
              const isOpen = topic.id === openId;
              return (
                <div className="help-topic" key={topic.id}>
                  <div
                    className="help-topic-header"
                    onClick={() => setOpenId(isOpen ? "" : topic.id)}
                  >
                    <span className="sidebar-caret">{isOpen ? "▾" : "▸"}</span>
                    <span>{topic.title}</span>
                  </div>
                  {isOpen && <div className="help-topic-body">{topic.body}</div>}
                </div>
              );
            })}
          </div>
          <div className="help-modal-footer">
            <span>{version ? `uGit v${version}` : "uGit"}</span>
            <span className="help-modal-footer-sep">·</span>
            <button className="link-btn" onClick={() => openUrl(REPO_URL).catch(() => {})}>
              GitHub: StuMP90/ugit
            </button>
          </div>
        </div>
      </div>
      {sshModalOpen && <SshKeyModal onClose={() => setSshModalOpen(false)} />}
    </>
  );
}
