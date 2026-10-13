/**
 * Collapse redundant ref decorations on a commit: when a local branch and its
 * `<remote>/branch` tracking ref sit on the SAME commit (in sync), show only the local
 * name; always drop `<remote>/HEAD`. Diverged refs live on different commits, so they
 * still show separately. Pure — unit-tested.
 */
const BASE_BRANCHES = new Set([
  'main',
  'master',
  'develop',
  'development',
  'trunk',
  'release',
  'stable',
  'production'
])

/** A "base" branch is a shared/mainline branch, not something you personally work on. */
export function isBaseBranch(name: string): boolean {
  return BASE_BRANCHES.has(name.toLowerCase())
}

export function dedupeRefs(refs: string[], remotes: Set<string>): string[] {
  const isRemote = (r: string) => remotes.has(r.split('/')[0])
  const localNames = new Set(refs.filter((r) => !isRemote(r)))
  const out: string[] = []
  for (const r of refs) {
    if (isRemote(r)) {
      if (r.endsWith('/HEAD')) continue
      const branch = r.slice(r.indexOf('/') + 1)
      if (localNames.has(branch)) continue
    }
    out.push(r)
  }
  return out
}
