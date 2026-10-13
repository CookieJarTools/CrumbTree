// Pure parser for git's progress output (the `--progress` lines git writes to
// stderr, separated by carriage returns rather than newlines).

export interface GitProgress {
  /** e.g. "Receiving objects", "Updating files", "Filtering content". */
  phase: string
  percent: number
  current: number | null
  total: number | null
  /** Trailing extra, e.g. "5.32 MiB | 2.11 MiB/s". */
  detail: string | null
  done: boolean
}

/** A progress update pushed from main to the renderer. */
export interface GitProgressEvent extends GitProgress {
  /** The command this progress belongs to, for display. */
  command: string
}

// "Receiving objects:  45% (1234/2741), 1.2 MiB | 500 KiB/s"
// "remote: Resolving deltas: 100% (123/123), done."
const RE = /^(?:remote:\s*)?([A-Za-z][A-Za-z ]*?):\s+(\d+)%\s+\((\d+)\/(\d+)\)(?:,\s*(.*?))?\s*$/

/** Parse one progress line, or null if it isn't one. */
export function parseProgressLine(raw: string): GitProgress | null {
  const line = raw.trim()
  if (!line) return null
  const m = RE.exec(line)
  if (!m) return null
  const [, phase, pct, cur, tot, rest] = m

  let detail = (rest ?? '').trim()
  const done = /(^|,\s*)done\.?$/.test(detail)
  detail = detail.replace(/,?\s*done\.?$/, '').trim()

  return {
    phase: phase.trim(),
    percent: parseInt(pct, 10),
    current: parseInt(cur, 10),
    total: parseInt(tot, 10),
    detail: detail || null,
    done
  }
}

/** Git separates progress updates with \r, so split on both. */
export function splitProgressChunk(chunk: string): string[] {
  return chunk.split(/\r\n|\r|\n/)
}

/** Human label for a progress update, e.g. "Receiving objects — 1234/2741". */
export function progressLabel(p: GitProgress): string {
  if (p.current === null || p.total === null) return p.phase
  return `${p.phase} — ${p.current}/${p.total}`
}
