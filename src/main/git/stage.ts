import { gitExec, gitOrThrow } from './exec'

export async function stageFile(cwd: string, file: string): Promise<void> {
  await gitOrThrow(cwd, ['add', '--', file])
}

// Git holds a single .git/index.lock, so index-mutating commands cannot run in
// parallel. Batch many paths into one command; chunk only to stay under the OS
// command-line limit, and run chunks SEQUENTIALLY so they never fight the lock.
const PATH_CHUNK = 200

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export async function stagePaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  for (const group of chunk(paths, PATH_CHUNK)) {
    await gitOrThrow(cwd, ['add', '--', ...group])
  }
}

export async function unstagePaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const born = (await gitExec(cwd, ['rev-parse', '--verify', 'HEAD'])).code === 0
  for (const group of chunk(paths, PATH_CHUNK)) {
    if (born) await gitOrThrow(cwd, ['reset', '-q', 'HEAD', '--', ...group])
    else await gitOrThrow(cwd, ['rm', '--cached', '-q', '--', ...group])
  }
}

export async function discardPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  // Split into tracked (restore from HEAD) and untracked (delete) in one probe.
  const trackedOut = await gitExec(cwd, ['ls-files', '--', ...paths], undefined, { silent: true })
  const tracked = new Set(trackedOut.stdout.split('\n').map((l) => l.trim()).filter(Boolean))
  const toRestore = paths.filter((p) => tracked.has(p))
  const toClean = paths.filter((p) => !tracked.has(p))
  for (const group of chunk(toRestore, PATH_CHUNK)) {
    await gitOrThrow(cwd, ['checkout', '--', ...group])
  }
  for (const group of chunk(toClean, PATH_CHUNK)) {
    await gitOrThrow(cwd, ['clean', '-f', '--', ...group])
  }
}

export async function unstageFile(cwd: string, file: string): Promise<void> {
  // `git reset -- <file>` works even on an unborn branch via HEAD fallback.
  const head = await gitExec(cwd, ['rev-parse', '--verify', 'HEAD'])
  if (head.code === 0) {
    await gitOrThrow(cwd, ['reset', '-q', 'HEAD', '--', file])
  } else {
    await gitOrThrow(cwd, ['rm', '--cached', '-q', '--', file])
  }
}

/**
 * Apply a partial patch to the index (hunk/line staging). `reverse` unstages.
 * The patch must be a valid unified diff produced from `git diff`.
 */
export async function applyPatch(cwd: string, patch: string, reverse: boolean): Promise<void> {
  const args = ['apply', '--cached', '--whitespace=nowarn']
  if (reverse) args.push('--reverse')
  const body = patch.endsWith('\n') ? patch : patch + '\n'
  await gitOrThrow(cwd, args, body)
}

export async function discardFile(cwd: string, file: string): Promise<void> {
  // Restore tracked file from HEAD; delete if untracked.
  const tracked = await gitExec(cwd, ['ls-files', '--error-unmatch', '--', file], undefined, {
    silent: true
  })
  if (tracked.code === 0) {
    await gitOrThrow(cwd, ['checkout', '--', file])
  } else {
    await gitOrThrow(cwd, ['clean', '-f', '--', file])
  }
}

export async function createCommit(cwd: string, message: string, amend: boolean): Promise<void> {
  const args = ['commit', '-m', message]
  if (amend) args.push('--amend')
  await gitOrThrow(cwd, args)
}
