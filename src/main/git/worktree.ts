import type { Worktree } from '@shared/types'
import { gitExec, gitOrThrow } from './exec'
import { repoRoot } from './repo'

function normPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * Parse `git worktree list --porcelain`. Records are blank-line separated; each
 * begins with `worktree <path>` followed by attribute lines (HEAD, branch,
 * detached, bare, locked, prunable). The first record is the main worktree.
 */
export async function listWorktrees(cwd: string): Promise<Worktree[]> {
  const [out, root] = await Promise.all([
    gitOrThrow(cwd, ['worktree', 'list', '--porcelain']),
    repoRoot(cwd).catch(() => cwd)
  ])
  const here = normPath(root)
  const trees: Worktree[] = []
  let cur: Partial<Worktree> | null = null

  const flush = (): void => {
    if (cur && cur.path) {
      trees.push({
        path: cur.path,
        head: cur.head ?? null,
        branch: cur.branch ?? null,
        bare: cur.bare ?? false,
        detached: cur.detached ?? false,
        locked: cur.locked ?? false,
        lockedReason: cur.lockedReason ?? null,
        prunable: cur.prunable ?? false,
        isMain: false,
        isCurrent: normPath(cur.path) === here
      })
    }
    cur = null
  }

  for (const raw of out.split('\n')) {
    const line = raw.replace(/\r$/, '')
    if (line === '') {
      flush()
      continue
    }
    if (line.startsWith('worktree ')) {
      flush()
      cur = { path: line.slice('worktree '.length) }
    } else if (!cur) {
      continue
    } else if (line.startsWith('HEAD ')) {
      cur.head = line.slice('HEAD '.length).slice(0, 8)
    } else if (line.startsWith('branch ')) {
      cur.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '')
    } else if (line === 'detached') {
      cur.detached = true
    } else if (line === 'bare') {
      cur.bare = true
    } else if (line === 'locked' || line.startsWith('locked ')) {
      cur.locked = true
      cur.lockedReason = line.length > 'locked'.length ? line.slice('locked '.length) : null
    } else if (line === 'prunable' || line.startsWith('prunable ')) {
      cur.prunable = true
    }
  }
  flush()

  if (trees.length > 0) trees[0].isMain = true
  return trees
}

export interface AddWorktreeOptions {
  path: string
  /** Existing branch to check out, or the name of the branch to create. */
  branch: string
  /** When true, create `branch` (optionally from `base`) instead of checking out an existing one. */
  create: boolean
  /** Start point for a newly created branch. */
  base?: string
}

export async function addWorktree(cwd: string, opts: AddWorktreeOptions): Promise<void> {
  const path = opts.path.trim()
  const branch = opts.branch.trim()
  if (!path) throw new Error('Choose a folder for the new worktree.')
  if (!branch) throw new Error('Choose or name a branch for the worktree.')

  const args = ['worktree', 'add']
  if (opts.create) {
    args.push('-b', branch, path)
    if (opts.base && opts.base.trim()) args.push(opts.base.trim())
  } else {
    args.push(path, branch)
  }
  const res = await gitExec(cwd, args)
  if (res.code !== 0) {
    throw new Error(res.stderr.trim() || 'Could not create the worktree.')
  }
}

export async function removeWorktree(cwd: string, path: string, force: boolean): Promise<void> {
  const args = ['worktree', 'remove']
  if (force) args.push('--force')
  args.push(path)
  const res = await gitExec(cwd, args)
  if (res.code !== 0) {
    throw new Error(res.stderr.trim() || 'Could not remove the worktree.')
  }
}

export async function pruneWorktrees(cwd: string): Promise<void> {
  await gitOrThrow(cwd, ['worktree', 'prune'])
}

export async function lockWorktree(cwd: string, path: string, reason: string): Promise<void> {
  const args = ['worktree', 'lock']
  if (reason.trim()) args.push('--reason', reason.trim())
  args.push(path)
  await gitOrThrow(cwd, args)
}

export async function unlockWorktree(cwd: string, path: string): Promise<void> {
  await gitOrThrow(cwd, ['worktree', 'unlock', path])
}
