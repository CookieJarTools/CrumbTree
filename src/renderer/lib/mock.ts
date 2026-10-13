// Browser-preview mock of the CrumbApi. Lets the real React UI render against
// captured data from the demo repo, with no Electron/IPC. Used only by demo.html.
import { parseUnifiedDiff } from '@shared/diff-parse'
import type { CrumbApi } from '../../preload'
import type { Favourites, GitResult, LfsRule, Stash, Worktree } from '@shared/types'
import type { GitProgressEvent } from '@shared/git-progress'
import data from './demoData.json'

const ok = <T>(d: T): Promise<GitResult<T>> => Promise.resolve({ ok: true, data: d })

// Demo progress streaming: drive the subscriber the same way main does for a real
// fetch/pull/push, so the progress bar behaves like the real thing.
let progressCb: ((p: GitProgressEvent | null) => void) | null = null
function simulateProgress(command: string, phase: string, total: number): Promise<GitResult<void>> {
  return new Promise((resolve) => {
    const steps = 25
    let step = 0
    const tick = (): void => {
      step++
      const percent = Math.round((step / steps) * 100)
      progressCb?.({
        command,
        phase,
        percent,
        current: Math.round((percent / 100) * total),
        total,
        detail: '1.20 MiB | 500.00 KiB/s',
        done: percent >= 100
      })
      if (step >= steps) {
        progressCb?.(null)
        resolve({ ok: true, data: undefined })
      } else {
        setTimeout(tick, 60)
      }
    }
    setTimeout(tick, 30)
  })
}

// Mutable demo state so LFS tracking + toggles behave for real in the browser demo.
const lfsRules: LfsRule[] = []
let lfsInitialized = false
const lfsFiles = [
  'README.md',
  'app.txt',
  'footer.txt',
  'login.txt',
  'art/textures/wood.psd',
  'art/textures/metal_plate_diffuse_normal_roughness.psd',
  'audio/theme.wav',
  'models/hero.fbx'
]
let noobMode = false
let gitFriend = true
let favourites: Favourites = { repos: [], branches: {}, commits: {} }
let layout: Record<string, number> = {}

// Demo conflict state — merging "mesh_stamps" triggers a fake conflict to exercise the wizard.
let mergeConflict: { source: string; files: string[] } | null = null

// Mutable demo stash list so create/apply/pop/drop behave in the browser demo.
let stashSeq = 2
let stashes: Stash[] = [
  {
    ref: 'stash@{0}',
    index: 0,
    message: 'WIP terrain tweaks',
    branch: 'mesh_stamps',
    timestamp: 1700004000
  },
  {
    ref: 'stash@{1}',
    index: 1,
    message: 'experiment: brighter fog',
    branch: 'main',
    timestamp: 1699990000
  }
]
function reindexStashes(): void {
  stashes.forEach((s, i) => {
    s.index = i
    s.ref = `stash@{${i}}`
  })
}

// Mutable demo worktrees so add/remove/lock behave in the browser demo.
let worktrees: Worktree[] = [
  {
    path: data.repo.path,
    head: '81d00b7',
    branch: 'Runtime',
    bare: false,
    detached: false,
    locked: false,
    lockedReason: null,
    prunable: false,
    isMain: true,
    isCurrent: true
  },
  {
    path: 'C:/Users/demo/Projects/demo-repo-hotfix',
    head: 'b6e3efc',
    branch: 'dev/height_gizmo_fix',
    bare: false,
    detached: false,
    locked: false,
    lockedReason: null,
    prunable: false,
    isMain: false,
    isCurrent: false
  }
]
const SAMPLE_CONFLICT = `# Config
name = TerrainMolder
<<<<<<< HEAD
version = 1.2.3
author = you
=======
version = 1.3.0
author = teammate
>>>>>>> mesh_stamps
description = a terrain tool
<<<<<<< HEAD
mode = runtime
=======
mode = editor
>>>>>>> mesh_stamps
`

// Synthesize a RepoInfo for an arbitrary path so the demo can open/clone into
// distinct tabs (the real openRepo returns the git toplevel for any path).
function baseName(p: string): string {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'repo'
}
function synthRepo(path: string, name?: string): unknown {
  if (path === data.repo.path) return data.repo
  return { ...(data.repo as Record<string, unknown>), path, name: name ?? baseName(path) }
}
function joinP(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + name
}

export const mockApi: CrumbApi = {
  gitAvailable: () => ok({ version: '2.43.0 (demo mode)' }),
  openRepoDialog: () => ok(synthRepo('C:/Users/demo/Projects/opened-repo') as never),
  openRepo: (path: string) => ok(synthRepo(path) as never),
  recentRepos: () => ok([{ path: data.repo.path, name: data.repo.name }]),
  status: () => ok(data.status as never),
  refs: () => ok(data.refs as never),
  log: () => ok(data.commits as never),
  fileDiff: (_p: string, file: string) =>
    ok(parseUnifiedDiff(file, (data.diffs as Record<string, string>)[file] ?? '')),
  commitFileDiff: (_p: string, hash: string, file: string) =>
    ok(parseUnifiedDiff(file, (data.commitDiffs as Record<string, string>)[`${hash}::${file}`] ?? '')),
  commitFiles: (_p: string, hash: string) =>
    ok(((data.commitFiles as Record<string, unknown[]>)[hash] ?? []) as never),
  fileHistory: () => ok(data.commits.slice(0, 6) as never),
  branchesContaining: () => ok(['main', 'origin/main', 'feature/login']),
  fileBlame: () =>
    ok(
      [
        'a3cd296111111111 1 1 3',
        'author Ada Lovelace',
        'author-time 1700000000',
        'summary Add app.txt with three lines',
        '\tline1',
        'a3cd296111111111 2 2',
        '\tline2',
        '0f615d3222222222 3 3 1',
        'author Joseph Cook',
        'author-time 1700000500',
        'summary Add footer on main',
        '\tfooter text'
      ].join('\n')
    ),
  stageFile: () => ok(undefined),
  stagePaths: () => ok(undefined),
  unstagePaths: () => ok(undefined),
  discardPaths: () => ok(undefined),
  unstageFile: () => ok(undefined),
  stagePatch: () => ok(undefined),
  discardFile: () => ok(undefined),
  commit: () => ok(undefined),
  checkout: () => ok(undefined),
  // Nothing to fetch: returns instantly with no progress, like an up-to-date remote.
  fetch: () => ok(undefined),
  pull: () => simulateProgress('git pull --ff-only', 'Updating files', 4657),
  push: () => simulateProgress('git push', 'Writing objects', 333),
  pushBranch: (_p: string, branch: string) =>
    simulateProgress(`git push -u origin ${branch}`, 'Writing objects', 128),
  pullBranch: (_p: string, branch: string) =>
    // Demo: `main` gets 3 new commits from origin; others are already up to date.
    ok({ updated: branch === 'main' ? 3 : 0, upstream: `origin/${branch}` }),
  opLog: () => ok([]),
  onOpLog: () => () => {},
  onGitProgress: (cb: (p: GitProgressEvent | null) => void) => {
    progressCb = cb
    return () => {
      progressCb = null
    }
  },

  // LFS (stateful so the demo add/remove works)
  lfsStatus: () => ok({ installed: true, version: '3.5.1', initialized: lfsInitialized }),
  lfsRules: () => ok([...lfsRules]),
  lfsFiles: () => ok([...lfsFiles]),
  lfsTrackedFiles: () => ok(lfsInitialized ? ['art/textures/wood.psd'] : []),
  lfsTrack: (_p: string, pattern: string) => {
    if (!lfsRules.some((r) => r.pattern === pattern)) {
      lfsRules.push({ pattern, source: '.gitattributes' })
    }
    return ok(undefined)
  },
  lfsUntrack: (_p: string, pattern: string) => {
    const i = lfsRules.findIndex((r) => r.pattern === pattern)
    if (i !== -1) lfsRules.splice(i, 1)
    return ok(undefined)
  },
  lfsInstall: () => {
    lfsInitialized = true
    return ok(undefined)
  },
  terminalRun: (_p: string, args: string[]) =>
    ok({ stdout: `demo: would run \`git ${args.join(' ')}\`\n`, stderr: '', code: 0 }),

  // GitHub via gh CLI + repo creation (mocked as if gh is installed & signed in)
  githubStatus: () => ok({ connected: true, login: 'demo-user', name: 'Demo User' }),
  githubOwners: () => ok({ user: 'demo-user', orgs: ['acme-studios', 'crumb-tools'] }),
  githubCreatePr: () => ok({ url: 'https://github.com/demo-user/demo-repo/pull/1' }),
  githubInstall: () => ok(undefined),
  githubAuthLogin: () => ok(undefined),
  pickFolder: () => ok('C:/Users/demo/Projects'),
  createRepo: (opts: { folder: string; name: string }) =>
    ok(synthRepo(opts.folder, opts.name) as never),
  cloneRepo: (_url: string, dir: string, name: string) =>
    ok(synthRepo(joinP(dir, name), name) as never),

  // Studio (Noob Mode) primitives
  branchCreate: () => ok(undefined),
  branchPrimary: () => ok('main'),
  stageAll: () => ok(undefined),
  pushCurrent: () => ok(undefined),
  mergeInto: () => ok({ ok: true, conflict: false }),

  // Ref operations
  clipboardRead: () => ok('https://github.com/demo-user/awesome-lib.git'),
  branchDelete: () => ok(undefined),
  branchRename: () => ok(undefined),
  stashList: () => ok(stashes.map((s) => ({ ...s }))),
  stashCreate: (_p: string, message: string, _u: boolean, paths?: string[]) => {
    stashes.unshift({
      ref: 'stash@{0}',
      index: 0,
      message: message.trim() || (paths?.length ? `WIP: ${paths.join(', ')}` : 'WIP on main'),
      branch: 'main',
      timestamp: 1700005000 + stashSeq++
    })
    reindexStashes()
    return ok(undefined)
  },
  stashApply: () => ok(undefined),
  stashPop: (_p: string, ref: string) => {
    stashes = stashes.filter((s) => s.ref !== ref)
    reindexStashes()
    return ok(undefined)
  },
  stashDrop: (_p: string, ref: string) => {
    stashes = stashes.filter((s) => s.ref !== ref)
    reindexStashes()
    return ok(undefined)
  },
  stashFiles: () =>
    ok([
      { path: 'app.txt', type: 'modified' as const, staged: false },
      { path: 'notes.txt', type: 'added' as const, staged: false }
    ]),
  stashDiff: (_p: string, _ref: string, file: string) =>
    ok(parseUnifiedDiff(file, (data.diffs as Record<string, string>)[file] ?? '')),
  rebaseCommits: (_p: string, limit: number) => ok(data.commits.slice(0, limit) as never),
  rebaseRun: () => ok({ ok: true, conflict: false }),
  worktreeList: () => ok(worktrees.map((w) => ({ ...w }))),
  worktreeAdd: (_p: string, dir: string, branch: string) => {
    worktrees.push({
      path: dir,
      head: 'abc1234',
      branch,
      bare: false,
      detached: false,
      locked: false,
      lockedReason: null,
      prunable: false,
      isMain: false,
      isCurrent: false
    })
    return ok(undefined)
  },
  worktreeRemove: (_p: string, worktree: string) => {
    worktrees = worktrees.filter((w) => w.path !== worktree)
    return ok(undefined)
  },
  worktreePrune: () => {
    worktrees = worktrees.filter((w) => !w.prunable)
    return ok(undefined)
  },
  worktreeLock: (_p: string, worktree: string, reason: string) => {
    const w = worktrees.find((x) => x.path === worktree)
    if (w) {
      w.locked = true
      w.lockedReason = reason || null
    }
    return ok(undefined)
  },
  worktreeUnlock: (_p: string, worktree: string) => {
    const w = worktrees.find((x) => x.path === worktree)
    if (w) {
      w.locked = false
      w.lockedReason = null
    }
    return ok(undefined)
  },
  tagCreate: () => ok(undefined),
  tagDelete: () => ok(undefined),
  mergeCurrent: (_p: string, source: string) => {
    // Demo: merging feature/reporting triggers a fake conflict to exercise the wizard.
    if (source === 'feature/reporting') {
      mergeConflict = { source, files: ['config.txt', 'notes.txt'] }
      return ok({ ok: false, conflict: true })
    }
    // Demo: merging the stale local `main` is a no-op whose newer work is on origin.
    if (source === 'main') {
      return ok({ ok: true, conflict: false, upToDate: true, behindUpstream: { ref: 'origin/main', count: 3 } })
    }
    return ok({ ok: true, conflict: false })
  },
  revertCommit: () => ok(undefined),
  commitMessage: (_p: string, hash: string) => {
    const c = (data.commits as { hash: string; subject: string }[]).find((x) => x.hash === hash)
    return ok(c?.subject ?? 'commit message')
  },
  rewordCommit: () => ok(undefined),
  conflictState: () =>
    ok(
      mergeConflict
        ? {
            inProgress: true,
            kind: 'merge' as const,
            source: mergeConflict.source,
            conflicted: mergeConflict.files.map((f) => ({
              path: f,
              type: 'conflicted' as const,
              staged: false
            }))
          }
        : { inProgress: false, kind: 'none' as const, source: null, conflicted: [] }
    ),
  conflictRead: () => ok(SAMPLE_CONFLICT),
  conflictWrite: (_p: string, file: string) => {
    if (mergeConflict) mergeConflict.files = mergeConflict.files.filter((f) => f !== file)
    return ok(undefined)
  },
  conflictSide: (_p: string, file: string) => {
    if (mergeConflict) mergeConflict.files = mergeConflict.files.filter((f) => f !== file)
    return ok(undefined)
  },
  mergeContinue: () => {
    mergeConflict = null
    return ok({ inProgress: false, kind: 'none' as const, source: null, conflicted: [] })
  },
  mergeAbort: () => {
    mergeConflict = null
    return ok(undefined)
  },

  // Window / shell / clipboard (no-ops in the browser demo)
  windowMinimize: () => ok(undefined),
  windowToggleMaximize: () => ok(undefined),
  windowClose: () => ok(undefined),
  windowIsMaximized: () => ok(false),
  clipboardWrite: () => ok(undefined),
  shellReveal: () => ok(undefined),
  shellOpenExternal: () => ok(undefined),
  onMaximizeChanged: () => () => {},
  onDeeplink: () => () => {},

  // Settings
  settingsGet: () =>
    ok({
      noobMode,
      gitFriend,
      openRepos: [{ path: data.repo.path, name: data.repo.name }],
      activeRepo: data.repo.path,
      workspaces: [
        {
          id: 'default',
          name: 'Default',
          repos: [{ path: data.repo.path, name: data.repo.name }],
          activeRepo: data.repo.path
        },
        { id: 'ws-games', name: 'Games', repos: [], activeRepo: null }
      ],
      activeWorkspaceId: 'default',
      favourites,
      layout
    }),
  settingsSet: (patch: {
    noobMode?: boolean
    gitFriend?: boolean
    favourites?: Favourites
    layout?: Record<string, number>
  }) => {
    if (typeof patch.noobMode === 'boolean') noobMode = patch.noobMode
    if (typeof patch.gitFriend === 'boolean') gitFriend = patch.gitFriend
    if (patch.favourites) favourites = patch.favourites
    if (patch.layout) layout = patch.layout
    return ok(undefined)
  }
}
