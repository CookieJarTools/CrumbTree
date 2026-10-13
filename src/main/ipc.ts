import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { basename } from 'node:path'
import { CHANNELS, EVENTS } from '@shared/ipc-contract'
import type { GitResult } from '@shared/types'
import { getOpLog, gitVersion, onGitProgress, onOpLog } from './git/exec'
import { commitFileDiff, commitFiles, fileDiff } from './git/diff'
import { listCommits, listFileCommits } from './git/log'
import { blameFile, branchesContaining } from './git/filehistory'
import { checkout, fetchAll, pull, push, pushBranch, pullBranch } from './git/remote'
import { listRefs, openRepo, workingStatus } from './git/repo'
import {
  applyPatch,
  createCommit,
  discardFile,
  discardPaths,
  stageFile,
  stagePaths,
  unstageFile,
  unstagePaths
} from './git/stage'
import {
  lfsInstall,
  lfsStatus,
  lfsTrackedFiles,
  listLfsRules,
  listRepoFiles,
  trackPattern,
  untrackPattern
} from './git/lfs'
import { runGit } from './git/terminal'
import {
  mergeAbort,
  mergeContinue,
  mergeState,
  readConflictFile,
  resolveSide,
  writeResolved
} from './git/conflicts'
import { createRepo } from './git/create'
import { commitMessage, rewordCommit } from './git/reword'
import { cloneRepo } from './git/clone'
import {
  addWorktree,
  listWorktrees,
  lockWorktree,
  pruneWorktrees,
  removeWorktree,
  unlockWorktree
} from './git/worktree'
import { listBranchCommits, runInteractiveRebase } from './git/rebase'
import type { RebaseStep } from '@shared/rebase-todo'
import {
  applyStash,
  createStash,
  dropStash,
  listStashes,
  popStash,
  stashFileDiff,
  stashFiles
} from './git/stash'
import { ghAuthLogin, ghCreatePr, ghCreateRepo, ghOwners, ghStatus, installGh } from './github'
import {
  branchDelete,
  branchRename,
  createBranch,
  mergeCurrent,
  mergeInto,
  primaryBranch,
  pushCurrent,
  revertCommit,
  stageAll,
  tagCreate,
  tagDelete
} from './git/branchops'
import {
  addRecentRepo,
  getActiveRepo,
  getActiveWorkspaceId,
  getFavourites,
  getCompactMode,
  getGitFriend,
  getLayout,
  getNoobMode,
  getOpenRepos,
  getRecentRepos,
  getWorkspaces,
  setActiveRepo,
  setActiveWorkspaceId,
  setFavourites,
  setCompactMode,
  setGitFriend,
  setLayout,
  setNoobMode,
  setOpenRepos,
  setWorkspaces
} from './store'
import type { RepoCreateOptions } from '@shared/types'

async function wrap<T>(fn: () => Promise<T>): Promise<GitResult<T>> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // Push op-log entries to the renderer as they happen.
  onOpLog((entry) => {
    getWindow()?.webContents.send(EVENTS.opLogAppend, entry)
  })
  // Live progress for long network ops (null clears the bar).
  onGitProgress((p) => {
    getWindow()?.webContents.send(EVENTS.gitProgress, p)
  })

  ipcMain.handle(CHANNELS.gitAvailable, () =>
    wrap(async () => ({ version: await gitVersion() }))
  )

  ipcMain.handle(CHANNELS.dialogOpenRepo, async () => {
    return wrap(async () => {
      const win = getWindow()
      const res = await dialog.showOpenDialog(win!, {
        title: 'Open Git Repository',
        properties: ['openDirectory']
      })
      if (res.canceled || res.filePaths.length === 0) return null
      const info = await openRepo(res.filePaths[0])
      addRecentRepo(info.path, info.name)
      return info
    })
  })

  ipcMain.handle(CHANNELS.repoOpen, (_e, req: { path: string }) =>
    wrap(async () => {
      const info = await openRepo(req.path)
      addRecentRepo(info.path, info.name)
      return info
    })
  )

  ipcMain.handle(CHANNELS.repoRecent, () =>
    wrap(async () => getRecentRepos().map((r) => ({ path: r.path, name: r.name || basename(r.path) })))
  )

  ipcMain.handle(CHANNELS.repoStatus, (_e, req: { path: string }) =>
    wrap(() => workingStatus(req.path))
  )

  ipcMain.handle(CHANNELS.repoRefs, (_e, req: { path: string }) => wrap(() => listRefs(req.path)))

  ipcMain.handle(CHANNELS.logList, (_e, req: { path: string; limit?: number; skip?: number }) =>
    wrap(() => listCommits(req.path, req.limit ?? 1000, req.skip ?? 0))
  )

  ipcMain.handle(CHANNELS.diffFile, (_e, req: { path: string; file: string; staged: boolean }) =>
    wrap(() => fileDiff(req.path, req.file, req.staged))
  )

  ipcMain.handle(
    CHANNELS.diffCommitFile,
    (_e, req: { path: string; hash: string; file: string }) =>
      wrap(() => commitFileDiff(req.path, req.hash, req.file))
  )

  ipcMain.handle(CHANNELS.commitFiles, (_e, req: { path: string; hash: string }) =>
    wrap(() => commitFiles(req.path, req.hash))
  )
  ipcMain.handle(CHANNELS.fileHistory, (_e, req: { path: string; file: string }) =>
    wrap(() => listFileCommits(req.path, req.file))
  )
  ipcMain.handle(CHANNELS.branchesContaining, (_e, req: { path: string; hash: string }) =>
    wrap(() => branchesContaining(req.path, req.hash))
  )
  ipcMain.handle(CHANNELS.fileBlame, (_e, req: { path: string; file: string }) =>
    wrap(() => blameFile(req.path, req.file))
  )

  ipcMain.handle(CHANNELS.stageFile, (_e, req: { path: string; file: string }) =>
    wrap(() => stageFile(req.path, req.file))
  )
  ipcMain.handle(CHANNELS.stagePaths, (_e, req: { path: string; paths: string[] }) =>
    wrap(() => stagePaths(req.path, req.paths))
  )
  ipcMain.handle(CHANNELS.unstagePaths, (_e, req: { path: string; paths: string[] }) =>
    wrap(() => unstagePaths(req.path, req.paths))
  )
  ipcMain.handle(CHANNELS.discardPaths, (_e, req: { path: string; paths: string[] }) =>
    wrap(() => discardPaths(req.path, req.paths))
  )

  ipcMain.handle(CHANNELS.unstageFile, (_e, req: { path: string; file: string }) =>
    wrap(() => unstageFile(req.path, req.file))
  )

  ipcMain.handle(
    CHANNELS.stagePatch,
    (_e, req: { path: string; patch: string; reverse: boolean }) =>
      wrap(() => applyPatch(req.path, req.patch, req.reverse))
  )

  ipcMain.handle(CHANNELS.discardFile, (_e, req: { path: string; file: string }) =>
    wrap(() => discardFile(req.path, req.file))
  )

  ipcMain.handle(
    CHANNELS.commitCreate,
    (_e, req: { path: string; message: string; amend: boolean }) =>
      wrap(() => createCommit(req.path, req.message, req.amend))
  )

  ipcMain.handle(CHANNELS.branchCheckout, (_e, req: { path: string; ref: string }) =>
    wrap(() => checkout(req.path, req.ref))
  )

  ipcMain.handle(CHANNELS.remoteFetch, (_e, req: { path: string }) => wrap(() => fetchAll(req.path)))
  ipcMain.handle(CHANNELS.remotePull, (_e, req: { path: string }) => wrap(() => pull(req.path)))
  ipcMain.handle(CHANNELS.remotePush, (_e, req: { path: string; force?: boolean }) =>
    wrap(() => push(req.path, req.force))
  )
  ipcMain.handle(CHANNELS.remotePushBranch, (_e, req: { path: string; branch: string }) =>
    wrap(() => pushBranch(req.path, req.branch))
  )
  ipcMain.handle(CHANNELS.remotePullBranch, (_e, req: { path: string; branch: string }) =>
    wrap(() => pullBranch(req.path, req.branch))
  )

  ipcMain.handle(CHANNELS.opLog, () => wrap(async () => getOpLog()))

  // ---- LFS ----
  ipcMain.handle(CHANNELS.lfsStatus, (_e, req: { path: string }) => wrap(() => lfsStatus(req.path)))
  ipcMain.handle(CHANNELS.lfsRules, (_e, req: { path: string }) => wrap(() => listLfsRules(req.path)))
  ipcMain.handle(CHANNELS.lfsFiles, (_e, req: { path: string }) => wrap(() => listRepoFiles(req.path)))
  ipcMain.handle(CHANNELS.lfsTrackedFiles, (_e, req: { path: string }) =>
    wrap(() => lfsTrackedFiles(req.path))
  )
  ipcMain.handle(CHANNELS.lfsTrack, (_e, req: { path: string; pattern: string }) =>
    wrap(() => trackPattern(req.path, req.pattern))
  )
  ipcMain.handle(CHANNELS.lfsUntrack, (_e, req: { path: string; pattern: string }) =>
    wrap(() => untrackPattern(req.path, req.pattern))
  )
  ipcMain.handle(CHANNELS.lfsInstall, (_e, req: { path: string }) => wrap(() => lfsInstall(req.path)))
  ipcMain.handle(CHANNELS.terminalRun, (_e, req: { path: string; args: string[] }) =>
    wrap(() => runGit(req.path, req.args))
  )

  // ---- GitHub (via gh CLI) + repo creation ----
  ipcMain.handle(CHANNELS.githubStatus, () => wrap(() => ghStatus()))
  ipcMain.handle(CHANNELS.githubOwners, () => wrap(() => ghOwners()))
  ipcMain.handle(CHANNELS.githubCreatePr, (_e, req: { path: string; base: string; head: string }) =>
    wrap(() => ghCreatePr(req.path, req.base, req.head))
  )
  ipcMain.handle(CHANNELS.githubInstall, () => wrap(() => installGh()))
  ipcMain.handle(CHANNELS.githubAuthLogin, () =>
    wrap(async () => {
      ghAuthLogin()
    })
  )
  ipcMain.handle(CHANNELS.dialogPickFolder, async () =>
    wrap(async () => {
      const win = getWindow()
      const res = await dialog.showOpenDialog(win!, {
        title: 'Choose a folder for the repository',
        properties: ['openDirectory', 'createDirectory']
      })
      return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
    })
  )
  ipcMain.handle(CHANNELS.repoCreate, (_e, req: RepoCreateOptions) =>
    wrap(async () => {
      let sshUrl: string | null = null
      if (req.publish) {
        const created = await ghCreateRepo({
          owner: req.owner,
          name: req.name,
          description: req.description,
          isPrivate: req.isPrivate
        })
        sshUrl = created.sshUrl
      }
      const info = await createRepo(req, sshUrl)
      addRecentRepo(info.path, info.name)
      return info
    })
  )
  ipcMain.handle(CHANNELS.repoClone, (_e, req: { url: string; dir: string; name: string }) =>
    wrap(async () => {
      const info = await cloneRepo(req.url, req.dir, req.name)
      addRecentRepo(info.path, info.name)
      return info
    })
  )

  // ---- Studio (Noob Mode) primitives ----
  ipcMain.handle(CHANNELS.branchCreate, (_e, req: { path: string; name: string; from?: string }) =>
    wrap(() => createBranch(req.path, req.name, req.from))
  )
  ipcMain.handle(CHANNELS.branchPrimary, (_e, req: { path: string }) =>
    wrap(() => primaryBranch(req.path))
  )
  ipcMain.handle(CHANNELS.stageAll, (_e, req: { path: string }) => wrap(() => stageAll(req.path)))
  ipcMain.handle(CHANNELS.pushCurrent, (_e, req: { path: string }) =>
    wrap(() => pushCurrent(req.path))
  )
  ipcMain.handle(CHANNELS.mergeInto, (_e, req: { path: string; target: string; source: string }) =>
    wrap(() => mergeInto(req.path, req.target, req.source))
  )

  // ---- Ref operations (context menus) ----
  ipcMain.handle(CHANNELS.branchDelete, (_e, req: { path: string; name: string; force: boolean }) =>
    wrap(() => branchDelete(req.path, req.name, req.force))
  )
  ipcMain.handle(
    CHANNELS.branchRename,
    (_e, req: { path: string; oldName: string; newName: string }) =>
      wrap(() => branchRename(req.path, req.oldName, req.newName))
  )
  ipcMain.handle(CHANNELS.tagCreate, (_e, req: { path: string; name: string; ref: string }) =>
    wrap(() => tagCreate(req.path, req.name, req.ref))
  )
  ipcMain.handle(CHANNELS.tagDelete, (_e, req: { path: string; name: string }) =>
    wrap(() => tagDelete(req.path, req.name))
  )
  ipcMain.handle(
    CHANNELS.mergeCurrent,
    (_e, req: { path: string; source: string; strategy: import('@shared/types').MergeStrategy }) =>
      wrap(() => mergeCurrent(req.path, req.source, req.strategy))
  )
  ipcMain.handle(CHANNELS.conflictState, (_e, req: { path: string }) => wrap(() => mergeState(req.path)))
  ipcMain.handle(CHANNELS.conflictRead, (_e, req: { path: string; file: string }) =>
    wrap(() => readConflictFile(req.path, req.file))
  )
  ipcMain.handle(CHANNELS.conflictWrite, (_e, req: { path: string; file: string; content: string }) =>
    wrap(() => writeResolved(req.path, req.file, req.content))
  )
  ipcMain.handle(
    CHANNELS.conflictSide,
    (_e, req: { path: string; file: string; side: 'ours' | 'theirs' }) =>
      wrap(() => resolveSide(req.path, req.file, req.side))
  )
  ipcMain.handle(CHANNELS.mergeContinue, (_e, req: { path: string }) => wrap(() => mergeContinue(req.path)))
  ipcMain.handle(CHANNELS.mergeAbort, (_e, req: { path: string }) => wrap(() => mergeAbort(req.path)))

  // ---- Stashes ----
  ipcMain.handle(CHANNELS.stashList, (_e, req: { path: string }) => wrap(() => listStashes(req.path)))
  ipcMain.handle(
    CHANNELS.stashCreate,
    (_e, req: { path: string; message: string; includeUntracked: boolean; paths?: string[] }) =>
      wrap(() => createStash(req.path, req.message, req.includeUntracked, req.paths))
  )
  ipcMain.handle(CHANNELS.stashApply, (_e, req: { path: string; ref: string }) =>
    wrap(() => applyStash(req.path, req.ref))
  )
  ipcMain.handle(CHANNELS.stashPop, (_e, req: { path: string; ref: string }) =>
    wrap(() => popStash(req.path, req.ref))
  )
  ipcMain.handle(CHANNELS.stashDrop, (_e, req: { path: string; ref: string }) =>
    wrap(() => dropStash(req.path, req.ref))
  )
  ipcMain.handle(CHANNELS.stashFiles, (_e, req: { path: string; ref: string }) =>
    wrap(() => stashFiles(req.path, req.ref))
  )
  ipcMain.handle(CHANNELS.stashDiff, (_e, req: { path: string; ref: string; file: string }) =>
    wrap(() => stashFileDiff(req.path, req.ref, req.file))
  )

  // ---- Worktrees ----
  ipcMain.handle(CHANNELS.worktreeList, (_e, req: { path: string }) =>
    wrap(() => listWorktrees(req.path))
  )
  ipcMain.handle(
    CHANNELS.worktreeAdd,
    (_e, req: { path: string; dir: string; branch: string; create: boolean; base?: string }) =>
      wrap(() => addWorktree(req.path, { path: req.dir, branch: req.branch, create: req.create, base: req.base }))
  )
  ipcMain.handle(
    CHANNELS.worktreeRemove,
    (_e, req: { path: string; worktree: string; force: boolean }) =>
      wrap(() => removeWorktree(req.path, req.worktree, req.force))
  )
  ipcMain.handle(CHANNELS.worktreePrune, (_e, req: { path: string }) =>
    wrap(() => pruneWorktrees(req.path))
  )
  ipcMain.handle(
    CHANNELS.worktreeLock,
    (_e, req: { path: string; worktree: string; reason: string }) =>
      wrap(() => lockWorktree(req.path, req.worktree, req.reason))
  )
  ipcMain.handle(CHANNELS.worktreeUnlock, (_e, req: { path: string; worktree: string }) =>
    wrap(() => unlockWorktree(req.path, req.worktree))
  )

  // ---- Interactive rebase ----
  ipcMain.handle(CHANNELS.rebaseCommits, (_e, req: { path: string; limit: number }) =>
    wrap(() => listBranchCommits(req.path, req.limit))
  )
  ipcMain.handle(
    CHANNELS.rebaseRun,
    (_e, req: { path: string; base: string | null; steps: RebaseStep[] }) =>
      wrap(() => runInteractiveRebase(req.path, req.base, req.steps))
  )
  ipcMain.handle(CHANNELS.revertCommit, (_e, req: { path: string; hash: string }) =>
    wrap(() => revertCommit(req.path, req.hash))
  )
  ipcMain.handle(CHANNELS.commitMessage, (_e, req: { path: string; hash: string }) =>
    wrap(() => commitMessage(req.path, req.hash))
  )
  ipcMain.handle(CHANNELS.commitReword, (_e, req: { path: string; hash: string; message: string }) =>
    wrap(() => rewordCommit(req.path, req.hash, req.message))
  )

  // ---- Window / shell / clipboard ----
  ipcMain.handle(CHANNELS.windowMinimize, () =>
    wrap(async () => {
      getWindow()?.minimize()
    })
  )
  ipcMain.handle(CHANNELS.windowToggleMaximize, () =>
    wrap(async () => {
      const w = getWindow()
      if (!w) return
      if (w.isMaximized()) w.unmaximize()
      else w.maximize()
    })
  )
  ipcMain.handle(CHANNELS.windowClose, () =>
    wrap(async () => {
      getWindow()?.close()
    })
  )
  ipcMain.handle(CHANNELS.windowIsMaximized, () =>
    wrap(async () => getWindow()?.isMaximized() ?? false)
  )
  ipcMain.handle(CHANNELS.clipboardWrite, (_e, req: { text: string }) =>
    wrap(async () => {
      clipboard.writeText(req.text)
    })
  )
  ipcMain.handle(CHANNELS.clipboardRead, () => wrap(async () => clipboard.readText()))
  ipcMain.handle(CHANNELS.shellReveal, (_e, req: { path: string }) =>
    wrap(async () => {
      shell.showItemInFolder(req.path)
    })
  )
  ipcMain.handle(CHANNELS.shellOpenExternal, (_e, req: { url: string }) =>
    wrap(async () => {
      await shell.openExternal(req.url)
    })
  )

  // ---- Settings ----
  ipcMain.handle(CHANNELS.settingsGet, () =>
    wrap(async () => ({
      noobMode: getNoobMode(),
      gitFriend: getGitFriend(),
      compactMode: getCompactMode(),
      openRepos: getOpenRepos(),
      activeRepo: getActiveRepo(),
      workspaces: getWorkspaces(),
      activeWorkspaceId: getActiveWorkspaceId(),
      favourites: getFavourites(),
      layout: getLayout()
    }))
  )
  ipcMain.handle(
    CHANNELS.settingsSet,
    (
      _e,
      req: {
        noobMode?: boolean
        gitFriend?: boolean
        compactMode?: boolean
        openRepos?: { path: string; name: string }[]
        activeRepo?: string | null
        workspaces?: import('@shared/types').Workspace[]
        activeWorkspaceId?: string
        favourites?: import('@shared/types').Favourites
        layout?: Record<string, number>
      }
    ) =>
      wrap(async () => {
        if (typeof req.noobMode === 'boolean') setNoobMode(req.noobMode)
        if (typeof req.gitFriend === 'boolean') setGitFriend(req.gitFriend)
        if (typeof req.compactMode === 'boolean') setCompactMode(req.compactMode)
        if (req.openRepos) setOpenRepos(req.openRepos)
        if (req.activeRepo !== undefined) setActiveRepo(req.activeRepo)
        if (req.workspaces) setWorkspaces(req.workspaces)
        if (req.activeWorkspaceId) setActiveWorkspaceId(req.activeWorkspaceId)
        if (req.favourites) setFavourites(req.favourites)
        if (req.layout) setLayout(req.layout)
      })
  )
}
