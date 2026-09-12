import { invoke } from "@tauri-apps/api/core";
import type {
  BranchInfo,
  CommitInfo,
  FileDiff,
  RemoteInfo,
  RepoStatus,
  RepoSummary,
  StashInfo,
  TagInfo,
} from "./types";

export const api = {
  openRepository: (path: string) =>
    invoke<RepoSummary>("open_repository", { path }),

  getStatus: () => invoke<RepoStatus>("get_status"),

  getLog: (limit?: number) => invoke<CommitInfo[]>("get_log", { limit }),

  getBranches: () => invoke<BranchInfo[]>("get_branches"),

  getRemotes: () => invoke<RemoteInfo[]>("get_remotes"),

  getTags: () => invoke<TagInfo[]>("get_tags"),

  getCommitDiff: (commitId: string) =>
    invoke<FileDiff[]>("get_commit_diff", { commitId }),

  getWorkingDiff: (path: string, staged: boolean) =>
    invoke<FileDiff>("get_working_diff", { path, staged }),

  stageFile: (path: string) => invoke<void>("stage_file", { path }),

  unstageFile: (path: string) => invoke<void>("unstage_file", { path }),

  stageAll: () => invoke<void>("stage_all"),

  unstageAll: () => invoke<void>("unstage_all"),

  discardFileChanges: (path: string) =>
    invoke<void>("discard_file_changes", { path }),

  commit: (message: string) => invoke<CommitInfo>("commit", { message }),

  checkoutBranch: (name: string) =>
    invoke<void>("checkout_branch", { name }),

  createBranch: (name: string, startPoint: string | null, checkout: boolean) =>
    invoke<void>("create_branch", { name, startPoint, checkout }),

  deleteBranch: (name: string, isRemote: boolean) =>
    invoke<void>("delete_branch", { name, isRemote }),

  fetch: (remote?: string) => invoke<void>("fetch", { remote }),

  pull: () => invoke<string>("pull"),

  push: (remote: string, branch: string, setUpstream: boolean) =>
    invoke<void>("push", { remote, branch, setUpstream }),

  stashList: () => invoke<StashInfo[]>("stash_list"),

  stashSave: (message: string | null, includeUntracked: boolean) =>
    invoke<void>("stash_save", { message, includeUntracked }),

  stashPop: (index: number) => invoke<void>("stash_pop", { index }),

  stashApply: (index: number) => invoke<void>("stash_apply", { index }),

  stashDrop: (index: number) => invoke<void>("stash_drop", { index }),
};
