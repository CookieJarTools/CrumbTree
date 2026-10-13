import { gitExec, gitOrThrow } from './exec'

/** Branches (local + remote) that contain a given commit. */
export async function branchesContaining(cwd: string, hash: string): Promise<string[]> {
  const out = await gitOrThrow(cwd, [
    'branch',
    '-a',
    '--contains',
    hash,
    '--format=%(refname:short)'
  ])
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of out.split('\n')) {
    const name = raw.trim()
    if (!name || name.endsWith('/HEAD')) continue
    if (!seen.has(name)) {
      seen.add(name)
      result.push(name)
    }
  }
  return result
}

/** `git blame --line-porcelain` of a file at HEAD (falls back to the working tree). */
export async function blameFile(cwd: string, file: string): Promise<string> {
  const head = await gitExec(cwd, ['blame', '--line-porcelain', 'HEAD', '--', file], undefined, {
    silent: true
  })
  if (head.code === 0 && head.stdout.trim()) return head.stdout
  const wt = await gitExec(cwd, ['blame', '--line-porcelain', '--', file], undefined, { silent: true })
  return wt.stdout
}
