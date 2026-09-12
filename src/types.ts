export interface RepoSummary {
  path: string;
  name: string;
}

export interface CommitInfo {
  id: string;
  short_id: string;
  summary: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parent_ids: string[];
  refs: string[];
  lane: number;
  parent_lanes: number[];
}

export interface BranchInfo {
  name: string;
  full_name: string;
  is_head: boolean;
  is_remote: boolean;
  upstream: string | null;
  target: string | null;
  ahead: number;
  behind: number;
}

export interface FileStatusEntry {
  path: string;
  old_path: string | null;
  status: string;
}

export interface RepoStatus {
  staged: FileStatusEntry[];
  unstaged: FileStatusEntry[];
  conflicted: FileStatusEntry[];
  branch: string | null;
  detached: boolean;
}

export interface DiffLineInfo {
  origin: string;
  content: string;
  old_lineno: number | null;
  new_lineno: number | null;
}

export interface DiffHunkInfo {
  header: string;
  lines: DiffLineInfo[];
}

export interface FileDiff {
  path: string;
  old_path: string | null;
  status: string;
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunkInfo[];
}

export interface RemoteInfo {
  name: string;
  url: string;
}

export interface StashInfo {
  index: number;
  message: string;
  oid: string;
}

export interface TagInfo {
  name: string;
  target: string;
}

// A selectable row in the commit graph: either the special "working changes"
// row, or a real commit identified by its id.
export type Selection = { kind: "working" } | { kind: "commit"; id: string };

export interface RepoState {
  state: string; // "clean" | "merge" | "rebase" | "cherrypick" | "revert" | "other"
  merge_summary: string | null;
  conflict_count: number;
}

export interface MergeOutcome {
  status: string; // "up_to_date" | "fast_forward" | "merged" | "conflicts"
  conflict_count: number;
}

export interface RebaseProgress {
  status: string; // "conflicts" | "complete"
  current: number;
  total: number;
  current_summary: string;
}
