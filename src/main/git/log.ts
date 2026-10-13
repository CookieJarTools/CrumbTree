import type { Commit } from '@shared/types'
import { gitOrThrow } from './exec'

const NUL = String.fromCharCode(0)

// Fields per commit, NUL-separated; commits are separated by newlines. %s and %D
// are single-line, so a newline record separator is safe.
const FORMAT = ['%H', '%P', '%an', '%ae', '%at', '%D', '%s'].join('%x00')

function parseRefs(decorate: string): string[] {
  // %D yields e.g. "HEAD -> main, origin/main, tag: v1.0"
  if (!decorate.trim()) return []
  return decorate
    .split(',')
    .map((r) => r.trim())
    .map((r) => r.replace(/^HEAD -> /, '').replace(/^tag: /, ''))
    .filter(Boolean)
}

function parseCommitLines(out: string): Commit[] {
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
      refs: parseRefs(decorate ?? '')
    })
  }
  return commits
}

export async function listCommits(cwd: string, limit = 1000, skip = 0): Promise<Commit[]> {
  const out = await gitOrThrow(cwd, [
    'log',
    '--all',
    '--date-order',
    `--pretty=format:${FORMAT}`,
    `--max-count=${limit}`,
    `--skip=${skip}`
  ])
  return parseCommitLines(out)
}

/** Every commit (across all branches) that changed a single file. */
export async function listFileCommits(cwd: string, file: string, limit = 200): Promise<Commit[]> {
  const out = await gitOrThrow(cwd, [
    'log',
    '--all',
    '--date-order',
    `--pretty=format:${FORMAT}`,
    `--max-count=${limit}`,
    '--',
    file
  ])
  return parseCommitLines(out)
}
