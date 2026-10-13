// Shared domain types — used by both main (git service) and renderer (UI).
// Keep this pure data: no Node or DOM imports.

export interface RepoInfo {
  path: string
  name: string
  head: HeadInfo
}

/** A git worktree — an additional checked-out working directory sharing this repo's history. */
export interface Worktree {
  path: string
  head: string | null
  branch: string | null
  bare: boolean
  detached: boolean
  locked: boolean
  lockedReason: string | null
  prunable: boolean
  /** The primary worktree (the original clone). */
  isMain: boolean
  /** The worktree currently open in this tab. */
  isCurrent: boolean
}

/** A named collection of open repositories (its own set of tabs). */
export interface Workspace {
  id: string
  name: string
  repos: { path: string; name: string }[]
  /** Path of the repo that was active in this workspace, if any. */
  activeRepo: string | null
}

export interface HeadInfo {
  /** Current branch name, or null when in detached HEAD. */
  branch: string | null
  /** Short hash of HEAD, if the repo has any commits. */
  hash: string | null
  detached: boolean
  /** Commits ahead / behind the configured upstream, if any. */
  upstream: string | null
  ahead: number
  behind: number
}

export type RefType = 'localBranch' | 'remoteBranch' | 'tag' | 'head' | 'stash'

export interface Ref {
  name: string // full display name, e.g. "main" or "origin/main"
  type: RefType
  /** Commit hash the ref points at. */
  hash: string
  /** For remote branches: the remote name (e.g. "origin"). */
  remote?: string
  /** True when this ref is the currently checked-out branch. */
  current?: boolean
  /** For local branches: the upstream it tracks (e.g. "origin/main"), if any. */
  upstream?: string | null
  /** True when this branch's upstream was deleted on the remote ("[gone]"). */
  gone?: boolean
}

export interface Commit {
  hash: string
  parents: string[]
  authorName: string
  authorEmail: string
  /** Author timestamp, unix seconds. */
  timestamp: number
  subject: string
  /** Ref names decorating this commit (from %D). */
  refs: string[]
}

/** One rendered row of the commit graph, produced by the layout algorithm. */
export interface GraphRow {
  commit: Commit
  /** Lane (column) index this commit's node sits in. */
  lane: number
  /** Colour index for this commit's node/lane. */
  color: number
  /** Edges passing through or connecting at this row. */
  edges: GraphEdge[]
  /** Total number of lanes active at this row (for width calc). */
  laneCount: number
}

export interface GraphEdge {
  fromLane: number
  toLane: number
  color: number
  /** Vertical anchor of the edge start: top of the row (true) or the node centre (false). */
  fromTop: boolean
  /** Vertical anchor of the edge end: bottom of the row (true) or the node centre (false). */
  toBottom: boolean
  /** Hashes of the child commits this line descends from (a parent link starts at a child). */
  from: string[]
}

export type FileChangeType = 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

export interface FileStatus {
  path: string
  oldPath?: string // for renames
  type: FileChangeType
  staged: boolean
}

export interface WorkingStatus {
  staged: FileStatus[]
  unstaged: FileStatus[]
  /** Files with unresolved merge conflicts. */
  conflicted: FileStatus[]
}

export type DiffLineType = 'context' | 'add' | 'del' | 'meta'

export interface DiffLine {
  type: DiffLineType
  content: string
  oldLineNo: number | null
  newLineNo: number | null
}

export interface DiffHunk {
  header: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface FileDiff {
  path: string
  oldPath?: string
  binary: boolean
  hunks: DiffHunk[]
}

export interface OpLogEntry {
  id: number
  command: string // e.g. "git fetch --all --prune"
  cwd: string
  code: number
  ok: boolean
  ms: number
  at: number // unix ms
  stderr?: string
  /** Captured stdout — only populated for user-typed terminal commands. */
  stdout?: string
  /** True when the user typed this command into the terminal. */
  input?: boolean
}

/** Result envelope for any git invocation surfaced to the renderer. */
export interface GitResult<T> {
  ok: boolean
  data?: T
  error?: string
}

// ---- Git LFS ----
export interface LfsRule {
  /** The tracked glob pattern, e.g. "*.psd" or "art/**". */
  pattern: string
  /** File the rule lives in (usually .gitattributes). */
  source?: string
}

export interface LfsStatus {
  installed: boolean
  version: string | null
  /** True once the repo has any LFS-tracked pattern. */
  initialized: boolean
}

// ---- Studio (Minimal Mode) primitives ----
export interface MergeOutcome {
  ok: boolean
  /** True when the merge hit conflicts (left in progress for the resolver). */
  conflict: boolean
  /** Nothing to merge — the source was already contained in the current branch. */
  upToDate?: boolean
  /** Set when the (local) source you merged is behind its own upstream, so the
   *  no-op merge likely surprised you: the new work is on the remote, not here. */
  behindUpstream?: { ref: string; count: number } | null
}

// ---- Merge types + conflict resolution ----
export type MergeStrategy = 'merge' | 'squash' | 'ff' | 'rebase'

export interface MergeState {
  inProgress: boolean
  kind: 'merge' | 'squash' | 'rebase' | 'none'
  /** The branch being merged in, if we can determine it. */
  source: string | null
  conflicted: FileStatus[]
}

// ---- Stashes ----
export interface Stash {
  /** Reflog selector, e.g. "stash@{0}". */
  ref: string
  index: number
  message: string
  /** Branch the stash was made on, if known. */
  branch: string | null
  /** Commit time, unix seconds. */
  timestamp: number
}

// ---- Terminal ----
export interface TerminalResult {
  stdout: string
  stderr: string
  code: number
}

// ---- Favourites & layout (persisted settings) ----
export interface Favourites {
  repos: string[]
  branches: Record<string, string[]>
  commits: Record<string, string[]>
}

// ---- GitHub integration ----
export interface GithubStatus {
  connected: boolean
  login: string | null
  name?: string | null
  /** Why not connected: gh missing vs. installed-but-not-logged-in. */
  reason?: 'no-cli' | 'not-authed'
}

export interface GithubOwners {
  /** The authenticated user's own account. */
  user: string
  /** Organisations the user can create repos in. */
  orgs: string[]
}

export interface RepoCreateOptions {
  folder: string
  name: string
  description: string
  isPrivate: boolean
  /** Create it on GitHub and push, vs. a purely local repo. */
  publish: boolean
  owner: string
  ownerIsOrg: boolean
  addReadme: boolean
  gitignore: 'none' | 'node' | 'unity'
}
