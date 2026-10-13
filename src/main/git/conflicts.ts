import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { MergeState } from '@shared/types'
import { gitExec, gitOrThrow } from './exec'
import { repoRoot, workingStatus } from './repo'

async function gitDir(cwd: string): Promise<string> {
  const out = (await gitExec(cwd, ['rev-parse', '--git-dir'], undefined, { silent: true })).stdout.trim()
  if (!out) return join(cwd, '.git')
  return isAbsolute(out) ? out : join(cwd, out)
}

/** Detect an in-progress merge / squash / rebase and its conflicted files. */
export async function mergeState(cwd: string): Promise<MergeState> {
  const gd = await gitDir(cwd)
  const status = await workingStatus(cwd)
  const conflicted = status.conflicted

  const rebasing = existsSync(join(gd, 'rebase-merge')) || existsSync(join(gd, 'rebase-apply'))
  const merging = existsSync(join(gd, 'MERGE_HEAD'))

  let kind: MergeState['kind'] = 'none'
  if (rebasing) kind = 'rebase'
  else if (merging) kind = 'merge'
  else if (conflicted.length > 0) kind = 'squash' // squash leaves no MERGE_HEAD

  let source: string | null = null
  try {
    if (merging) {
      const short = await gitExec(cwd, ['name-rev', '--name-only', 'MERGE_HEAD'], undefined, { silent: true })
      source = short.stdout.trim() || null
    } else if (rebasing) {
      const onto = await readFileSafe(join(gd, 'rebase-merge', 'head-name'))
      source = onto ? onto.trim().replace('refs/heads/', '') : null
    }
  } catch {
    /* best effort */
  }

  return { inProgress: kind !== 'none', kind, source, conflicted }
}

async function readFileSafe(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8')
  } catch {
    return null
  }
}

/** Raw working-tree content of a conflicted file (with markers), for the parser. */
export async function readConflictFile(cwd: string, file: string): Promise<string> {
  const root = await repoRoot(cwd)
  return (await readFileSafe(join(root, file))) ?? ''
}

/** Write resolved content and stage the file. */
export async function writeResolved(cwd: string, file: string, content: string): Promise<void> {
  const root = await repoRoot(cwd)
  await writeFile(join(root, file), content, 'utf8')
  await gitOrThrow(cwd, ['add', '--', file])
}

/** Whole-file shortcut: take our side or their side, then stage. */
export async function resolveSide(cwd: string, file: string, side: 'ours' | 'theirs'): Promise<void> {
  await gitOrThrow(cwd, ['checkout', `--${side}`, '--', file])
  await gitOrThrow(cwd, ['add', '--', file])
}

/** Finish the in-progress operation once conflicts are resolved. */
export async function mergeContinue(cwd: string): Promise<MergeState> {
  const state = await mergeState(cwd)
  if (state.kind === 'rebase') {
    await gitOrThrow(cwd, ['-c', 'core.editor=true', 'rebase', '--continue'])
  } else {
    const commit = await gitExec(cwd, ['commit', '--no-edit'])
    if (commit.code !== 0) {
      await gitOrThrow(cwd, ['commit', '-m', 'Merge'])
    }
  }
  return mergeState(cwd)
}

/** Back out of the in-progress operation. */
export async function mergeAbort(cwd: string): Promise<void> {
  const gd = await gitDir(cwd)
  if (existsSync(join(gd, 'rebase-merge')) || existsSync(join(gd, 'rebase-apply'))) {
    await gitOrThrow(cwd, ['rebase', '--abort'])
  } else {
    // Works for both a conflicted merge (MERGE_HEAD present) and a conflicted squash.
    await gitOrThrow(cwd, ['reset', '--merge'])
  }
}
