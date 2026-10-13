import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, EVENTS } from '@shared/ipc-contract'
import type { Requests, Responses } from '@shared/ipc-contract'
import type { OpLogEntry } from '@shared/types'
import type { GitProgressEvent } from '@shared/git-progress'

function invoke<C extends keyof Requests & keyof Responses>(
  channel: C,
  payload: Requests[C]
): Promise<Responses[C]> {
  return ipcRenderer.invoke(channel as string, payload) as Promise<Responses[C]>
}

const api = {
  gitAvailable: () => invoke(CHANNELS.gitAvailable, undefined),
  openRepoDialog: () => invoke(CHANNELS.dialogOpenRepo, undefined),
  openRepo: (path: string) => invoke(CHANNELS.repoOpen, { path }),
  recentRepos: () => invoke(CHANNELS.repoRecent, undefined),
  status: (path: string) => invoke(CHANNELS.repoStatus, { path }),
  refs: (path: string) => invoke(CHANNELS.repoRefs, { path }),
  log: (path: string, limit?: number, skip?: number) =>
    invoke(CHANNELS.logList, { path, limit, skip }),
  fileDiff: (path: string, file: string, staged: boolean) =>
    invoke(CHANNELS.diffFile, { path, file, staged }),
  commitFileDiff: (path: string, hash: string, file: string) =>
    invoke(CHANNELS.diffCommitFile, { path, hash, file }),
  commitFiles: (path: string, hash: string) => invoke(CHANNELS.commitFiles, { path, hash }),
  fileHistory: (path: string, file: string) => invoke(CHANNELS.fileHistory, { path, file }),
  branchesContaining: (path: string, hash: string) =>
    invoke(CHANNELS.branchesContaining, { path, hash }),
  fileBlame: (path: string, file: string) => invoke(CHANNELS.fileBlame, { path, file }),
  stageFile: (path: string, file: string) => invoke(CHANNELS.stageFile, { path, file }),
  stagePaths: (path: string, paths: string[]) => invoke(CHANNELS.stagePaths, { path, paths }),
  unstagePaths: (path: string, paths: string[]) => invoke(CHANNELS.unstagePaths, { path, paths }),
  discardPaths: (path: string, paths: string[]) => invoke(CHANNELS.discardPaths, { path, paths }),
  unstageFile: (path: string, file: string) => invoke(CHANNELS.unstageFile, { path, file }),
  stagePatch: (path: string, patch: string, reverse: boolean) =>
    invoke(CHANNELS.stagePatch, { path, patch, reverse }),
  discardFile: (path: string, file: string) => invoke(CHANNELS.discardFile, { path, file }),
  commit: (path: string, message: string, amend: boolean) =>
    invoke(CHANNELS.commitCreate, { path, message, amend }),
  checkout: (path: string, ref: string) => invoke(CHANNELS.branchCheckout, { path, ref }),
  fetch: (path: string) => invoke(CHANNELS.remoteFetch, { path }),
  pull: (path: string) => invoke(CHANNELS.remotePull, { path }),
  push: (path: string, force?: boolean) => invoke(CHANNELS.remotePush, { path, force }),
  pushBranch: (path: string, branch: string) => invoke(CHANNELS.remotePushBranch, { path, branch }),
  pullBranch: (path: string, branch: string) => invoke(CHANNELS.remotePullBranch, { path, branch }),
  opLog: () => invoke(CHANNELS.opLog, undefined),

  // LFS
  lfsStatus: (path: string) => invoke(CHANNELS.lfsStatus, { path }),
  lfsRules: (path: string) => invoke(CHANNELS.lfsRules, { path }),
  lfsFiles: (path: string) => invoke(CHANNELS.lfsFiles, { path }),
  lfsTrackedFiles: (path: string) => invoke(CHANNELS.lfsTrackedFiles, { path }),
  lfsTrack: (path: string, pattern: string) => invoke(CHANNELS.lfsTrack, { path, pattern }),
  lfsUntrack: (path: string, pattern: string) => invoke(CHANNELS.lfsUntrack, { path, pattern }),
  lfsInstall: (path: string) => invoke(CHANNELS.lfsInstall, { path }),
  terminalRun: (path: string, args: string[]) => invoke(CHANNELS.terminalRun, { path, args }),

  // GitHub (via gh CLI) + repo creation
  githubStatus: () => invoke(CHANNELS.githubStatus, undefined),
  githubOwners: () => invoke(CHANNELS.githubOwners, undefined),
  githubCreatePr: (path: string, base: string, head: string) =>
    invoke(CHANNELS.githubCreatePr, { path, base, head }),
  githubInstall: () => invoke(CHANNELS.githubInstall, undefined),
  githubAuthLogin: () => invoke(CHANNELS.githubAuthLogin, undefined),
  pickFolder: () => invoke(CHANNELS.dialogPickFolder, undefined),
  createRepo: (opts: import('@shared/types').RepoCreateOptions) =>
    invoke(CHANNELS.repoCreate, opts),
  cloneRepo: (url: string, dir: string, name: string) =>
    invoke(CHANNELS.repoClone, { url, dir, name }),

  // Studio (Noob Mode) primitives
  branchCreate: (path: string, name: string, from?: string) =>
    invoke(CHANNELS.branchCreate, { path, name, from }),
  branchPrimary: (path: string) => invoke(CHANNELS.branchPrimary, { path }),
  stageAll: (path: string) => invoke(CHANNELS.stageAll, { path }),
  pushCurrent: (path: string) => invoke(CHANNELS.pushCurrent, { path }),
  mergeInto: (path: string, target: string, source: string) =>
    invoke(CHANNELS.mergeInto, { path, target, source }),

  // Ref operations (context menus)
  branchDelete: (path: string, name: string, force: boolean) =>
    invoke(CHANNELS.branchDelete, { path, name, force }),
  branchRename: (path: string, oldName: string, newName: string) =>
    invoke(CHANNELS.branchRename, { path, oldName, newName }),
  stashList: (path: string) => invoke(CHANNELS.stashList, { path }),
  stashCreate: (path: string, message: string, includeUntracked: boolean, paths?: string[]) =>
    invoke(CHANNELS.stashCreate, { path, message, includeUntracked, paths }),
  stashApply: (path: string, ref: string) => invoke(CHANNELS.stashApply, { path, ref }),
  stashPop: (path: string, ref: string) => invoke(CHANNELS.stashPop, { path, ref }),
  stashDrop: (path: string, ref: string) => invoke(CHANNELS.stashDrop, { path, ref }),
  stashFiles: (path: string, ref: string) => invoke(CHANNELS.stashFiles, { path, ref }),
  stashDiff: (path: string, ref: string, file: string) =>
    invoke(CHANNELS.stashDiff, { path, ref, file }),
  worktreeList: (path: string) => invoke(CHANNELS.worktreeList, { path }),
  worktreeAdd: (path: string, dir: string, branch: string, create: boolean, base?: string) =>
    invoke(CHANNELS.worktreeAdd, { path, dir, branch, create, base }),
  worktreeRemove: (path: string, worktree: string, force: boolean) =>
    invoke(CHANNELS.worktreeRemove, { path, worktree, force }),
  worktreePrune: (path: string) => invoke(CHANNELS.worktreePrune, { path }),
  worktreeLock: (path: string, worktree: string, reason: string) =>
    invoke(CHANNELS.worktreeLock, { path, worktree, reason }),
  worktreeUnlock: (path: string, worktree: string) =>
    invoke(CHANNELS.worktreeUnlock, { path, worktree }),
  rebaseCommits: (path: string, limit: number) => invoke(CHANNELS.rebaseCommits, { path, limit }),
  rebaseRun: (
    path: string,
    base: string | null,
    steps: import('@shared/rebase-todo').RebaseStep[]
  ) => invoke(CHANNELS.rebaseRun, { path, base, steps }),
  tagCreate: (path: string, name: string, ref: string) =>
    invoke(CHANNELS.tagCreate, { path, name, ref }),
  tagDelete: (path: string, name: string) => invoke(CHANNELS.tagDelete, { path, name }),
  mergeCurrent: (path: string, source: string, strategy: import('@shared/types').MergeStrategy) =>
    invoke(CHANNELS.mergeCurrent, { path, source, strategy }),
  conflictState: (path: string) => invoke(CHANNELS.conflictState, { path }),
  conflictRead: (path: string, file: string) => invoke(CHANNELS.conflictRead, { path, file }),
  conflictWrite: (path: string, file: string, content: string) =>
    invoke(CHANNELS.conflictWrite, { path, file, content }),
  conflictSide: (path: string, file: string, side: 'ours' | 'theirs') =>
    invoke(CHANNELS.conflictSide, { path, file, side }),
  mergeContinue: (path: string) => invoke(CHANNELS.mergeContinue, { path }),
  mergeAbort: (path: string) => invoke(CHANNELS.mergeAbort, { path }),
  revertCommit: (path: string, hash: string) => invoke(CHANNELS.revertCommit, { path, hash }),
  commitMessage: (path: string, hash: string) => invoke(CHANNELS.commitMessage, { path, hash }),
  rewordCommit: (path: string, hash: string, message: string) =>
    invoke(CHANNELS.commitReword, { path, hash, message }),

  // Window / shell / clipboard
  windowMinimize: () => invoke(CHANNELS.windowMinimize, undefined),
  windowToggleMaximize: () => invoke(CHANNELS.windowToggleMaximize, undefined),
  windowClose: () => invoke(CHANNELS.windowClose, undefined),
  windowIsMaximized: () => invoke(CHANNELS.windowIsMaximized, undefined),
  clipboardWrite: (text: string) => invoke(CHANNELS.clipboardWrite, { text }),
  clipboardRead: () => invoke(CHANNELS.clipboardRead, undefined),
  shellReveal: (path: string) => invoke(CHANNELS.shellReveal, { path }),
  shellOpenExternal: (url: string) => invoke(CHANNELS.shellOpenExternal, { url }),
  onMaximizeChanged: (cb: (isMax: boolean) => void) => {
    const listener = (_e: unknown, isMax: boolean) => cb(isMax)
    ipcRenderer.on(EVENTS.maximizeChanged, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.maximizeChanged, listener)
    }
  },
  onDeeplink: (cb: (path: string) => void) => {
    const listener = (_e: unknown, path: string) => cb(path)
    ipcRenderer.on(EVENTS.deeplinkOpen, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.deeplinkOpen, listener)
    }
  },

  // Settings
  settingsGet: () => invoke(CHANNELS.settingsGet, undefined),
  settingsSet: (patch: {
    noobMode?: boolean
    gitFriend?: boolean
    compactMode?: boolean
    openRepos?: { path: string; name: string }[]
    activeRepo?: string | null
    workspaces?: import('@shared/types').Workspace[]
    activeWorkspaceId?: string
    favourites?: import('@shared/types').Favourites
    layout?: Record<string, number>
  }) => invoke(CHANNELS.settingsSet, patch),

  /** Live progress for long git ops. `null` means the op finished. */
  onGitProgress: (cb: (p: GitProgressEvent | null) => void) => {
    const listener = (_e: unknown, p: GitProgressEvent | null) => cb(p)
    ipcRenderer.on(EVENTS.gitProgress, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.gitProgress, listener)
    }
  },

  // Subscriptions (main -> renderer). Returns an unsubscribe fn.
  onOpLog: (cb: (entry: OpLogEntry) => void) => {
    const listener = (_e: unknown, entry: OpLogEntry) => cb(entry)
    ipcRenderer.on(EVENTS.opLogAppend, listener)
    return () => {
      ipcRenderer.removeListener(EVENTS.opLogAppend, listener)
    }
  }
}

export type CrumbApi = typeof api

contextBridge.exposeInMainWorld('crumb', api)
