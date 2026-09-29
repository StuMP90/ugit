// Matches a github.com remote URL in any form git produces: the
// `git@github.com:owner/repo.git` scp-like syntax, `ssh://git@github.com/…`,
// or `https://github.com/…` — used to gate GitHub-specific UI (Releases)
// that would just fail for e.g. a GitLab or Bitbucket remote.
export function isGithubRemoteUrl(url: string): boolean {
  return /(^|@|\/)github\.com[:/]/.test(url);
}
