import type { FileDiff, FileStatus } from '@shared/types'
import { parseUnifiedDiff } from '@shared/diff-parse'
import { gitExec, gitOrThrow } from './exec'

const NUL = String.fromCharCode(0)

/** Diff of a working-tree file (staged or unstaged). */
export async function fileDiff(cwd: string, file: string, staged: boolean): Promise<FileDiff> {
  const args = ['diff', '--no-color']
  if (staged) args.push('--cached')
  args.push('--', file)
  const { stdout, code } = await gitExec(cwd, args)
  if (code !== 0) {
    // Untracked files have no diff target; synthesize an all-add diff.
    if (!staged) return untrackedDiff(cwd, file)
  }
  if (!stdout.trim() && !staged) {
    // Could be an untracked file with an empty tracked diff.
    const tracked = await gitExec(cwd, ['ls-files', '--error-unmatch', '--', file], undefined, {
      silent: true
    })
    if (tracked.code !== 0) return untrackedDiff(cwd, file)
  }
  return parseUnifiedDiff(file, stdout)
}

async function untrackedDiff(cwd: string, file: string): Promise<FileDiff> {
  // Use --no-index against /dev/null to render the whole file as additions.
  // --no-index exits non-zero by design when the files differ, so keep it out of the log.
  const { stdout } = await gitExec(
    cwd,
    ['diff', '--no-color', '--no-index', '--', devNull(), file],
    undefined,
    { silent: true }
  )
  return parseUnifiedDiff(file, stdout)
}

function devNull(): string {
  return process.platform === 'win32' ? 'NUL' : '/dev/null'
}

/** Diff of one file at a specific commit (vs its first parent). */
export async function commitFileDiff(cwd: string, hash: string, file: string): Promise<FileDiff> {
  const { stdout } = await gitExec(cwd, [
    'diff',
    '--no-color',
    `${hash}^!`,
    '--',
    file
  ])
  return parseUnifiedDiff(file, stdout)
}

const COMMIT_STATUS: Record<string, FileStatus['type']> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'modified',
  T: 'modified'
}

/** Files changed in a commit (vs first parent), via name-status. */
export async function commitFiles(cwd: string, hash: string): Promise<FileStatus[]> {
  const out = await gitOrThrow(cwd, [
    'diff-tree',
    '--no-commit-id',
    '--name-status',
    '-r',
    '-z',
    hash
  ])
  const files: FileStatus[] = []
  const parts = out.split(NUL).filter((p) => p.length > 0)
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i]
    const status = code[0]
    if (status === 'R' || status === 'C') {
      const oldPath = parts[++i]
      const newPath = parts[++i]
      files.push({ path: newPath, oldPath, type: COMMIT_STATUS[status] ?? 'modified', staged: true })
    } else {
      const p = parts[++i]
      files.push({ path: p, type: COMMIT_STATUS[status] ?? 'modified', staged: true })
    }
  }
  return files
}
