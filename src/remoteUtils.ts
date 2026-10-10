import type { BranchInfo, RemoteInfo } from "./types";

/**
 * Picks which remote an action without an explicitly chosen target should
 * use — the current branch's configured upstream remote if it has one
 * (mirrors what plain `git push`/`git pull` with no arguments would do),
 * falling back to the only remote if there's just one, then a remote
 * literally named "origin" if present, then whichever remote happens to be
 * first. Deliberately never *assumes* a remote is named "origin" — a repo
 * set up by another tool (or a user who renamed it) can have its only
 * remote called anything.
 */
export function resolveDefaultRemote(
  branches: BranchInfo[],
  remotes: RemoteInfo[],
  currentBranchName: string | null | undefined
): string | null {
  if (remotes.length === 0) return null;

  if (currentBranchName) {
    const branch = branches.find((b) => !b.is_remote && b.name === currentBranchName);
    if (branch?.upstream) {
      const upstream = branch.upstream;
      const remote = remotes.find((r) => upstream.startsWith(`${r.name}/`));
      if (remote) return remote.name;
    }
  }

  if (remotes.length === 1) return remotes[0].name;
  return remotes.find((r) => r.name === "origin")?.name ?? remotes[0].name;
}
