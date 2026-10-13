import { basename } from 'node:path'
import type { FileStatus, HeadInfo, Ref, RepoInfo, WorkingStatus } from '@shared/types'
import { gitExec, gitOrThrow } from './exec'

// NUL byte used to separate git's -z / %00-formatted output.
const NUL = String.fromCharCode(0)

export async function isRepo(path: string): Promise<boolean> {
  // Internal probe — exit code is the answer, so don't log a failure as an error.
  const { stdout, code } = await gitExec(path, ['rev-parse', '--is-inside-work-tree'], undefined, {
    silent: true
  })
  return code === 0 && stdout.trim() === 'true'
}

export async function repoRoot(path: string): Promise<string> {
  const out = await gitOrThrow(path, ['rev-parse', '--show-toplevel'])
  return out.trim()
}

export async function headInfo(path: string): Promise<HeadInfo> {
  const branchOut = (await gitExec(path, ['symbolic-ref', '--quiet', '--short', 'HEAD'])).stdout.trim()
  const detached = branchOut === ''
  const hashOut = (await gitExec(path, ['rev-parse', '--short', 'HEAD'])).stdout.trim()
  const hash = hashOut === '' ? null : hashOut

  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  if (!detached) {
    // Probe: fails (harmlessly) for branches without an upstream — keep it out of the log.
    const up = (
      await gitExec(
        path,
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
        undefined,
        { silent: true }
      )
    ).stdout.trim()
    if (up) {
      upstream = up
      const counts = (
        await gitExec(path, ['rev-list', '--left-right', '--count', `${up}...HEAD`])
      ).stdout.trim()
      const [b, a] = counts.split(/\s+/).map((n) => parseInt(n, 10) || 0)
      behind = b || 0
      ahead = a || 0
    }
  }

  return { branch: detached ? null : branchOut, hash, detached, upstream, ahead, behind }
}

export async function openRepo(path: string): Promise<RepoInfo> {
  const root = await repoRoot(path)
  const head = await headInfo(root)
  return { path: root, name: basename(root), head }
}

const STATUS_TYPE: Record<string, FileStatus['type']> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'modified',
  T: 'modified',
  U: 'conflicted'
}

/**
 * Parse `git status --porcelain=v1 -z`. Each record: `XY <path>` (NUL-terminated);
 * for renames/copies the original path follows as the next NUL-separated token.
 * X = index (staged) status, Y = worktree (unstaged) status.
 */
export async function workingStatus(path: string): Promise<WorkingStatus> {
  const out = await gitOrThrow(path, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all'
  ])
  const staged: FileStatus[] = []
  const unstaged: FileStatus[] = []
  const conflicted: FileStatus[] = []

  const parts = out.split(NUL)
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i]
    if (chunk.length < 3) continue
    const x = chunk[0]
    const y = chunk[1]
    const filePath = chunk.slice(3)
    let oldPath: string | undefined
    if (x === 'R' || x === 'C') {
      // porcelain -z: new path is in this record, original path is the next token
      oldPath = parts[++i]
    }

    if (x === 'U' || y === 'U' || (x === 'D' && y === 'D') || (x === 'A' && y === 'A')) {
      conflicted.push({ path: filePath, oldPath, type: 'conflicted', staged: false })
      continue
    }

    if (x === '?' && y === '?') {
      unstaged.push({ path: filePath, type: 'untracked', staged: false })
      continue
    }

    if (x !== ' ' && x !== '?') {
      staged.push({ path: filePath, oldPath, type: STATUS_TYPE[x] ?? 'modified', staged: true })
    }
    if (y !== ' ' && y !== '?') {
      unstaged.push({ path: filePath, oldPath, type: STATUS_TYPE[y] ?? 'modified', staged: false })
    }
  }

  return { staged, unstaged, conflicted }
}

/**
 * Enumerate refs (local + remote branches, tags) plus detached HEAD. Uses
 * for-each-ref for a single, structured read.
 */
export async function listRefs(path: string): Promise<Ref[]> {
  const head = await headInfo(path)
  // %(upstream:track) is "[gone]" when the tracked remote branch was deleted.
  const fmt = [
    '%(refname)',
    '%(objectname:short)',
    '%(HEAD)',
    '%(upstream:short)',
    '%(upstream:track)'
  ].join('%00')
  const out = await gitOrThrow(path, [
    'for-each-ref',
    `--format=${fmt}`,
    'refs/heads',
    'refs/remotes',
    'refs/tags'
  ])
  const refs: Ref[] = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [refname, hash, headMark, upstream, track] = line.split(NUL)
    if (refname.startsWith('refs/heads/')) {
      const name = refname.slice('refs/heads/'.length)
      refs.push({
        name,
        type: 'localBranch',
        hash,
        current: headMark === '*',
        upstream: upstream || null,
        gone: /\bgone\b/.test(track ?? '')
      })
    } else if (refname.startsWith('refs/remotes/')) {
      const rest = refname.slice('refs/remotes/'.length)
      if (rest.endsWith('/HEAD')) continue
      const remote = rest.split('/')[0]
      refs.push({ name: rest, type: 'remoteBranch', hash, remote })
    } else if (refname.startsWith('refs/tags/')) {
      const name = refname.slice('refs/tags/'.length)
      refs.push({ name, type: 'tag', hash })
    }
  }
  if (head.detached && head.hash) {
    refs.unshift({ name: 'HEAD (detached)', type: 'head', hash: head.hash, current: true })
  }
  return refs
}
