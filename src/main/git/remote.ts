import { gitExec, gitOrThrow, gitStream, gitStreamOrThrow } from './exec'

// `--progress` forces git to report progress even though stderr isn't a TTY;
// gitStreamOrThrow parses those updates and pushes them to the UI live.

export async function fetchAll(cwd: string): Promise<void> {
  await gitStreamOrThrow(cwd, ['fetch', '--all', '--prune', '--progress'])
}

export async function pull(cwd: string): Promise<void> {
  await gitStreamOrThrow(cwd, ['pull', '--ff-only', '--progress'])
}

export async function push(cwd: string, force = false): Promise<void> {
  const args = ['push', '--progress']
  if (force) args.push('--force-with-lease')
  await gitStreamOrThrow(cwd, args)
}

/**
 * Push a specific branch (setting upstream), without needing it checked out —
 * a PR can only be opened for a branch that exists on the remote.
 */
export async function pushBranch(cwd: string, branch: string): Promise<void> {
  await gitStreamOrThrow(cwd, ['push', '--progress', '-u', 'origin', branch])
}

/**
 * Bring a branch up to date with its upstream WITHOUT checking it out, via a
 * refspec fetch (`git fetch <remote> <remoteBranch>:<branch>`). This only
 * fast-forwards — git refuses if the branch has diverged, so local work is never
 * clobbered. Returns how many commits it advanced (0 = already up to date).
 */
export async function pullBranch(
  cwd: string,
  branch: string
): Promise<{ updated: number; upstream: string }> {
  const remote = (await gitExec(cwd, ['config', '--get', `branch.${branch}.remote`])).stdout.trim()
  const mergeRef = (await gitExec(cwd, ['config', '--get', `branch.${branch}.merge`])).stdout.trim()
  if (!remote || !mergeRef) {
    throw new Error(`${branch} has no upstream to update from — push it first or set a tracking branch.`)
  }
  const short = mergeRef.replace(/^refs\/heads\//, '')
  const upstream = `${remote}/${short}`

  const before = (await gitExec(cwd, ['rev-parse', branch])).stdout.trim()
  // No leading '+', so this is fast-forward-only for the local ref.
  const res = await gitStream(cwd, ['fetch', '--progress', remote, `${short}:${branch}`])
  if (res.code !== 0) {
    const err = res.stderr
    if (/refusing to fetch into branch|current branch/i.test(err)) {
      throw new Error(`${branch} is the branch you’re on — use Pull instead.`)
    }
    if (/non-fast-forward|rejected|\bwould clobber\b/i.test(err)) {
      throw new Error(
        `${branch} has diverged from ${upstream} — check it out and merge or rebase to reconcile.`
      )
    }
    throw new Error(err.trim() || `Couldn’t update ${branch}.`)
  }
  const after = (await gitExec(cwd, ['rev-parse', branch])).stdout.trim()
  const updated =
    before === after
      ? 0
      : parseInt(
          (await gitExec(cwd, ['rev-list', '--count', `${before}..${after}`])).stdout.trim(),
          10
        ) || 0
  return { updated, upstream }
}

export async function checkout(cwd: string, ref: string): Promise<void> {
  const remotes = (await gitOrThrow(cwd, ['remote'])).split('\n').map((r) => r.trim()).filter(Boolean)
  const firstSeg = ref.split('/')[0]
  const isRemoteBranch = remotes.includes(firstSeg) && ref.includes('/')

  if (isRemoteBranch) {
    // e.g. "origin/feature/x" -> local "feature/x" tracking the remote.
    const local = ref.slice(firstSeg.length + 1)
    const existing = (await gitOrThrow(cwd, ['branch', '--list', local])).trim()
    if (existing) {
      await gitOrThrow(cwd, ['checkout', local])
    } else {
      await gitOrThrow(cwd, ['checkout', '-b', local, '--track', ref])
    }
  } else {
    await gitOrThrow(cwd, ['checkout', ref])
  }
}
