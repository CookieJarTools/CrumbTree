export type ConflictChoice = 'ours' | 'theirs' | 'both'

export interface TextSegment {
  type: 'text'
  lines: string[]
}

export interface ConflictSegment {
  type: 'conflict'
  ours: string[]
  theirs: string[]
  /** diff3 base, when present. */
  base?: string[]
}

export type Segment = TextSegment | ConflictSegment

/**
 * Split a conflicted file into ordered segments: plain text runs and conflict blocks.
 * Understands both 2-way (`<<<<<<< / ======= / >>>>>>>`) and diff3
 * (`<<<<<<< / ||||||| / ======= / >>>>>>>`) markers. Pure — unit-tested.
 */
export function parseConflicts(text: string): Segment[] {
  const lines = text.split('\n')
  const segments: Segment[] = []
  let buf: string[] = []
  const flush = () => {
    if (buf.length) {
      segments.push({ type: 'text', lines: buf })
      buf = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('<<<<<<<')) {
      flush()
      const ours: string[] = []
      const base: string[] = []
      const theirs: string[] = []
      let phase: 'ours' | 'base' | 'theirs' = 'ours'
      i++
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) {
        const l = lines[i]
        if (l.startsWith('|||||||')) phase = 'base'
        else if (l.startsWith('=======')) phase = 'theirs'
        else if (phase === 'ours') ours.push(l)
        else if (phase === 'base') base.push(l)
        else theirs.push(l)
        i++
      }
      i++ // skip the >>>>>>> line
      const seg: ConflictSegment = { type: 'conflict', ours, theirs }
      if (base.length) seg.base = base
      segments.push(seg)
    } else {
      buf.push(line)
      i++
    }
  }
  flush()
  return segments
}

/** Does the text still contain conflict markers? */
export function hasConflicts(text: string): boolean {
  return /^<<<<<<< /m.test(text)
}

/** One line of the assembled result, tagged with where it came from. */
export interface ResultLine {
  text: string
  /** 'context' = unchanged surrounding text; 'ours'/'theirs' = came from resolving a conflict. */
  origin: 'context' | 'ours' | 'theirs'
}

/**
 * Rebuild the file line-by-line, applying a per-conflict choice, tagging each line's origin so
 * the UI can highlight the lines that changed because of the merge. `choices[k]` is the choice
 * for the k-th conflict block (defaults to 'ours' if unspecified).
 */
export function assembleLines(segments: Segment[], choices: ConflictChoice[]): ResultLine[] {
  const out: ResultLine[] = []
  let ci = 0
  for (const seg of segments) {
    if (seg.type === 'text') {
      for (const l of seg.lines) out.push({ text: l, origin: 'context' })
    } else {
      const choice = choices[ci] ?? 'ours'
      ci++
      if (choice === 'ours' || choice === 'both') {
        for (const l of seg.ours) out.push({ text: l, origin: 'ours' })
      }
      if (choice === 'theirs' || choice === 'both') {
        for (const l of seg.theirs) out.push({ text: l, origin: 'theirs' })
      }
    }
  }
  return out
}

/** Rebuild the resolved file text (see `assembleLines`). */
export function assemble(segments: Segment[], choices: ConflictChoice[]): string {
  return assembleLines(segments, choices)
    .map((l) => l.text)
    .join('\n')
}

/** Number of conflict blocks in a parsed file. */
export function conflictCount(segments: Segment[]): number {
  return segments.filter((s) => s.type === 'conflict').length
}
