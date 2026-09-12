import { useState } from "react";

interface Topic {
  id: string;
  title: string;
  body: React.ReactNode;
}

const TOPICS: Topic[] = [
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
          uGit can't create the repository on GitHub/GitLab/Bitbucket itself — that needs the
          site's API and an access token, which isn't wired up yet. The steps today:
        </p>
        <p>
          <strong>1.</strong> On the hosting site, create a new, empty repository (don't let it
          add a README, license, or .gitignore — an empty local and empty remote merge cleanest).
        </p>
        <p>
          <strong>2.</strong> Copy the URL it gives you (SSH form is usually easiest, e.g.{" "}
          <code>git@github.com:you/repo.git</code>).
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
  const [openId, setOpenId] = useState<string>(TOPICS[0].id);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h3>Help</h3>
          <button className="icon-btn" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="help-modal-body">
          {TOPICS.map((topic) => {
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
      </div>
    </div>
  );
}
