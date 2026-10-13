export interface BlameLine {
  hash: string
  author: string
  summary: string
  /** Author time, unix seconds. */
  time: number
  line: string
  /** True on the first line of each contiguous run from the same commit (for the gutter). */
  startsGroup: boolean
}

/**
 * Parse `git blame --line-porcelain` output. Each line is a block:
 *   <40-hash> <orig-line> <final-line> [num-lines]
 *   author <name>
 *   author-time <unix>
 *   summary <msg>
 *   ... (other headers)
 *   \t<code line>
 * Later blocks for the same commit repeat only the hash line + the tab line, so we cache
 * commit metadata by hash. Pure — unit-tested.
 */
export function parseBlame(raw: string): BlameLine[] {
  const lines = raw.split('\n')
  const meta = new Map<string, { author: string; summary: string; time: number }>()
  const out: BlameLine[] = []
  let i = 0
  let prevHash = ''

  while (i < lines.length) {
    const header = lines[i]
    const m = header.match(/^([0-9a-f]{7,40})\s+\d+\s+\d+/)
    if (!m) {
      i++
      continue
    }
    const hash = m[1]
    let author = meta.get(hash)?.author ?? ''
    let summary = meta.get(hash)?.summary ?? ''
    let time = meta.get(hash)?.time ?? 0
    i++
    // Consume header lines until the tab-prefixed code line.
    while (i < lines.length && !lines[i].startsWith('\t')) {
      const l = lines[i]
      if (l.startsWith('author ') && !l.startsWith('author-')) author = l.slice(7)
      else if (l.startsWith('author-time ')) time = parseInt(l.slice(12), 10) || 0
      else if (l.startsWith('summary ')) summary = l.slice(8)
      i++
    }
    meta.set(hash, { author, summary, time })
    const code = i < lines.length ? lines[i].slice(1) : ''
    i++
    out.push({ hash, author, summary, time, line: code, startsGroup: hash !== prevHash })
    prevHash = hash
  }
  return out
}
