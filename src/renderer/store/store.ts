import { create } from 'zustand'
import type {
  Commit,
  Favourites,
  FileDiff,
  FileStatus,
  GithubOwners,
  GithubStatus,
  GraphRow,
  LfsRule,
  LfsStatus,
  MergeState,
  MergeStrategy,
  OpLogEntry,
  Ref,
  RepoCreateOptions,
  RepoInfo,
  Stash,
  Workspace,
  Worktree,
  WorkingStatus
} from '@shared/types'
import type { OpenRepoRef } from '@shared/ipc-contract'
import type { RebaseStep } from '@shared/rebase-todo'
import type { GitProgressEvent } from '@shared/git-progress'
import { crumb, unwrap } from '../lib/api'
import { computeGraph } from '../lib/graph/layout'
import { sanitizeBranchName } from '../lib/branchname'
import { parseGitCommand } from '../lib/parse-cmd'

export type FavKind = 'repo' | 'branch' | 'commit'

export type View = 'history' | 'changes' | 'stashes' | 'rebase' | 'worktrees' | 'lfs' | 'conflicts'
export type DiffMode = 'split' | 'unified'

/** Friendly result surfaced by Studio (Noob Mode) guided actions. */
export interface StudioResult {
  ok: boolean
  message: string
  /** True when the situation needs a person (e.g. a merge conflict). */
  needsHuman?: boolean
  /** Offer a one-click "Install GitHub CLI" button. */
  needsGhInstall?: boolean
  /** Offer a "Sign in to GitHub" button. */
  needsGhAuth?: boolean
}

/** One entry in a right-click context menu (or the ≡ app menu). */
export type MenuItem =
  | {
      type?: 'item'
      label: string
      icon?: string
      danger?: boolean
      disabled?: boolean
      onSelect: () => void
    }
  | { type: 'divider' }
  | { type: 'header'; label: string }

export interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

export interface PromptOptions {
  title: string
  label?: string
  placeholder?: string
  initial?: string
  confirmText?: string
  danger?: boolean
  /** A longer explanatory line shown above the input / confirm buttons. */
  message?: string
  /** No text input — a yes/no confirmation. Resolves 'ok' on confirm, null on cancel. */
  confirmOnly?: boolean
  /** Allow confirming with an empty value (e.g. an optional stash message). */
  allowEmpty?: boolean
  /** Render a multi-line textarea instead of a single-line input. */
  multiline?: boolean
}

export interface PromptState extends PromptOptions {
  resolve: (value: string | null) => void
}

export interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  text: string
}

export interface SelectedFile {
  file: string
  staged: boolean
  /** When set, the file is being viewed from a historical commit. */
  commitHash?: string
}

interface State {
  gitOk: boolean | null
  gitVersion: string

  repo: RepoInfo | null
  openRepos: OpenRepoRef[]
  workspaces: Workspace[]
  activeWorkspaceId: string
  recent: { path: string; name: string }[]
  refs: Ref[]
  commits: Commit[]
  rows: GraphRow[]
  status: WorkingStatus | null

  view: View
  selectedHash: string | null
  /** A commit the History view should scroll to (consumed by CommitGraph). */
  pendingScroll: string | null
  commitFiles: FileStatus[]
  selectedFile: SelectedFile | null
  diff: FileDiff | null
  diffMode: DiffMode
  diffLoading: boolean

  opLog: OpLogEntry[]
  /** Live progress of the running network op, or null when idle. */
  gitProgress: GitProgressEvent | null
  /** True when *we* opened the log for an op, so we know to put it back after. */
  drawerAutoOpened: boolean
  /** The little mascot at the bottom of the screen. Purely cosmetic. */
  gitFriend: boolean
  /** The log is only lifted a crack (the friend peeking), not opened properly. */
  drawerPeek: boolean
  toasts: Toast[]
  paletteOpen: boolean
  drawerOpen: boolean
  busy: string | null

  // Noob Mode / Studio
  noobMode: boolean

  // Context menu + prompt dialog
  menu: MenuState | null
  prompt: PromptState | null

  // Favourites + persisted layout sizes
  favourites: Favourites
  layout: Record<string, number>

  // GitHub
  github: GithubStatus
  githubOwners: GithubOwners | null
  newRepoOpen: boolean
  cloneOpen: boolean

  // Merge + conflict resolution
  mergeState: MergeState | null
  mergeDialog: { source: string } | null

  // File history modal
  fileHistory: { file: string; commits: Commit[] } | null

  // Stashes
  stashes: Stash[]

  // Worktrees
  worktrees: Worktree[]

  // LFS
  lfsStatus: LfsStatus | null
  lfsRules: LfsRule[]
  lfsFiles: string[]
  lfsTrackedFiles: string[]
  lfsLoading: boolean

  init: () => Promise<void>
  openDialog: () => Promise<void>
  openPath: (path: string) => Promise<void>
  switchRepo: (path: string) => Promise<void>
  closeRepo: (path: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  switchWorkspace: (id: string) => Promise<void>
  renameWorkspace: (id: string, name: string) => void
  deleteWorkspace: (id: string) => void
  refresh: () => Promise<void>
  setView: (v: View) => void
  selectCommit: (hash: string) => Promise<void>
  selectWorkingFile: (file: string, staged: boolean) => Promise<void>
  selectCommitFile: (file: string, hash: string) => Promise<void>
  setDiffMode: (m: DiffMode) => void

  stage: (file: string) => Promise<void>
  unstage: (file: string) => Promise<void>
  stagePatch: (patch: string, reverse: boolean) => Promise<void>
  discard: (file: string) => Promise<void>
  stageMany: (paths: string[]) => Promise<void>
  unstageMany: (paths: string[]) => Promise<void>
  discardMany: (paths: string[]) => Promise<void>
  commit: (message: string, amend: boolean) => Promise<void>
  checkout: (ref: string) => Promise<void>
  fetch: () => Promise<void>
  pull: () => Promise<void>
  push: () => Promise<void>

  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: number) => void
  togglePalette: (open?: boolean) => void
  toggleDrawer: (open?: boolean) => void
  peekDrawer: (on: boolean) => void

  setNoobMode: (on: boolean) => Promise<void>
  setGitFriend: (on: boolean) => void

  loadLfs: () => Promise<void>
  trackLfs: (pattern: string) => Promise<void>
  untrackLfs: (pattern: string) => Promise<void>

  studioPull: () => Promise<StudioResult>
  studioNewBranch: (name: string, from: string) => Promise<StudioResult>
  studioSave: (message: string) => Promise<StudioResult>
  studioFinish: () => Promise<StudioResult>
  pollUpdates: () => Promise<void>

  // Context menu + prompt
  openMenu: (x: number, y: number, items: MenuItem[]) => void
  closeMenu: () => void
  promptText: (opts: PromptOptions) => Promise<string | null>
  resolvePrompt: (value: string | null) => void
  copy: (text: string, label?: string) => Promise<void>
  reveal: (path: string) => void
  openExternal: (url: string) => void

  // Favourites, layout, terminal, focus
  toggleFav: (kind: FavKind, id: string) => void
  isFav: (kind: FavKind, id: string) => boolean
  setSize: (key: string, px: number) => void
  runTerminal: (cmd: string) => Promise<void>
  focusCommit: (hash: string) => void
  consumeScroll: () => void
  lfsSetup: () => Promise<void>

  // Ref operations (context menus)
  createBranchAt: (name: string, startPoint: string) => Promise<void>
  branchHere: () => Promise<void>
  createPrFor: (branch: string) => Promise<void>
  pullBranch: (branch: string) => Promise<void>
  deleteBranch: (name: string) => Promise<void>
  renameBranch: (oldName: string, newName: string) => Promise<void>
  createTagAt: (name: string, ref: string) => Promise<void>
  deleteTag: (name: string) => Promise<void>
  openMergeDialog: (source: string) => void
  closeMergeDialog: () => void
  mergeInto: (source: string, strategy: MergeStrategy) => Promise<void>
  loadMergeState: () => Promise<void>
  resolveConflictFile: (file: string, content: string) => Promise<void>
  useConflictSide: (file: string, side: 'ours' | 'theirs') => Promise<void>
  continueMerge: () => Promise<void>
  abortMerge: () => Promise<void>
  openFileHistory: (file: string) => Promise<void>
  closeFileHistory: () => void

  loadStashes: () => Promise<void>
  /** Stash the working tree, or only `paths` when given. */
  createStash: (message: string, includeUntracked: boolean, paths?: string[]) => Promise<void>
  applyStash: (ref: string) => Promise<void>
  popStash: (ref: string) => Promise<void>
  dropStash: (ref: string) => Promise<void>

  runRebase: (base: string | null, steps: RebaseStep[]) => Promise<boolean>

  loadWorktrees: () => Promise<void>
  addWorktree: (dir: string, branch: string, create: boolean, base?: string) => Promise<boolean>
  removeWorktree: (worktree: string, force: boolean) => Promise<void>
  pruneWorktrees: () => Promise<void>
  lockWorktree: (worktree: string, locked: boolean) => Promise<void>
  openWorktree: (worktree: string) => Promise<void>

  revert: (hash: string) => Promise<void>
  rewordCommit: (hash: string) => Promise<void>

  // GitHub (via gh CLI) + repo creation
  githubStatus: () => Promise<void>
  installGithubCli: () => Promise<boolean>
  githubSignIn: () => void
  loadOwners: () => Promise<void>
  pickFolder: () => Promise<string | null>
  createRepo: (opts: RepoCreateOptions) => Promise<boolean>
  setNewRepo: (open: boolean) => void
  setClone: (open: boolean) => void
  cloneRepo: (url: string, dir: string, name: string) => Promise<boolean>
  readClipboard: () => Promise<string>
}

let toastId = 0

export const useStore = create<State>((set, get) => ({
  gitOk: null,
  gitVersion: '',
  repo: null,
  openRepos: [],
  workspaces: [{ id: 'default', name: 'Default', repos: [], activeRepo: null }],
  activeWorkspaceId: 'default',
  recent: [],
  refs: [],
  commits: [],
  rows: [],
  status: null,
  view: 'history',
  selectedHash: null,
  pendingScroll: null,
  commitFiles: [],
  selectedFile: null,
  diff: null,
  diffMode: 'split',
  diffLoading: false,
  opLog: [],
  gitProgress: null,
  drawerAutoOpened: false,
  gitFriend: true,
  drawerPeek: false,
  toasts: [],
  paletteOpen: false,
  drawerOpen: false,
  busy: null,
  noobMode: false,
  menu: null,
  prompt: null,
  favourites: { repos: [], branches: {}, commits: {} },
  layout: {},
  github: { connected: false, login: null },
  githubOwners: null,
  newRepoOpen: false,
  cloneOpen: false,
  mergeState: null,
  mergeDialog: null,
  fileHistory: null,
  stashes: [],
  worktrees: [],
  lfsStatus: null,
  lfsRules: [],
  lfsFiles: [],
  lfsTrackedFiles: [],
  lfsLoading: false,

  init: async () => {
    // Stream the operation log from main.
    crumb.onOpLog((entry) => {
      set((s) => ({ opLog: [...s.opLog.slice(-499), entry] }))
    })
    // Live progress for long network ops (null = finished). The first update is
    // also the cue to reveal the log — if there's no progress there's nothing to watch.
    crumb.onGitProgress((p) => {
      // A real op takes the log over properly, even if the friend was mid-peek.
      if (p && (!get().drawerOpen || get().drawerPeek)) {
        set({ drawerOpen: true, drawerAutoOpened: true, drawerPeek: false })
      }
      set({ gitProgress: p })
    })
    // Another app can open a repo in CrumbTree via crumbtree:// or a path arg.
    crumb.onDeeplink((path) => {
      get().openPath(path)
    })
    let restore: { openRepos: OpenRepoRef[]; activeRepo: string | null } = {
      openRepos: [],
      activeRepo: null
    }
    try {
      const settings = await unwrap(crumb.settingsGet())
      // Main migrates legacy open repos into a default workspace, so there is always ≥1.
      const workspaces =
        settings.workspaces.length > 0
          ? settings.workspaces
          : [{ id: 'default', name: 'Default', repos: settings.openRepos, activeRepo: settings.activeRepo }]
      const active =
        workspaces.find((w) => w.id === settings.activeWorkspaceId) ?? workspaces[0]
      set({
        noobMode: settings.noobMode,
        gitFriend: settings.gitFriend ?? true,
        workspaces,
        activeWorkspaceId: active.id,
        openRepos: active.repos,
        favourites: settings.favourites,
        layout: settings.layout
      })
      restore = { openRepos: active.repos, activeRepo: active.activeRepo }
    } catch {
      /* defaults are fine */
    }
    try {
      const v = await unwrap(crumb.gitAvailable())
      set({ gitOk: true, gitVersion: v.version })
    } catch {
      set({ gitOk: false })
      return
    }
    get().githubStatus()
    try {
      const recent = await unwrap(crumb.recentRepos())
      set({ recent })
      const target =
        restore.activeRepo ?? restore.openRepos[0]?.path ?? recent[0]?.path ?? null
      if (target) await get().openPath(target)
    } catch {
      /* no recent repos yet */
    }
  },

  openDialog: async () => {
    try {
      const info = await unwrap(crumb.openRepoDialog())
      if (!info) return
      await get().openPath(info.path)
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  openPath: async (path) => {
    set({ busy: 'Opening repository…' })
    try {
      const repo = await unwrap(crumb.openRepo(path))
      // Add to the open-repo tabs (dedupe by resolved path) and make it active.
      const openRepos = get().openRepos.filter((r) => r.path !== repo.path)
      openRepos.push({ path: repo.path, name: repo.name })
      set({
        repo,
        openRepos,
        selectedHash: null,
        selectedFile: null,
        diff: null,
        commitFiles: []
      })
      persistRepos(get)
      const recent = await unwrap(crumb.recentRepos())
      set({ recent })
      await get().refresh()
      get().setView('history')
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  switchRepo: async (path) => {
    if (get().repo?.path === path) return
    set({ busy: 'Switching repository…' })
    try {
      const repo = await unwrap(crumb.openRepo(path))
      set({
        repo,
        selectedHash: null,
        selectedFile: null,
        diff: null,
        commitFiles: [],
        view: 'history'
      })
      persistRepos(get)
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  closeRepo: async (path) => {
    const openRepos = get().openRepos.filter((r) => r.path !== path)
    const wasActive = get().repo?.path === path
    set({ openRepos })
    if (wasActive) {
      if (openRepos.length > 0) {
        await get().switchRepo(openRepos[openRepos.length - 1].path)
      } else {
        set({ repo: null, refs: [], commits: [], rows: [], status: null, selectedHash: null })
      }
    }
    persistRepos(get)
  },

  createWorkspace: async (name) => {
    persistRepos(get) // save the current workspace's tabs first
    const id = `ws-${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`
    const ws: Workspace = { id, name: name.trim() || 'Workspace', repos: [], activeRepo: null }
    set({ ...CLEARED_REPO_STATE, workspaces: [...get().workspaces, ws], activeWorkspaceId: id, openRepos: [] })
    crumb.settingsSet({ workspaces: get().workspaces, activeWorkspaceId: id }).catch(() => {})
    get().toast('success', `Workspace “${ws.name}” created`)
  },

  switchWorkspace: async (id) => {
    if (id === get().activeWorkspaceId) return
    persistRepos(get) // stash the current tabs into the current workspace
    const target = get().workspaces.find((w) => w.id === id)
    if (!target) return
    set({ ...CLEARED_REPO_STATE, activeWorkspaceId: id, openRepos: target.repos })
    crumb.settingsSet({ activeWorkspaceId: id }).catch(() => {})
    const targetRepo = target.activeRepo ?? target.repos[0]?.path ?? null
    if (targetRepo) await get().openPath(targetRepo)
  },

  renameWorkspace: (id, name) => {
    const clean = name.trim()
    if (!clean) return
    const workspaces = get().workspaces.map((w) => (w.id === id ? { ...w, name: clean } : w))
    set({ workspaces })
    crumb.settingsSet({ workspaces }).catch(() => {})
  },

  deleteWorkspace: (id) => {
    const all = get().workspaces
    if (all.length < 2) {
      get().toast('info', 'You need at least one workspace.')
      return
    }
    const ws = all.find((w) => w.id === id)
    if (!ws) return
    if (!confirm(`Delete workspace “${ws.name}”? Its tabs are cleared (repositories stay on disk).`)) return
    const workspaces = all.filter((w) => w.id !== id)
    set({ workspaces })
    if (get().activeWorkspaceId === id) {
      crumb.settingsSet({ workspaces }).catch(() => {})
      get().switchWorkspace(workspaces[0].id)
    } else {
      crumb.settingsSet({ workspaces }).catch(() => {})
    }
  },

  refresh: async () => {
    const repo = get().repo
    if (!repo) return
    try {
      const [refs, commits, status, merge, stashes] = await Promise.all([
        unwrap(crumb.refs(repo.path)),
        unwrap(crumb.log(repo.path, 2000)),
        unwrap(crumb.status(repo.path)),
        unwrap(crumb.conflictState(repo.path)),
        unwrap(crumb.stashList(repo.path))
      ])
      const reopened = await unwrap(crumb.openRepo(repo.path))
      set({
        refs,
        commits,
        rows: computeGraph(commits),
        status,
        repo: reopened,
        mergeState: merge.inProgress ? merge : null,
        stashes
      })
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  setView: (v) => set({ view: v }),

  selectCommit: async (hash) => {
    const repo = get().repo
    if (!repo) return
    set({ selectedHash: hash, selectedFile: null, diff: null })
    try {
      const files = await unwrap(crumb.commitFiles(repo.path, hash))
      set({ commitFiles: files })
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  selectWorkingFile: async (file, staged) => {
    const repo = get().repo
    if (!repo) return
    set({ selectedFile: { file, staged }, diffLoading: true, diff: null })
    try {
      const diff = await unwrap(crumb.fileDiff(repo.path, file, staged))
      set({ diff, diffLoading: false })
    } catch (e) {
      set({ diffLoading: false })
      get().toast('error', errMsg(e))
    }
  },

  selectCommitFile: async (file, hash) => {
    const repo = get().repo
    if (!repo) return
    set({ selectedFile: { file, staged: false, commitHash: hash }, diffLoading: true, diff: null })
    try {
      const diff = await unwrap(crumb.commitFileDiff(repo.path, hash, file))
      set({ diff, diffLoading: false })
    } catch (e) {
      set({ diffLoading: false })
      get().toast('error', errMsg(e))
    }
  },

  setDiffMode: (m) => set({ diffMode: m }),

  stage: async (file) => run(get, set, () => crumb.stageFile(get().repo!.path, file)),
  unstage: async (file) => run(get, set, () => crumb.unstageFile(get().repo!.path, file)),
  discard: async (file) => run(get, set, () => crumb.discardFile(get().repo!.path, file)),

  // Bulk variants: ONE git command + ONE refresh. Never loop the single-file ops —
  // git holds one index.lock, so parallel adds collide, and per-file refreshes storm.
  stageMany: async (paths) => {
    if (paths.length === 0) return
    await run(get, set, () => crumb.stagePaths(get().repo!.path, paths))
  },
  unstageMany: async (paths) => {
    if (paths.length === 0) return
    await run(get, set, () => crumb.unstagePaths(get().repo!.path, paths))
  },
  discardMany: async (paths) => {
    if (paths.length === 0) return
    await run(get, set, () => crumb.discardPaths(get().repo!.path, paths))
  },

  stagePatch: async (patch, reverse) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.stagePatch(repo.path, patch, reverse))
      await get().refresh()
      // Re-load the current file diff so the view reflects the new staged state.
      const sel = get().selectedFile
      if (sel && !sel.commitHash) await get().selectWorkingFile(sel.file, sel.staged)
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  commit: async (message, amend) => {
    const repo = get().repo
    if (!repo) return

    // Committing on a detached HEAD strands the commit on no branch: it can't be
    // pushed and git will eventually garbage-collect it. Put it on a branch first
    // so "commit then push" works the way you'd expect.
    if (repo.head.detached && !amend) {
      const name = await get().promptText({
        title: 'You’re not on a branch',
        message:
          'HEAD is detached, so this commit wouldn’t belong to any branch and couldn’t be pushed. Name a branch to commit on and I’ll create it here first.',
        placeholder: 'my-branch',
        confirmText: 'Create & commit'
      })
      if (!name?.trim()) return
      try {
        await unwrap(crumb.branchCreate(repo.path, name.trim(), undefined))
      } catch (e) {
        get().toast('error', errMsg(e))
        return
      }
    }

    try {
      await unwrap(crumb.commit(repo.path, message, amend))
      get().toast('success', amend ? 'Commit amended' : 'Commit created')
      set({ selectedFile: null, diff: null })
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  checkout: async (ref) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.checkout(repo.path, ref))
      get().toast('success', `Checked out ${ref}`)
      await get().refresh()
    } catch (e) {
      const msg = errMsg(e)
      // A dirty working tree blocks the switch. Rather than dumping git's raw
      // "your local changes would be overwritten / could not detach HEAD", offer
      // to stash the changes aside and switch (they can restore from Stashes).
      const blocked = /overwritten by checkout|could not detach|Please commit your changes/i.test(msg)
      if (blocked) {
        const ok = confirm(
          `Switching to ${ref} would overwrite uncommitted changes.\n\nStash your changes and switch anyway? You can bring them back any time from Stashes.`
        )
        if (!ok) return
        try {
          await unwrap(crumb.stashCreate(repo.path, `Before switching to ${ref}`, true))
          await unwrap(crumb.checkout(repo.path, ref))
          get().toast('success', `Checked out ${ref} — your changes are stashed.`)
          await get().refresh()
        } catch (e2) {
          get().toast('error', errMsg(e2))
        }
        return
      }
      get().toast('error', msg)
    }
  },

  fetch: async () => sync(get, set, 'Fetching…', () => crumb.fetch(get().repo!.path), 'Fetched'),
  pull: async () => sync(get, set, 'Pulling…', () => crumb.pull(get().repo!.path), 'Pulled'),
  push: async () => sync(get, set, 'Pushing…', () => crumb.push(get().repo!.path), 'Pushed'),

  toast: (kind, text) => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }))
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  togglePalette: (open) => set((s) => ({ paletteOpen: open ?? !s.paletteOpen })),
  // A manual toggle takes ownership: don't auto-restore over the user's choice,
  // and always open properly rather than leaving it at the friend's peek height.
  toggleDrawer: (open) =>
    set((s) => ({ drawerOpen: open ?? !s.drawerOpen, drawerAutoOpened: false, drawerPeek: false })),

  // The friend lifting the log a crack. Kept separate from toggleDrawer so a real
  // open can never be mistaken for a peek (and vice versa).
  peekDrawer: (on) => set({ drawerOpen: on, drawerPeek: on }),

  setNoobMode: async (on) => {
    set({ noobMode: on })
    try {
      await unwrap(crumb.settingsSet({ noobMode: on }))
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  setGitFriend: (on) => {
    set({ gitFriend: on })
    crumb.settingsSet({ gitFriend: on }).catch(() => {})
    get().toast('info', on ? 'Your git friend is back.' : 'Your git friend has gone for a nap.')
  },

  // ---- Context menu + prompt ----
  openMenu: (x, y, items) => set({ menu: { x, y, items } }),
  closeMenu: () => set({ menu: null }),
  promptText: (opts) =>
    new Promise<string | null>((resolve) => {
      set({ prompt: { ...opts, resolve } })
    }),
  resolvePrompt: (value) => {
    const p = get().prompt
    set({ prompt: null })
    p?.resolve(value)
  },
  copy: async (text, label) => {
    try {
      await unwrap(crumb.clipboardWrite(text))
      get().toast('success', label ? `Copied ${label}` : 'Copied to clipboard')
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  reveal: (path) => {
    crumb.shellReveal(path).catch(() => {})
  },
  openExternal: (url) => {
    crumb.shellOpenExternal(url).catch(() => {})
  },

  // ---- Ref operations ----
  /**
   * Open a GitHub pull request for any branch — it doesn't need to be checked out.
   * Pushes it first, since GitHub can only review a branch that's on the remote.
   */
  // Fast-forward a branch from its upstream without checking it out.
  pullBranch: async (branch) => {
    const repo = get().repo
    if (!repo) return
    if (branch === repo.head.branch) {
      // Can't refspec-fetch into the checked-out branch — that's a normal pull.
      await get().pull()
      return
    }
    set({ busy: `Updating ${branch}…` })
    try {
      const res = await unwrap(crumb.pullBranch(repo.path, branch))
      await get().refresh()
      if (res.updated > 0) {
        get().toast('success', `Updated ${branch} — ${res.updated} new commit${res.updated === 1 ? '' : 's'} from ${res.upstream}.`)
      } else {
        get().toast('info', `${branch} is already up to date with ${res.upstream}.`)
      }
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  createPrFor: async (branch) => {
    const repo = get().repo
    if (!repo) return
    set({ busy: 'Opening pull request…' })
    try {
      await get().githubStatus()
      const gh = get().github
      if (!gh.connected) {
        get().toast(
          'error',
          gh.reason === 'no-cli'
            ? 'Opening a PR needs the GitHub CLI — install it from the New repository dialog, then try again.'
            : 'Sign in to GitHub first, then try again.'
        )
        return
      }
      const primary = await unwrap(crumb.branchPrimary(repo.path))
      if (branch === primary) {
        get().toast('info', `${branch} is the main branch — open a PR from a different branch.`)
        return
      }
      await unwrap(crumb.pushBranch(repo.path, branch))
      const pr = await unwrap(crumb.githubCreatePr(repo.path, primary, branch))
      await get().refresh()
      if (pr.url) {
        get().openExternal(pr.url)
        get().toast('success', `Pull request ready: ${branch} → ${primary}`)
      } else {
        get().toast('success', `${branch} is pushed and ready for review.`)
      }
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  // Rescue a detached HEAD: put a branch at the current commit and switch onto it,
  // which makes any commits made here reachable (and pushable) again.
  branchHere: async () => {
    const repo = get().repo
    if (!repo) return
    const name = await get().promptText({
      title: 'Create a branch here',
      message: `Puts a branch at ${repo.head.hash ?? 'HEAD'} and switches to it, so any commits you made here are kept.`,
      placeholder: 'my-branch',
      confirmText: 'Create branch'
    })
    if (!name?.trim()) return
    try {
      await unwrap(crumb.branchCreate(repo.path, name.trim(), undefined))
      get().toast('success', `You’re now on ${name.trim()}`)
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  createBranchAt: async (name, startPoint) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.branchCreate(repo.path, name, startPoint))
      get().toast('success', `Created branch ${name}`)
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  deleteBranch: async (name) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.branchDelete(repo.path, name, false))
      get().toast('success', `Deleted branch ${name}`)
      await get().refresh()
    } catch (e) {
      // Unmerged branch — offer a forced delete.
      if (/not fully merged/i.test(errMsg(e))) {
        if (confirm(`Branch "${name}" has commits that aren't merged anywhere. Delete it anyway?`)) {
          try {
            await unwrap(crumb.branchDelete(repo.path, name, true))
            get().toast('success', `Deleted branch ${name}`)
            await get().refresh()
            return
          } catch (e2) {
            get().toast('error', errMsg(e2))
            return
          }
        }
        return
      }
      get().toast('error', errMsg(e))
    }
  },
  renameBranch: async (oldName, newName) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.branchRename(repo.path, oldName, newName))
      get().toast('success', `Renamed to ${newName}`)
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  createTagAt: async (name, ref) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.tagCreate(repo.path, name, ref))
      get().toast('success', `Created tag ${name}`)
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  deleteTag: async (name) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.tagDelete(repo.path, name))
      get().toast('success', `Deleted tag ${name}`)
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  openMergeDialog: (source) => set({ mergeDialog: { source } }),
  closeMergeDialog: () => set({ mergeDialog: null }),

  mergeInto: async (source, strategy) => {
    const repo = get().repo
    if (!repo) return
    set({ mergeDialog: null, busy: 'Merging…' })
    try {
      let outcome
      try {
        outcome = await unwrap(crumb.mergeCurrent(repo.path, source, strategy))
      } catch (e) {
        // Git refuses to START a merge when uncommitted changes would be clobbered
        // ("would be overwritten by merge"). Offer to stash them and merge — real
        // merge conflicts are then left in progress for you to resolve.
        const msg = errMsg(e)
        const blocked = /overwritten by merge|Please commit your changes or stash them/i.test(msg)
        if (!blocked) throw e
        set({ busy: null })
        const ok = confirm(
          `The merge can’t start — you have uncommitted changes to files it needs to update.\n\nStash your changes and merge? Any conflicts will be left for you to resolve (in-app or your editor), and you can restore your stashed changes afterward from Stashes.`
        )
        if (!ok) return
        set({ busy: 'Stashing, then merging…' })
        await unwrap(crumb.stashCreate(repo.path, `Before merging ${source}`, true))
        outcome = await unwrap(crumb.mergeCurrent(repo.path, source, strategy))
      }
      await get().refresh()
      const branch = repo.head.branch
      if (outcome.conflict) {
        await get().loadMergeState()
        set({ view: 'conflicts' })
        get().toast('info', `Merging ${source} hit conflicts — resolve them (here or in your editor), then Continue.`)
      } else if (outcome.upToDate) {
        // Nothing happened — don't pretend it did.
        if (outcome.behindUpstream) {
          get().toast(
            'info',
            `Nothing to merge: ${source} is already in ${branch}, and your local ${source} is ${outcome.behindUpstream.count} behind ${outcome.behindUpstream.ref}. Pull ${source} (or merge ${outcome.behindUpstream.ref}) to get the newer changes.`
          )
        } else {
          get().toast('info', `Nothing to merge — ${source} is already in ${branch}.`)
        }
      } else {
        get().toast('success', `Merged ${source} into ${branch}`)
      }
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  loadMergeState: async () => {
    const repo = get().repo
    if (!repo) return
    try {
      const st = await unwrap(crumb.conflictState(repo.path))
      set({ mergeState: st.inProgress ? st : null })
    } catch {
      set({ mergeState: null })
    }
  },

  resolveConflictFile: async (file, content) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.conflictWrite(repo.path, file, content))
      await get().loadMergeState()
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  useConflictSide: async (file, side) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.conflictSide(repo.path, file, side))
      await get().loadMergeState()
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  continueMerge: async () => {
    const repo = get().repo
    if (!repo) return
    set({ busy: 'Finishing merge…' })
    try {
      // Re-read state first — conflicts may have been resolved in an external editor
      // (Rider, VS Code…). Only files that were staged there count as resolved.
      const cur = await unwrap(crumb.conflictState(repo.path))
      if (cur.conflicted.length > 0) {
        set({ mergeState: cur.inProgress ? cur : null })
        const n = cur.conflicted.length
        get().toast(
          'error',
          `${n} file${n === 1 ? '' : 's'} still ${n === 1 ? 'has' : 'have'} conflicts. Resolve ${n === 1 ? 'it' : 'them'} (here or in your editor and stage the file), then Continue.`
        )
        return
      }
      const st = await unwrap(crumb.mergeContinue(repo.path))
      set({ mergeState: st.inProgress ? st : null })
      await get().refresh()
      if (st.inProgress) {
        get().toast('info', 'More conflicts to resolve.')
      } else {
        get().toast('success', 'Merge complete.')
        set({ view: 'history' })
      }
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  abortMerge: async () => {
    const repo = get().repo
    if (!repo) return
    if (!confirm('Cancel this merge and undo any resolutions? Your branches are left unchanged.')) return
    try {
      await unwrap(crumb.mergeAbort(repo.path))
      set({ mergeState: null, view: 'history' })
      get().toast('info', 'Merge cancelled.')
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  openFileHistory: async (file) => {
    const repo = get().repo
    if (!repo) return
    try {
      const commits = await unwrap(crumb.fileHistory(repo.path, file))
      set({ fileHistory: { file, commits } })
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  closeFileHistory: () => set({ fileHistory: null }),

  loadStashes: async () => {
    const repo = get().repo
    if (!repo) {
      set({ stashes: [] })
      return
    }
    try {
      const stashes = await unwrap(crumb.stashList(repo.path))
      set({ stashes })
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  createStash: async (message, includeUntracked, paths) => {
    const repo = get().repo
    if (!repo) return
    set({ busy: 'stash' })
    try {
      await unwrap(crumb.stashCreate(repo.path, message, includeUntracked, paths))
      get().toast(
        'success',
        paths?.length === 1 ? `Stashed ${paths[0]}` : 'Changes stashed.'
      )
      await get().loadStashes()
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },
  applyStash: async (ref) => {
    const repo = get().repo
    if (!repo) return
    set({ busy: 'stash' })
    try {
      await unwrap(crumb.stashApply(repo.path, ref))
      get().toast('success', 'Stash applied.')
      await get().loadStashes()
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },
  popStash: async (ref) => {
    const repo = get().repo
    if (!repo) return
    set({ busy: 'stash' })
    try {
      await unwrap(crumb.stashPop(repo.path, ref))
      get().toast('success', 'Stash applied and removed.')
      await get().loadStashes()
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },
  dropStash: async (ref) => {
    const repo = get().repo
    if (!repo) return
    if (!confirm(`Delete ${ref}? This can't be undone.`)) return
    try {
      await unwrap(crumb.stashDrop(repo.path, ref))
      get().toast('info', 'Stash deleted.')
      await get().loadStashes()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  runRebase: async (base, steps) => {
    const repo = get().repo
    if (!repo) return false
    set({ busy: 'Rebasing…' })
    try {
      const out = await unwrap(crumb.rebaseRun(repo.path, base, steps))
      await get().refresh()
      if (out.conflict) {
        await get().loadMergeState()
        get().toast('info', 'Rebase hit a conflict — resolve it to carry on.')
        set({ view: 'conflicts' })
        return false
      }
      const st = await unwrap(crumb.conflictState(repo.path))
      if (st.inProgress) {
        // An `edit` step paused the rebase for you to amend.
        set({ mergeState: st })
        get().toast('info', 'Rebase paused so you can edit this commit.')
        return true
      }
      get().toast('success', 'Rebase complete.')
      set({ view: 'history' })
      return true
    } catch (e) {
      get().toast('error', errMsg(e))
      return false
    } finally {
      set({ busy: null })
    }
  },

  loadWorktrees: async () => {
    const repo = get().repo
    if (!repo) {
      set({ worktrees: [] })
      return
    }
    try {
      const worktrees = await unwrap(crumb.worktreeList(repo.path))
      set({ worktrees })
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  addWorktree: async (dir, branch, create, base) => {
    const repo = get().repo
    if (!repo) return false
    set({ busy: 'Creating worktree…' })
    try {
      await unwrap(crumb.worktreeAdd(repo.path, dir, branch, create, base))
      get().toast('success', `Worktree for ${branch} created.`)
      await get().loadWorktrees()
      return true
    } catch (e) {
      get().toast('error', errMsg(e))
      return false
    } finally {
      set({ busy: null })
    }
  },
  removeWorktree: async (worktree, force) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.worktreeRemove(repo.path, worktree, force))
      get().toast('info', 'Worktree removed.')
      await get().loadWorktrees()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  pruneWorktrees: async () => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.worktreePrune(repo.path))
      get().toast('info', 'Pruned stale worktrees.')
      await get().loadWorktrees()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  lockWorktree: async (worktree, locked) => {
    const repo = get().repo
    if (!repo) return
    try {
      if (locked) await unwrap(crumb.worktreeLock(repo.path, worktree, ''))
      else await unwrap(crumb.worktreeUnlock(repo.path, worktree))
      await get().loadWorktrees()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  openWorktree: async (worktree) => {
    // A worktree is its own working directory — open it as a tab.
    await get().openPath(worktree)
  },

  revert: async (hash) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.revertCommit(repo.path, hash))
      get().toast('success', 'Reverted commit')
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  rewordCommit: async (hash) => {
    const repo = get().repo
    if (!repo) return
    let current = ''
    try {
      current = await unwrap(crumb.commitMessage(repo.path, hash))
    } catch {
      /* fall back to an empty editor */
    }
    const isHead = repo.head.hash != null && hash.startsWith(repo.head.hash)
    const next = await get().promptText({
      title: 'Reword commit message',
      message: isHead
        ? 'Edit this commit’s message. Your staged and unstaged changes are left untouched.'
        : 'Editing an earlier commit rewrites it — and every commit after it — with new IDs. Avoid this on commits you’ve already pushed and shared.',
      multiline: true,
      initial: current,
      confirmText: 'Reword'
    })
    if (next === null || !next.trim() || next.trim() === current.trim()) return
    set({ busy: 'Rewording…' })
    try {
      await unwrap(crumb.rewordCommit(repo.path, hash, next))
      get().toast('success', 'Commit message updated.')
      await get().refresh()
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ busy: null })
    }
  },

  // ---- Favourites ----
  toggleFav: (kind, id) => {
    const repoPath = get().repo?.path
    const favs: Favourites = {
      repos: [...get().favourites.repos],
      branches: { ...get().favourites.branches },
      commits: { ...get().favourites.commits }
    }
    if (kind === 'repo') {
      favs.repos = toggleList(favs.repos, id)
    } else if (repoPath) {
      const bag = kind === 'branch' ? favs.branches : favs.commits
      bag[repoPath] = toggleList(bag[repoPath] ?? [], id)
    }
    set({ favourites: favs })
    crumb.settingsSet({ favourites: favs }).catch(() => {})
  },
  isFav: (kind, id) => {
    const favs = get().favourites
    if (kind === 'repo') return favs.repos.includes(id)
    const repoPath = get().repo?.path
    if (!repoPath) return false
    const bag = kind === 'branch' ? favs.branches : favs.commits
    return (bag[repoPath] ?? []).includes(id)
  },

  // ---- Layout sizes (persisted, debounced) ----
  setSize: (key, px) => {
    const layout = { ...get().layout, [key]: Math.round(px) }
    set({ layout })
    scheduleLayoutSave(layout)
  },

  // ---- Terminal ----
  runTerminal: async (cmd) => {
    const repo = get().repo
    if (!repo) return
    const parsed = parseGitCommand(cmd)
    if (!parsed.ok || !parsed.args) {
      appendOpLog(set, {
        command: cmd.trim() || cmd,
        code: 1,
        ok: false,
        stderr: parsed.error,
        input: true
      })
      return
    }
    try {
      const res = await unwrap(crumb.terminalRun(repo.path, parsed.args))
      appendOpLog(set, {
        command: `git ${parsed.args.join(' ')}`,
        code: res.code,
        ok: res.code === 0,
        stdout: res.stdout.trimEnd() || undefined,
        stderr: res.stderr.trim() || undefined,
        input: true
      })
      await get().refresh()
    } catch (e) {
      appendOpLog(set, { command: `git ${parsed.args.join(' ')}`, code: 1, ok: false, stderr: errMsg(e), input: true })
    }
  },

  // ---- Focus a commit in History (from clicking a ref) ----
  focusCommit: (hash) => {
    // Refs carry a short hash; resolve to the full commit hash the graph rows use.
    const full = get().commits.find((c) => c.hash === hash || c.hash.startsWith(hash))?.hash ?? hash
    set({ view: 'history', pendingScroll: full })
    get().selectCommit(full)
  },
  consumeScroll: () => set({ pendingScroll: null }),

  // ---- LFS setup ----
  lfsSetup: async () => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.lfsInstall(repo.path))
      get().toast('success', 'Git LFS is set up for this repository')
      await get().loadLfs()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  // ---- GitHub (via gh CLI) + repo creation ----
  githubStatus: async () => {
    try {
      const status = await unwrap(crumb.githubStatus())
      set({ github: status, githubOwners: status.connected ? get().githubOwners : null })
    } catch {
      set({ github: { connected: false, login: null } })
    }
  },
  installGithubCli: async () => {
    get().toast('info', 'Installing the GitHub CLI… this can take a minute.')
    try {
      await unwrap(crumb.githubInstall())
      await get().githubStatus()
      get().toast('success', 'GitHub CLI installed. Sign in next to finish.')
      return true
    } catch (e) {
      get().toast('error', errMsg(e))
      return false
    }
  },
  githubSignIn: () => {
    crumb.githubAuthLogin().catch(() => {})
    get().toast('info', 'Opened a sign-in window — complete it there, then re-check.')
  },
  loadOwners: async () => {
    if (!get().github.connected) return
    try {
      const owners = await unwrap(crumb.githubOwners())
      set({ githubOwners: owners })
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },
  pickFolder: async () => {
    try {
      return await unwrap(crumb.pickFolder())
    } catch (e) {
      get().toast('error', errMsg(e))
      return null
    }
  },
  createRepo: async (opts) => {
    set({ busy: opts.publish ? 'Creating and publishing…' : 'Creating repository…' })
    try {
      const info = await unwrap(crumb.createRepo(opts))
      get().toast('success', opts.publish ? `Created & published ${info.name}` : `Created ${info.name}`)
      await get().openPath(info.path)
      return true
    } catch (e) {
      get().toast('error', errMsg(e))
      return false
    } finally {
      set({ busy: null })
    }
  },
  setNewRepo: (open) => set({ newRepoOpen: open }),
  setClone: (open) => set({ cloneOpen: open }),
  cloneRepo: async (url, dir, name) => {
    // Cloning streams progress; the log reveals itself once that starts.
    const wasOpen = get().drawerOpen
    set({ busy: 'Cloning…' })
    try {
      const info = await unwrap(crumb.cloneRepo(url, dir, name))
      get().toast('success', `Cloned ${info.name}`)
      await get().openPath(info.path)
      if (!wasOpen && get().drawerAutoOpened) set({ drawerOpen: false })
      return true
    } catch (e) {
      get().toast('error', errMsg(e))
      return false
    } finally {
      set({ busy: null, gitProgress: null, drawerAutoOpened: false })
    }
  },
  readClipboard: async () => {
    try {
      return await unwrap(crumb.clipboardRead())
    } catch {
      return ''
    }
  },

  // ---- LFS ----
  loadLfs: async () => {
    const repo = get().repo
    if (!repo) return
    set({ lfsLoading: true })
    try {
      const status = await unwrap(crumb.lfsStatus(repo.path))
      set({ lfsStatus: status })
      if (status.installed) {
        const [rules, files, tracked] = await Promise.all([
          unwrap(crumb.lfsRules(repo.path)),
          unwrap(crumb.lfsFiles(repo.path)),
          unwrap(crumb.lfsTrackedFiles(repo.path))
        ])
        set({ lfsRules: rules, lfsFiles: files, lfsTrackedFiles: tracked })
      }
    } catch (e) {
      get().toast('error', errMsg(e))
    } finally {
      set({ lfsLoading: false })
    }
  },

  trackLfs: async (pattern) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.lfsTrack(repo.path, pattern))
      get().toast('success', `Now tracking ${pattern} in LFS`)
      await get().loadLfs()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  untrackLfs: async (pattern) => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.lfsUntrack(repo.path, pattern))
      get().toast('success', `Stopped tracking ${pattern}`)
      await get().loadLfs()
    } catch (e) {
      get().toast('error', errMsg(e))
    }
  },

  // ---- Studio (Noob Mode) guided flows ----
  studioPull: async () => {
    const repo = get().repo
    if (!repo) return { ok: false, message: 'No project open.' }
    const before = repo.head.hash
    set({ busy: 'Getting the latest…' })
    try {
      await unwrap(crumb.pull(repo.path))
      await get().refresh()
      const after = get().repo?.head.hash
      const msg =
        before === after ? "You're already up to date — nothing new." : 'Got the latest changes. ✓'
      return { ok: true, message: msg }
    } catch (e) {
      return {
        ok: false,
        needsHuman: true,
        message: "Couldn't get the latest automatically — there may be changes that need combining. Ask a teammate to help, or use full mode."
      }
    } finally {
      set({ busy: null })
    }
  },

  studioNewBranch: async (name, from) => {
    const repo = get().repo
    if (!repo) return { ok: false, message: 'No project open.' }
    const clean = sanitizeBranchName(name)
    if (!clean) return { ok: false, message: 'Please type a name using letters or numbers.' }
    set({ busy: 'Starting new work…' })
    try {
      const base = from || (await unwrap(crumb.branchPrimary(repo.path)))
      await unwrap(crumb.branchCreate(repo.path, clean, base))
      await get().refresh()
      return {
        ok: true,
        message: `You're now working in "${clean}", branched from "${base}". Your changes stay separate until you finish.`
      }
    } catch (e) {
      return { ok: false, message: errMsg(e) }
    } finally {
      set({ busy: null })
    }
  },

  studioSave: async (message) => {
    const repo = get().repo
    if (!repo) return { ok: false, message: 'No project open.' }
    const msg = message.trim() || 'Update'
    set({ busy: 'Saving your work…' })
    try {
      await unwrap(crumb.stageAll(repo.path))
      await unwrap(crumb.commit(repo.path, msg, false))
      await unwrap(crumb.pushCurrent(repo.path))
      await get().refresh()
      return { ok: true, message: 'Saved and uploaded. ✓' }
    } catch (e) {
      return {
        ok: false,
        needsHuman: true,
        message: `Saved locally, but uploading ran into a problem: ${errMsg(e)}`
      }
    } finally {
      set({ busy: null })
    }
  },

  // Finish = open a pull request (never merge locally in Minimal Mode).
  studioFinish: async () => {
    const repo = get().repo
    if (!repo) return { ok: false, message: 'No project open.' }
    const current = repo.head.branch
    if (!current) return { ok: false, message: 'You need to be on a piece of work to finish.' }
    set({ busy: 'Sending for review…' })
    try {
      const primary = await unwrap(crumb.branchPrimary(repo.path))
      if (primary === current) {
        return {
          ok: false,
          message: `You're on the main project (${primary}). Start new work first, then finish it.`
        }
      }
      // Sending for review needs the GitHub CLI — offer to install / sign in if missing.
      await get().githubStatus()
      const gh = get().github
      if (!gh.connected) {
        if (gh.reason === 'no-cli') {
          return {
            ok: false,
            needsGhInstall: true,
            message: 'To send your work for review, CrumbTree uses the GitHub CLI. I can install it for you.'
          }
        }
        return {
          ok: false,
          needsGhAuth: true,
          message: 'Almost there — you just need to sign in to GitHub. I can open the sign-in for you.'
        }
      }
      // Make sure the branch is uploaded so there's something to review.
      await unwrap(crumb.pushCurrent(repo.path))
      const pr = await unwrap(crumb.githubCreatePr(repo.path, primary, current))
      await get().refresh()
      if (pr.url) get().openExternal(pr.url)
      return {
        ok: true,
        message: pr.url
          ? 'Opened a review request (pull request) — it’s open in your browser. A teammate can review and add it to the main project.'
          : 'Your work is uploaded and ready for review.'
      }
    } catch (e) {
      return { ok: false, needsHuman: true, message: errMsg(e) }
    } finally {
      set({ busy: null })
    }
  },

  // Quietly fetch to keep the "behind" count fresh (used by Minimal Mode polling).
  pollUpdates: async () => {
    const repo = get().repo
    if (!repo) return
    try {
      await unwrap(crumb.fetch(repo.path))
      await get().refresh()
    } catch {
      /* offline or no remote — ignore */
    }
  }
}))

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function toggleList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

let termId = -1
function appendOpLog(
  set: (fn: (s: State) => Partial<State>) => void,
  partial: Partial<OpLogEntry> & { command: string; code: number; ok: boolean }
): void {
  const entry: OpLogEntry = {
    id: termId--,
    cwd: '',
    ms: 0,
    at: Date.now(),
    ...partial
  }
  set((s) => ({ opLog: [...s.opLog.slice(-499), entry] }))
}

let layoutTimer: ReturnType<typeof setTimeout> | null = null
function scheduleLayoutSave(layout: Record<string, number>): void {
  if (layoutTimer) clearTimeout(layoutTimer)
  layoutTimer = setTimeout(() => {
    crumb.settingsSet({ layout }).catch(() => {})
  }, 400)
}

// Persist the open-repo tabs + active repo so they reopen on next launch.
// State cleared when switching/creating a workspace (before the new repo loads).
const CLEARED_REPO_STATE: Partial<State> = {
  repo: null,
  refs: [],
  commits: [],
  rows: [],
  status: null,
  selectedHash: null,
  selectedFile: null,
  diff: null,
  commitFiles: [],
  stashes: [],
  mergeState: null
}

// Fold the live tabs into the active workspace and persist all workspaces.
function persistRepos(get: () => State): void {
  const state = get()
  const activeRepo = state.repo?.path ?? null
  const workspaces = state.workspaces.map((w) =>
    w.id === state.activeWorkspaceId ? { ...w, repos: state.openRepos, activeRepo } : w
  )
  useStore.setState({ workspaces })
  crumb
    .settingsSet({
      workspaces,
      activeWorkspaceId: state.activeWorkspaceId,
      // Keep the legacy keys in sync so an older build could still restore.
      openRepos: state.openRepos,
      activeRepo
    })
    .catch(() => {})
}

// Run a mutating op then refresh, surfacing errors as toasts.
async function run(
  get: () => State,
  _set: unknown,
  op: () => Promise<import('@shared/types').GitResult<void>>
): Promise<void> {
  const s = get()
  if (!s.repo) return
  try {
    await unwrap(op())
    await get().refresh()
    const sel = get().selectedFile
    if (sel && !sel.commitHash) await get().selectWorkingFile(sel.file, sel.staged).catch(() => {})
  } catch (e) {
    get().toast('error', errMsg(e))
  }
}

async function sync(
  get: () => State,
  set: (p: Partial<State>) => void,
  busy: string,
  op: () => Promise<import('@shared/types').GitResult<void>>,
  okMsg: string
): Promise<void> {
  const s = get()
  if (!s.repo) return
  const wasOpen = s.drawerOpen
  set({ busy })

  // The log reveals itself when the first progress update lands (see onGitProgress).
  // Nothing to transfer — an up-to-date pull — means no progress and no log, so it
  // never flashes open over a no-op. The busy indicator still says what's running.
  try {
    await unwrap(op())
    get().toast('success', okMsg)
    await get().refresh()
    // Put the log back the way we found it.
    if (!wasOpen && get().drawerAutoOpened) set({ drawerOpen: false })
  } catch (e) {
    get().toast('error', errMsg(e))
    // On failure leave the log open — the error is the reason you'd want it.
  } finally {
    set({ busy: null, gitProgress: null, drawerAutoOpened: false })
  }
}
