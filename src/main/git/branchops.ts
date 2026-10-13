import type { MergeOutcome, MergeStrategy } from '@shared/types'
import { gitExec, gitOrThrow } from './exec'
import { headInfo } from './repo'

// ---- Ref operations used by context menus ----

export async function branchDelete(cwd: string, name: string, force: boolean): Promise<void> {
  await gitOrThrow(cwd, ['branch', force ? '-D' : '-d', name])
}

export async function branchRename(cwd: string, oldName: string, newName: string): Promise<void> {
  await gitOrThrow(cwd, ['branch', '-m', oldName, newName])
}

export async function tagCreate(cwd: string, name: string, ref: string): Promise<void> {
  await gitOrThrow(cwd, ['tag', name, ref])
}

export async function tagDelete(cwd: string, name: string): Promise<void> {
  await gitOrThrow(cwd, ['tag', '-d', name])
}

export async function revertCommit(cwd: string, hash: string): Promise<void> {
  await gitOrThrow(cwd, ['revert', '--no-edit', hash])
}

/**
 * Merge `source` into the current branch with the chosen strategy. On conflict the operation
 * is left IN PROGRESS (not aborted) so the conflict resolver can take over.
 */
export async function mergeCurrent(
  cwd: string,
  source: string,
  strategy: MergeStrategy
): Promise<MergeOutcome> {
  let res
  if (strategy === 'rebase') {
    res = await gitExec(cwd, ['rebase', source])
  } else if (strategy === 'squash') {
    res = await gitExec(cwd, ['merge', '--squash', source])
    if (res.code === 0) {
      // --squash stages the changes but doesn't commit; finish it.
      const commit = await gitExec(cwd, ['commit', '--no-edit'])
      if (commit.code !== 0) {
        await gitOrThrow(cwd, ['commit', '-m', `Squashed ${source}`])
      }
    }
  } else {
    const args = strategy === 'ff' ? ['merge', '--no-edit', source] : ['merge', '--no-ff', '--no-edit', source]
    res = await gitExec(cwd, args)
  }

  if (res.code !== 0) {
    const conflicted = await gitExec(cwd, ['ls-files', '--unmerged'], undefined, { silent: true })
    if (conflicted.stdout.trim()) {
      // Leave it in progress — the resolver will continue or abort.
      return { ok: false, conflict: true }
    }
    throw new Error(res.stderr.trim() || `${strategy} failed`)
  }

  // Git prints "Already up to date." (merge) / "is up to date" (rebase) when the
  // source is already contained here — a silent no-op we must report honestly.
  const upToDate = /already up[ -]to[ -]date|is up to date/i.test(res.stdout + res.stderr)
  let behindUpstream: MergeOutcome['behindUpstream'] = null
  if (upToDate) {
    // If you merged a LOCAL branch that trails its own upstream, the change you
    // wanted is on the remote (e.g. local `main` behind `origin/main`). Say so.
    const isLocal =
      (await gitExec(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${source}`], undefined, {
        silent: true
      })).code === 0
    if (isLocal) {
      const up = (
        await gitExec(
          cwd,
          ['rev-parse', '--abbrev-ref', '--symbolic-full-name', `${source}@{upstream}`],
          undefined,
          { silent: true }
        )
      ).stdout.trim()
      if (up) {
        const cnt = (
          await gitExec(cwd, ['rev-list', '--count', `${source}..${up}`], undefined, { silent: true })
        ).stdout.trim()
        const n = parseInt(cnt, 10) || 0
        if (n > 0) behindUpstream = { ref: up, count: n }
      }
    }
  }
  return { ok: true, conflict: false, upToDate, behindUpstream }
}

/** Create and check out a new branch (optionally from a given start point). */
export async function createBranch(cwd: string, name: string, from?: string): Promise<void> {
  const args = ['checkout', '-b', name]
  if (from) args.push(from)
  await gitOrThrow(cwd, args)
}

export async function stageAll(cwd: string): Promise<void> {
  await gitOrThrow(cwd, ['add', '-A'])
}

/** Push the current branch, setting an upstream automatically the first time. */
export async function pushCurrent(cwd: string): Promise<void> {
  const head = await headInfo(cwd)
  if (head.upstream) {
    await gitOrThrow(cwd, ['push'])
  } else {
    await gitOrThrow(cwd, ['push', '-u', 'origin', 'HEAD'])
  }
}

/** Best-effort resolution of the repo's primary branch (main/master). */
export async function primaryBranch(cwd: string): Promise<string> {
  const originHead = await gitExec(cwd, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
  if (originHead.code === 0) {
    const ref = originHead.stdout.trim() // e.g. "origin/main"
    const slash = ref.indexOf('/')
    if (slash !== -1) return ref.slice(slash + 1)
  }
  for (const cand of ['main', 'master']) {
    const exists = await gitExec(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${cand}`])
    if (exists.code === 0) return cand
  }
  // Fall back to whatever HEAD is on.
  const head = await headInfo(cwd)
  return head.branch ?? 'main'
}

/**
 * Merge `source` into `target` safely for non-experts: check out target, fast-forward
 * it if possible, then `--no-ff` merge. On conflict, ABORT so the working tree is never
 * left half-merged, and report it so the UI can hand off to a human.
 */
export async function mergeInto(cwd: string, target: string, source: string): Promise<MergeOutcome> {
  await gitOrThrow(cwd, ['checkout', target])
  await gitExec(cwd, ['pull', '--ff-only']) // best-effort; ignore if no upstream
  const merge = await gitExec(cwd, ['merge', '--no-ff', '--no-edit', source])
  if (merge.code !== 0) {
    // Detect an in-progress conflicted merge and back out cleanly.
    const conflicted = await gitExec(cwd, ['ls-files', '--unmerged'])
    if (conflicted.stdout.trim()) {
      await gitExec(cwd, ['merge', '--abort'])
      return { ok: false, conflict: true }
    }
    throw new Error(merge.stderr.trim() || 'merge failed')
  }
  return { ok: true, conflict: false }
}
