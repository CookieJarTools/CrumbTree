import { gitExec, gitOrThrow } from './exec'

const NUL = String.fromCharCode(0)

/** The full commit message (subject + body) of a commit. */
export async function commitMessage(cwd: string, hash: string): Promise<string> {
  const out = await gitOrThrow(cwd, ['log', '-1', '--format=%B', hash])
  return out.replace(/\n+$/, '')
}

interface CommitMeta {
  an: string
  ae: string
  ad: string
  cn: string
  ce: string
  cd: string
  tree: string
  parents: string[]
}

async function readMeta(cwd: string, hash: string): Promise<CommitMeta> {
  // All single-line fields, NUL-separated (the message is fetched separately).
  const fmt = ['%an', '%ae', '%ad', '%cn', '%ce', '%cd', '%T', '%P'].join('%x00')
  const out = await gitOrThrow(cwd, ['log', '-1', '--date=raw', `--format=${fmt}`, hash])
  const [an, ae, ad, cn, ce, cd, tree, parents] = out.replace(/\n$/, '').split(NUL)
  return {
    an,
    ae,
    ad,
    cn,
    ce,
    cd,
    tree: (tree ?? '').trim(),
    parents: (parents ?? '').trim().split(/\s+/).filter(Boolean)
  }
}

/** Create a commit object with the given tree/parents/message, preserving identity. */
async function writeCommit(
  cwd: string,
  tree: string,
  parents: string[],
  message: string,
  m: CommitMeta
): Promise<string> {
  const args = ['commit-tree', tree]
  for (const p of parents) args.push('-p', p)
  const res = await gitExec(cwd, args, `${message}\n`, {
    env: {
      GIT_AUTHOR_NAME: m.an,
      GIT_AUTHOR_EMAIL: m.ae,
      GIT_AUTHOR_DATE: m.ad,
      GIT_COMMITTER_NAME: m.cn,
      GIT_COMMITTER_EMAIL: m.ce,
      GIT_COMMITTER_DATE: m.cd
    }
  })
  if (res.code !== 0) throw new Error(res.stderr.trim() || 'Could not write the reworded commit.')
  return res.stdout.trim()
}

/**
 * Change a commit's message ("reword").
 *
 * Done entirely with plumbing (`commit-tree` + `update-ref`) so it NEVER checks
 * out or detaches HEAD — a message change alters no files, so there's no reason to
 * touch the working tree. This sidesteps the classic "your local changes would be
 * overwritten by checkout" failure that a `rebase -i` reword hits on repos with
 * awkward filter/LFS/attribute setups (e.g. binaries that look dirty to checkout).
 * It also works with uncommitted changes present, and preserves every commit's
 * original author, committer, and dates — only the target's message changes.
 *
 * Rewriting an earlier commit necessarily gives it (and its descendants) new IDs.
 */
export async function rewordCommit(cwd: string, hash: string, message: string): Promise<void> {
  const msg = message.trim()
  if (!msg) throw new Error('A commit needs a message.')

  const branch = (await gitExec(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])).stdout.trim()
  if (!branch) {
    throw new Error('You’re not on a branch (detached HEAD) — check out a branch to reword.')
  }
  const reachable = await gitExec(cwd, ['merge-base', '--is-ancestor', hash, 'HEAD'], undefined, {
    silent: true
  })
  if (reachable.code !== 0) {
    throw new Error('You can only reword a commit that’s on the current branch.')
  }

  const full = (await gitOrThrow(cwd, ['rev-parse', hash])).trim()
  const head = (await gitOrThrow(cwd, ['rev-parse', 'HEAD'])).trim()

  const parentCheck = await gitExec(cwd, ['rev-parse', '--verify', `${full}^`], undefined, {
    silent: true
  })
  const isRoot = parentCheck.code !== 0
  const range = isRoot ? 'HEAD' : `${full}^..HEAD`

  // A plain replay would flatten merges — refuse rather than silently damage history.
  const merges = (await gitExec(cwd, ['rev-list', '--merges', range], undefined, { silent: true }))
    .stdout.trim()
  if (merges) {
    throw new Error(
      'There are merge commits here — rewording would flatten them. Do it from a terminal instead.'
    )
  }

  // Rebuild the target and every commit after it, oldest first, remapping parents.
  const revs = (await gitOrThrow(cwd, ['rev-list', '--reverse', range]))
    .trim()
    .split('\n')
    .filter(Boolean)
  const remap = new Map<string, string>()
  for (const old of revs) {
    const meta = await readMeta(cwd, old)
    const thisMsg = old === full ? msg : await commitMessage(cwd, old)
    const parents = meta.parents.map((p) => remap.get(p) ?? p)
    remap.set(old, await writeCommit(cwd, meta.tree, parents, thisMsg, meta))
  }

  const newHead = remap.get(head)
  if (!newHead) throw new Error('Reword failed to rebuild the branch.')
  // Move the branch (with the old value as a guard against a concurrent change).
  // The tree is unchanged, so HEAD, index and working tree stay consistent.
  await gitOrThrow(cwd, [
    'update-ref',
    '-m',
    'reword: edit commit message',
    `refs/heads/${branch}`,
    newHead,
    head
  ])
}
