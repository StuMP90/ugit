import type { SshStatus } from "./types";

// Matches a github.com remote URL in any form git produces: the
// `git@github.com:owner/repo.git` scp-like syntax, `ssh://git@github.com/…`,
// or `https://github.com/…` — used to gate GitHub-specific UI (Releases)
// that would just fail for e.g. a GitLab or Bitbucket remote.
export function isGithubRemoteUrl(url: string): boolean {
  return /(^|@|\/)github\.com[:/]/.test(url);
}

// Whether an SSH key uGit could actually push with is configured — either
// the custom key picked in Settings, or one of the default `~/.ssh` names.
export function hasUsableSshKey(status: SshStatus): boolean {
  return status.custom_key_exists || status.default_keys.some((k) => k.exists);
}

// Picks which clone URL to wire up a newly created/linked GitHub remote
// with: SSH when uGit has a key it can actually push with (avoids the
// OAuth App's restricted `workflow` scope entirely), HTTPS otherwise.
export function preferredCloneUrl(
  repo: { clone_url: string; ssh_url: string },
  sshStatus: SshStatus
): string {
  return hasUsableSshKey(sshStatus) ? repo.ssh_url : repo.clone_url;
}
