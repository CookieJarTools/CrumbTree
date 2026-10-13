import type { FileDiff, FileStatus, Stash } from '@shared/types'
import { parseUnifiedDiff } from '@shared/diff-parse'
import { gitExec, gitOrThrow } from './exec'

const NUL = String.fromCharCode(0)
const US = String.fromCharCode(0x1f)

export async function listStashes(cwd: string): Promise<Stash[]> {
  // Fields separated by a unit-separator byte (git's %x1f); one stash per line.
  const out = await gitOrThrow(cwd, ['stash', 'list', '--format=%gd%x1f%ct%x1f%s'])
  const stashes: Stash[] = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [ref, ct, subject] = line.split(US)
    // subject looks like "On <branch>: <msg>" or "WIP on <branch>: <hash> <msg>"
    const m = subject.match(/^(?:WIP on|On) ([^:]+): (.*)$/)
    const branch = m ? m[1] : null
    let message = m ? m[2] : subject
    message = message.replace(/^[0-9a-f]{7,40}\s+/, '') // drop leading hash from WIP messages
    const idxMatch = ref.match(/stash@\{(\d+)\}/)
    stashes.push({
      ref,
      index: idxMatch ? parseInt(idxMatch[1], 10) : stashes.length,
      message: message || '(no message)',
      branch,
      timestamp: parseInt(ct, 10) || 0
    })
  }
  return stashes
}

/** Stash the working tree, or just `paths` when given (Fork's "stash these files"). */
export async function createStash(
  cwd: string,
  message: string,
  includeUntracked: boolean,
  paths: string[] = []
): Promise<void> {
  const args = ['stash', 'push']
  if (includeUntracked) args.push('-u')
  if (message.trim()) args.push('-m', message.trim())
  // `--` must come last: everything after it is a pathspec, not a flag.
  if (paths.length > 0) args.push('--', ...paths)
  const res = await gitExec(cwd, args)
  if (res.code !== 0) throw new Error(res.stderr.trim() || 'Could not create the stash.')
  if (/no local changes/i.test(res.stdout) || /no local changes/i.test(res.stderr)) {
    throw new Error('Nothing to stash — you have no changes.')
  }
}

export async function applyStash(cwd: string, ref: string): Promise<void> {
  await gitOrThrow(cwd, ['stash', 'apply', ref])
}

export async function popStash(cwd: string, ref: string): Promise<void> {
  await gitOrThrow(cwd, ['stash', 'pop', ref])
}

export async function dropStash(cwd: string, ref: string): Promise<void> {
  await gitOrThrow(cwd, ['stash', 'drop', ref])
}

const STATUS_TYPE: Record<string, FileStatus['type']> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'modified',
  T: 'modified'
}

/** Files changed in a stash (tracked changes: base → stash). */
export async function stashFiles(cwd: string, ref: string): Promise<FileStatus[]> {
  const out = await gitOrThrow(cwd, ['diff', '--name-status', '-z', `${ref}^1`, ref])
  const files: FileStatus[] = []
  const parts = out.split(NUL).filter((p) => p.length > 0)
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i][0]
    if (status === 'R' || status === 'C') {
      const oldPath = parts[++i]
      const newPath = parts[++i]
      files.push({ path: newPath, oldPath, type: STATUS_TYPE[status] ?? 'modified', staged: false })
    } else {
      const p = parts[++i]
      files.push({ path: p, type: STATUS_TYPE[status] ?? 'modified', staged: false })
    }
  }
  return files
}

/** Diff of one file within a stash. */
export async function stashFileDiff(cwd: string, ref: string, file: string): Promise<FileDiff> {
  const { stdout } = await gitExec(cwd, ['diff', '--no-color', `${ref}^1`, ref, '--', file])
  return parseUnifiedDiff(file, stdout)
}
