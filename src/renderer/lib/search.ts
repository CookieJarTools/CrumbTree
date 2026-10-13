import type { Commit, Ref } from '@shared/types'

/** Case-insensitive match of a commit against a query (subject, hash, author). */
export function matchCommit(commit: Commit, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    commit.subject.toLowerCase().includes(q) ||
    commit.hash.toLowerCase().includes(q) ||
    commit.authorName.toLowerCase().includes(q) ||
    commit.authorEmail.toLowerCase().includes(q) ||
    commit.refs.some((r) => r.toLowerCase().includes(q))
  )
}

/** Filter refs by name or (short/long) hash. */
export function filterRefs<T extends Ref>(refs: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return refs
  return refs.filter(
    (r) => r.name.toLowerCase().includes(q) || r.hash.toLowerCase().includes(q)
  )
}

/** Filter a list of file paths by substring. */
export function filterPaths(paths: string[], query: string): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return paths
  return paths.filter((p) => p.toLowerCase().includes(q))
}
