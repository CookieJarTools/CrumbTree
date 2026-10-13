// Single source of truth for IPC channels and their request/response shapes.
// The preload bridge, main handlers, and renderer client all derive from this.

import type {
  Commit,
  Favourites,
  FileDiff,
  FileStatus,
  GitResult,
  GithubOwners,
  GithubStatus,
  LfsRule,
  LfsStatus,
  MergeOutcome,
  MergeState,
  MergeStrategy,
  OpLogEntry,
  Ref,
  RepoCreateOptions,
  RepoInfo,
  Stash,
  TerminalResult,
  Workspace,
  Worktree,
  WorkingStatus
} from './types'
import type { RebaseStep } from './rebase-todo'

export const CHANNELS = {
  dialogOpenRepo: 'dialog:openRepo',
  repoOpen: 'repo:open',
  repoRecent: 'repo:recent',
  repoStatus: 'repo:status',
  repoRefs: 'repo:refs',
  logList: 'log:list',
  diffFile: 'diff:file',
  diffCommitFile: 'diff:commitFile',
  commitFiles: 'commit:files',
  fileHistory: 'file:history',
  branchesContaining: 'branch:containing',
  fileBlame: 'file:blame',
  stageFile: 'stage:file',
  stagePaths: 'stage:paths',
  unstagePaths: 'unstage:paths',
  discardPaths: 'discard:paths',
  unstageFile: 'unstage:file',
  stagePatch: 'stage:patch',
  discardFile: 'discard:file',
  commitCreate: 'commit:create',
  branchCheckout: 'branch:checkout',
  remoteFetch: 'remote:fetch',
  remotePull: 'remote:pull',
  remotePush: 'remote:push',
  remotePushBranch: 'remote:pushBranch',
  remotePullBranch: 'remote:pullBranch',
  gitAvailable: 'git:available',
  opLog: 'op:log',
  // LFS
  lfsStatus: 'lfs:status',
  lfsRules: 'lfs:rules',
  lfsFiles: 'lfs:files',
  lfsTrackedFiles: 'lfs:trackedFiles',
  lfsTrack: 'lfs:track',
  lfsUntrack: 'lfs:untrack',
  lfsInstall: 'lfs:install',
  terminalRun: 'terminal:run',
  // GitHub (via gh CLI) + repo creation
  githubStatus: 'github:status',
  githubOwners: 'github:owners',
  githubCreatePr: 'github:createPr',
  githubInstall: 'github:install',
  githubAuthLogin: 'github:authLogin',
  dialogPickFolder: 'dialog:pickFolder',
  repoCreate: 'repo:create',
  repoClone: 'repo:clone',
  // Studio (Noob Mode) primitives
  branchCreate: 'branch:create',
  branchPrimary: 'branch:primary',
  stageAll: 'stage:all',
  pushCurrent: 'push:current',
  mergeInto: 'merge:into',
  // Ref operations (context menus)
  branchDelete: 'branch:delete',
  branchRename: 'branch:rename',
  stashList: 'stash:list',
  stashCreate: 'stash:create',
  stashApply: 'stash:apply',
  stashPop: 'stash:pop',
  stashDrop: 'stash:drop',
  stashFiles: 'stash:files',
  stashDiff: 'stash:diff',
  worktreeList: 'worktree:list',
  worktreeAdd: 'worktree:add',
  worktreeRemove: 'worktree:remove',
  worktreePrune: 'worktree:prune',
  worktreeLock: 'worktree:lock',
  worktreeUnlock: 'worktree:unlock',
  rebaseCommits: 'rebase:commits',
  rebaseRun: 'rebase:run',
  tagCreate: 'tag:create',
  tagDelete: 'tag:delete',
  mergeCurrent: 'merge:current',
  revertCommit: 'commit:revert',
  commitMessage: 'commit:message',
  commitReword: 'commit:reword',
  // Conflict resolution
  conflictState: 'conflict:state',
  conflictRead: 'conflict:read',
  conflictWrite: 'conflict:write',
  conflictSide: 'conflict:side',
  mergeContinue: 'merge:continue',
  mergeAbort: 'merge:abort',
  // Window / shell / clipboard
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggleMaximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:isMaximized',
  clipboardWrite: 'clipboard:write',
  clipboardRead: 'clipboard:read',
  shellReveal: 'shell:reveal',
  shellOpenExternal: 'shell:openExternal',
  // Settings
  settingsGet: 'settings:get',
  settingsSet: 'settings:set'
} as const

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS]

// Event channels pushed from main -> renderer (not request/response).
export const EVENTS = {
  opLogAppend: 'event:opLogAppend',
  gitProgress: 'event:gitProgress',
  repoChanged: 'event:repoChanged',
  maximizeChanged: 'event:maximizeChanged',
  deeplinkOpen: 'event:deeplinkOpen'
} as const

export interface OpenRepoRef {
  path: string
  name: string
}

export interface Settings {
  noobMode: boolean
  gitFriend: boolean
  openRepos: OpenRepoRef[]
  activeRepo: string | null
  workspaces: Workspace[]
  activeWorkspaceId: string
  favourites: Favourites
  layout: Record<string, number>
}

// ---- Request payloads keyed by channel ----
export interface Requests {
  [CHANNELS.dialogOpenRepo]: void
  [CHANNELS.repoOpen]: { path: string }
  [CHANNELS.repoRecent]: void
  [CHANNELS.repoStatus]: { path: string }
  [CHANNELS.repoRefs]: { path: string }
  [CHANNELS.logList]: { path: string; limit?: number; skip?: number }
  [CHANNELS.diffFile]: { path: string; file: string; staged: boolean }
  [CHANNELS.diffCommitFile]: { path: string; hash: string; file: string }
  [CHANNELS.commitFiles]: { path: string; hash: string }
  [CHANNELS.fileHistory]: { path: string; file: string }
  [CHANNELS.branchesContaining]: { path: string; hash: string }
  [CHANNELS.fileBlame]: { path: string; file: string }
  [CHANNELS.stageFile]: { path: string; file: string }
  [CHANNELS.stagePaths]: { path: string; paths: string[] }
  [CHANNELS.unstagePaths]: { path: string; paths: string[] }
  [CHANNELS.discardPaths]: { path: string; paths: string[] }
  [CHANNELS.unstageFile]: { path: string; file: string }
  [CHANNELS.stagePatch]: { path: string; patch: string; reverse: boolean }
  [CHANNELS.discardFile]: { path: string; file: string }
  [CHANNELS.commitCreate]: { path: string; message: string; amend: boolean }
  [CHANNELS.branchCheckout]: { path: string; ref: string }
  [CHANNELS.remoteFetch]: { path: string }
  [CHANNELS.remotePull]: { path: string }
  [CHANNELS.remotePush]: { path: string; force?: boolean }
  [CHANNELS.remotePushBranch]: { path: string; branch: string }
  [CHANNELS.remotePullBranch]: { path: string; branch: string }
  [CHANNELS.gitAvailable]: void
  [CHANNELS.opLog]: void
  [CHANNELS.lfsStatus]: { path: string }
  [CHANNELS.lfsRules]: { path: string }
  [CHANNELS.lfsFiles]: { path: string }
  [CHANNELS.lfsTrackedFiles]: { path: string }
  [CHANNELS.lfsTrack]: { path: string; pattern: string }
  [CHANNELS.lfsUntrack]: { path: string; pattern: string }
  [CHANNELS.lfsInstall]: { path: string }
  [CHANNELS.terminalRun]: { path: string; args: string[] }
  [CHANNELS.githubStatus]: void
  [CHANNELS.githubOwners]: void
  [CHANNELS.githubCreatePr]: { path: string; base: string; head: string }
  [CHANNELS.githubInstall]: void
  [CHANNELS.githubAuthLogin]: void
  [CHANNELS.dialogPickFolder]: void
  [CHANNELS.repoCreate]: RepoCreateOptions
  [CHANNELS.repoClone]: { url: string; dir: string; name: string }
  [CHANNELS.branchCreate]: { path: string; name: string; from?: string }
  [CHANNELS.branchPrimary]: { path: string }
  [CHANNELS.stageAll]: { path: string }
  [CHANNELS.pushCurrent]: { path: string }
  [CHANNELS.mergeInto]: { path: string; target: string; source: string }
  [CHANNELS.branchDelete]: { path: string; name: string; force: boolean }
  [CHANNELS.branchRename]: { path: string; oldName: string; newName: string }
  [CHANNELS.stashList]: { path: string }
  [CHANNELS.stashCreate]: { path: string; message: string; includeUntracked: boolean; paths?: string[] }
  [CHANNELS.stashApply]: { path: string; ref: string }
  [CHANNELS.stashPop]: { path: string; ref: string }
  [CHANNELS.stashDrop]: { path: string; ref: string }
  [CHANNELS.stashFiles]: { path: string; ref: string }
  [CHANNELS.stashDiff]: { path: string; ref: string; file: string }
  [CHANNELS.worktreeList]: { path: string }
  [CHANNELS.worktreeAdd]: {
    path: string
    dir: string
    branch: string
    create: boolean
    base?: string
  }
  [CHANNELS.worktreeRemove]: { path: string; worktree: string; force: boolean }
  [CHANNELS.worktreePrune]: { path: string }
  [CHANNELS.worktreeLock]: { path: string; worktree: string; reason: string }
  [CHANNELS.worktreeUnlock]: { path: string; worktree: string }
  [CHANNELS.rebaseCommits]: { path: string; limit: number }
  [CHANNELS.rebaseRun]: { path: string; base: string | null; steps: RebaseStep[] }
  [CHANNELS.tagCreate]: { path: string; name: string; ref: string }
  [CHANNELS.tagDelete]: { path: string; name: string }
  [CHANNELS.mergeCurrent]: { path: string; source: string; strategy: MergeStrategy }
  [CHANNELS.revertCommit]: { path: string; hash: string }
  [CHANNELS.commitMessage]: { path: string; hash: string }
  [CHANNELS.commitReword]: { path: string; hash: string; message: string }
  [CHANNELS.conflictState]: { path: string }
  [CHANNELS.conflictRead]: { path: string; file: string }
  [CHANNELS.conflictWrite]: { path: string; file: string; content: string }
  [CHANNELS.conflictSide]: { path: string; file: string; side: 'ours' | 'theirs' }
  [CHANNELS.mergeContinue]: { path: string }
  [CHANNELS.mergeAbort]: { path: string }
  [CHANNELS.windowMinimize]: void
  [CHANNELS.windowToggleMaximize]: void
  [CHANNELS.windowClose]: void
  [CHANNELS.windowIsMaximized]: void
  [CHANNELS.clipboardWrite]: { text: string }
  [CHANNELS.clipboardRead]: void
  [CHANNELS.shellReveal]: { path: string }
  [CHANNELS.shellOpenExternal]: { url: string }
  [CHANNELS.settingsGet]: void
  [CHANNELS.settingsSet]: {
    noobMode?: boolean
    gitFriend?: boolean
    openRepos?: OpenRepoRef[]
    activeRepo?: string | null
    workspaces?: Workspace[]
    activeWorkspaceId?: string
    favourites?: Favourites
    layout?: Record<string, number>
  }
}

// ---- Response payloads keyed by channel ----
export interface Responses {
  [CHANNELS.dialogOpenRepo]: GitResult<RepoInfo | null>
  [CHANNELS.repoOpen]: GitResult<RepoInfo>
  [CHANNELS.repoRecent]: GitResult<{ path: string; name: string }[]>
  [CHANNELS.repoStatus]: GitResult<WorkingStatus>
  [CHANNELS.repoRefs]: GitResult<Ref[]>
  [CHANNELS.logList]: GitResult<Commit[]>
  [CHANNELS.diffFile]: GitResult<FileDiff>
  [CHANNELS.diffCommitFile]: GitResult<FileDiff>
  [CHANNELS.commitFiles]: GitResult<import('./types').FileStatus[]>
  [CHANNELS.fileHistory]: GitResult<Commit[]>
  [CHANNELS.branchesContaining]: GitResult<string[]>
  [CHANNELS.fileBlame]: GitResult<string>
  [CHANNELS.stageFile]: GitResult<void>
  [CHANNELS.stagePaths]: GitResult<void>
  [CHANNELS.unstagePaths]: GitResult<void>
  [CHANNELS.discardPaths]: GitResult<void>
  [CHANNELS.unstageFile]: GitResult<void>
  [CHANNELS.stagePatch]: GitResult<void>
  [CHANNELS.discardFile]: GitResult<void>
  [CHANNELS.commitCreate]: GitResult<void>
  [CHANNELS.branchCheckout]: GitResult<void>
  [CHANNELS.remoteFetch]: GitResult<void>
  [CHANNELS.remotePull]: GitResult<void>
  [CHANNELS.remotePush]: GitResult<void>
  [CHANNELS.remotePushBranch]: GitResult<void>
  [CHANNELS.remotePullBranch]: GitResult<{ updated: number; upstream: string }>
  [CHANNELS.gitAvailable]: GitResult<{ version: string }>
  [CHANNELS.opLog]: GitResult<OpLogEntry[]>
  [CHANNELS.lfsStatus]: GitResult<LfsStatus>
  [CHANNELS.lfsRules]: GitResult<LfsRule[]>
  [CHANNELS.lfsFiles]: GitResult<string[]>
  [CHANNELS.lfsTrackedFiles]: GitResult<string[]>
  [CHANNELS.lfsTrack]: GitResult<void>
  [CHANNELS.lfsUntrack]: GitResult<void>
  [CHANNELS.lfsInstall]: GitResult<void>
  [CHANNELS.terminalRun]: GitResult<TerminalResult>
  [CHANNELS.githubStatus]: GitResult<GithubStatus>
  [CHANNELS.githubOwners]: GitResult<GithubOwners>
  [CHANNELS.githubCreatePr]: GitResult<{ url: string }>
  [CHANNELS.githubInstall]: GitResult<void>
  [CHANNELS.githubAuthLogin]: GitResult<void>
  [CHANNELS.dialogPickFolder]: GitResult<string | null>
  [CHANNELS.repoCreate]: GitResult<RepoInfo>
  [CHANNELS.repoClone]: GitResult<RepoInfo>
  [CHANNELS.branchCreate]: GitResult<void>
  [CHANNELS.branchPrimary]: GitResult<string>
  [CHANNELS.stageAll]: GitResult<void>
  [CHANNELS.pushCurrent]: GitResult<void>
  [CHANNELS.mergeInto]: GitResult<MergeOutcome>
  [CHANNELS.branchDelete]: GitResult<void>
  [CHANNELS.branchRename]: GitResult<void>
  [CHANNELS.stashList]: GitResult<Stash[]>
  [CHANNELS.stashCreate]: GitResult<void>
  [CHANNELS.stashApply]: GitResult<void>
  [CHANNELS.stashPop]: GitResult<void>
  [CHANNELS.stashDrop]: GitResult<void>
  [CHANNELS.stashFiles]: GitResult<FileStatus[]>
  [CHANNELS.stashDiff]: GitResult<FileDiff>
  [CHANNELS.worktreeList]: GitResult<Worktree[]>
  [CHANNELS.worktreeAdd]: GitResult<void>
  [CHANNELS.worktreeRemove]: GitResult<void>
  [CHANNELS.worktreePrune]: GitResult<void>
  [CHANNELS.worktreeLock]: GitResult<void>
  [CHANNELS.worktreeUnlock]: GitResult<void>
  [CHANNELS.rebaseCommits]: GitResult<Commit[]>
  [CHANNELS.rebaseRun]: GitResult<MergeOutcome>
  [CHANNELS.tagCreate]: GitResult<void>
  [CHANNELS.tagDelete]: GitResult<void>
  [CHANNELS.mergeCurrent]: GitResult<MergeOutcome>
  [CHANNELS.revertCommit]: GitResult<void>
  [CHANNELS.commitMessage]: GitResult<string>
  [CHANNELS.commitReword]: GitResult<void>
  [CHANNELS.conflictState]: GitResult<MergeState>
  [CHANNELS.conflictRead]: GitResult<string>
  [CHANNELS.conflictWrite]: GitResult<void>
  [CHANNELS.conflictSide]: GitResult<void>
  [CHANNELS.mergeContinue]: GitResult<MergeState>
  [CHANNELS.mergeAbort]: GitResult<void>
  [CHANNELS.windowMinimize]: GitResult<void>
  [CHANNELS.windowToggleMaximize]: GitResult<void>
  [CHANNELS.windowClose]: GitResult<void>
  [CHANNELS.windowIsMaximized]: GitResult<boolean>
  [CHANNELS.clipboardWrite]: GitResult<void>
  [CHANNELS.clipboardRead]: GitResult<string>
  [CHANNELS.shellReveal]: GitResult<void>
  [CHANNELS.shellOpenExternal]: GitResult<void>
  [CHANNELS.settingsGet]: GitResult<Settings>
  [CHANNELS.settingsSet]: GitResult<void>
}
