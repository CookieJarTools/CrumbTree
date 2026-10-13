import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Commit, MergeOutcome } from '@shared/types'
import { buildTodo, validatePlan, type RebaseStep } from '@shared/rebase-todo'
import { gitExec, gitOrThrow } from './exec'

const NUL = String.fromCharCode(0)
const FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%D', '%s'].join('%x00')

/** Commits on the current branch (HEAD's own ancestry), newest first. */
export async function listBranchCommits(cwd: string, limit = 30): Promise<Commit[]> {
  const out = await gitOrThrow(cwd, [
    'log',
    `--pretty=format:${FORMAT}`,
    `--max-count=${limit}`,
    'HEAD'
  ])
  if (!out.trim()) return []
  const commits: Commit[] = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [hash, parents, authorName, authorEmail, at, decorate, subject] = line.split(NUL)
    commits.push({
      hash,
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      authorName,
      authorEmail,
      timestamp: parseInt(at, 10) || 0,
      subject: subject ?? '',
      refs: (decorate ?? '')
        .split(',')
        .map((r) => r.trim().replace(/^HEAD -> /, '').replace(/^tag: /, ''))
        .filter(Boolean)
    })
  }
  return commits
}

/**
 * Run an interactive rebase non-interactively.
 *
 * `git rebase -i` normally opens the sequence editor on a todo file; we instead
 * point GIT_SEQUENCE_EDITOR at `cp <our-todo>`. Git invokes the editor as
 * `<editor> <todofile>`, so this copies our pre-built todo over git's — no editor
 * ever appears. `core.editor=true` makes any message editor a silent no-op.
 *
 * `base` is the commit the replayed commits sit on top of; null rebases from the
 * root commit. On conflict the rebase is left IN PROGRESS so the existing conflict
 * resolver can take over (mergeState already detects `rebase-merge`).
 */
export async function runInteractiveRebase(
  cwd: string,
  base: string | null,
  steps: RebaseStep[]
): Promise<MergeOutcome> {
  const invalid = validatePlan(steps)
  if (invalid) throw new Error(invalid)

  const todoPath = join(tmpdir(), `crumbtree-rebase-${Date.now()}-${process.pid}.txt`)
  await writeFile(todoPath, buildTodo(steps), 'utf8')

  try {
    const args = ['-c', 'core.editor=true', 'rebase', '-i']
    if (base) args.push(base)
    else args.push('--root')

    const res = await gitExec(cwd, args, undefined, {
      env: { GIT_SEQUENCE_EDITOR: `cp "${todoPath.replace(/\\/g, '/')}"` }
    })

    if (res.code !== 0) {
      // Conflict → leave it in progress for the resolver.
      const unmerged = await gitExec(cwd, ['ls-files', '--unmerged'], undefined, { silent: true })
      if (unmerged.stdout.trim()) return { ok: false, conflict: true }
      throw new Error(res.stderr.trim() || 'Rebase failed.')
    }
    // An `edit` step exits 0 but leaves the rebase in progress; the caller's
    // refresh picks that up via mergeState and shows the in-progress strip.
    return { ok: true, conflict: false }
  } finally {
    await unlink(todoPath).catch(() => {})
  }
}
