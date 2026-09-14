import { invoke } from "@tauri-apps/api/core";
import type {
  BranchInfo,
  CommitInfo,
  DeviceCodeInfo,
  DevicePollResult,
  FileDiff,
  GeneratedKey,
  GithubRepo,
  MergeOutcome,
  RebaseProgress,
  RemoteInfo,
  RepoState,
  RepoStatus,
  RepoSummary,
  SshStatus,
  SshTestResult,
  StashInfo,
  TagInfo,
} from "./types";

// Every call takes the repo's path explicitly (instead of relying on one
// global "current repo" in the backend), so any number of repos can be
// open as tabs at once without the backend needing to track which is active.
export const api = {
  openRepository: (path: string) =>
    invoke<RepoSummary>("open_repository", { path }),

  initRepository: (path: string) =>
    invoke<RepoSummary>("init_repository", { path }),

  addRemote: (repoPath: string, name: string, url: string) =>
    invoke<void>("add_remote", { repoPath, name, url }),

  getStatus: (repoPath: string) => invoke<RepoStatus>("get_status", { repoPath }),

  getLog: (repoPath: string, limit?: number) =>
    invoke<CommitInfo[]>("get_log", { repoPath, limit }),

  getBranches: (repoPath: string) => invoke<BranchInfo[]>("get_branches", { repoPath }),

  getRemotes: (repoPath: string) => invoke<RemoteInfo[]>("get_remotes", { repoPath }),

  getTags: (repoPath: string) => invoke<TagInfo[]>("get_tags", { repoPath }),

  getCommitDiff: (repoPath: string, commitId: string) =>
    invoke<FileDiff[]>("get_commit_diff", { repoPath, commitId }),

  getWorkingDiff: (repoPath: string, path: string, staged: boolean) =>
    invoke<FileDiff>("get_working_diff", { repoPath, path, staged }),

  stageFile: (repoPath: string, path: string) =>
    invoke<void>("stage_file", { repoPath, path }),

  unstageFile: (repoPath: string, path: string) =>
    invoke<void>("unstage_file", { repoPath, path }),

  stageAll: (repoPath: string) => invoke<void>("stage_all", { repoPath }),

  unstageAll: (repoPath: string) => invoke<void>("unstage_all", { repoPath }),

  discardFileChanges: (repoPath: string, path: string) =>
    invoke<void>("discard_file_changes", { repoPath, path }),

  commit: (repoPath: string, message: string) =>
    invoke<CommitInfo>("commit", { repoPath, message }),

  checkoutBranch: (repoPath: string, name: string) =>
    invoke<void>("checkout_branch", { repoPath, name }),

  createBranch: (
    repoPath: string,
    name: string,
    startPoint: string | null,
    checkout: boolean
  ) => invoke<void>("create_branch", { repoPath, name, startPoint, checkout }),

  deleteBranch: (repoPath: string, name: string, isRemote: boolean) =>
    invoke<void>("delete_branch", { repoPath, name, isRemote }),

  fetch: (repoPath: string, remote?: string) =>
    invoke<void>("fetch", { repoPath, remote }),

  pull: (repoPath: string) => invoke<string>("pull", { repoPath }),

  push: (repoPath: string, remote: string, branch: string, setUpstream: boolean) =>
    invoke<void>("push", { repoPath, remote, branch, setUpstream }),

  stashList: (repoPath: string) => invoke<StashInfo[]>("stash_list", { repoPath }),

  stashSave: (repoPath: string, message: string | null, includeUntracked: boolean) =>
    invoke<void>("stash_save", { repoPath, message, includeUntracked }),

  stashPop: (repoPath: string, index: number) =>
    invoke<void>("stash_pop", { repoPath, index }),

  stashApply: (repoPath: string, index: number) =>
    invoke<void>("stash_apply", { repoPath, index }),

  stashDrop: (repoPath: string, index: number) =>
    invoke<void>("stash_drop", { repoPath, index }),

  getRepoState: (repoPath: string) => invoke<RepoState>("get_repo_state", { repoPath }),

  mergeBranch: (repoPath: string, name: string) =>
    invoke<MergeOutcome>("merge_branch", { repoPath, name }),

  mergeAbort: (repoPath: string) => invoke<void>("merge_abort", { repoPath }),

  startRebase: (repoPath: string, onto: string) =>
    invoke<RebaseProgress>("start_rebase", { repoPath, onto }),

  rebaseContinue: (repoPath: string) =>
    invoke<RebaseProgress>("rebase_continue", { repoPath }),

  rebaseAbort: (repoPath: string) => invoke<void>("rebase_abort", { repoPath }),

  readWorkingFile: (repoPath: string, path: string) =>
    invoke<string>("read_working_file", { repoPath, path }),

  resolveConflict: (repoPath: string, path: string, side: "ours" | "theirs") =>
    invoke<void>("resolve_conflict", { repoPath, path, side }),

  writeWorkingFile: (repoPath: string, path: string, content: string) =>
    invoke<void>("write_working_file", { repoPath, path, content }),

  resetToCommit: (repoPath: string, commitId: string, mode: "soft" | "mixed" | "hard") =>
    invoke<void>("reset_to_commit", { repoPath, commitId, mode }),

  cloneRepository: (url: string, into: string) =>
    invoke<RepoSummary>("clone_repository", { url, into }),

  githubStartDeviceFlow: () => invoke<DeviceCodeInfo>("github_start_device_flow"),

  githubPollDeviceFlow: (deviceCode: string) =>
    invoke<DevicePollResult>("github_poll_device_flow", { deviceCode }),

  githubIsSignedIn: () => invoke<boolean>("github_is_signed_in"),

  githubSignOut: () => invoke<void>("github_sign_out"),

  githubGetUsername: () => invoke<string>("github_get_username"),

  githubListRepos: () => invoke<GithubRepo[]>("github_list_repos"),

  githubCreateRepo: (name: string, private_: boolean, description: string | null) =>
    invoke<GithubRepo>("github_create_repo", { name, private: private_, description }),

  sshStatus: () => invoke<SshStatus>("ssh_status"),

  sshSetCustomKey: (path: string) => invoke<void>("ssh_set_custom_key", { path }),

  sshClearCustomKey: () => invoke<void>("ssh_clear_custom_key"),

  sshGenerateKey: () => invoke<GeneratedKey>("ssh_generate_key"),

  sshTestConnection: () => invoke<SshTestResult>("ssh_test_connection"),
};
