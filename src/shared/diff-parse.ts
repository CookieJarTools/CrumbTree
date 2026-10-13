import type { DiffHunk, FileDiff } from './types'

/** Parse unified-diff text (single file) into structured hunks. Pure — shared by
 *  the git service (main) and the demo mock (renderer). */
export function parseUnifiedDiff(path: string, raw: string): FileDiff {
  const diff: FileDiff = { path, binary: false, hunks: [] }
  if (!raw) return diff
  const lines = raw.split('\n')
  let current: DiffHunk | null = null
  let oldNo = 0
  let newNo = 0

  for (const line of lines) {
    if (line.startsWith('Binary files') || line.startsWith('GIT binary patch')) {
      diff.binary = true
      continue
    }
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('new file') ||
      line.startsWith('deleted file') ||
      line.startsWith('similarity ') ||
      line.startsWith('rename ')
    ) {
      continue
    }
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/)
    if (hunkMatch) {
      const oldStart = parseInt(hunkMatch[1], 10)
      const oldLines = hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1
      const newStart = parseInt(hunkMatch[3], 10)
      const newLines = hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1
      current = { header: line, oldStart, oldLines, newStart, newLines, lines: [] }
      diff.hunks.push(current)
      oldNo = oldStart
      newNo = newStart
      continue
    }
    if (!current) continue
    if (line.startsWith('\\')) {
      current.lines.push({ type: 'context', content: line, oldLineNo: null, newLineNo: null })
      continue
    }
    const marker = line[0]
    const content = line.slice(1)
    if (marker === '+') {
      current.lines.push({ type: 'add', content, oldLineNo: null, newLineNo: newNo++ })
    } else if (marker === '-') {
      current.lines.push({ type: 'del', content, oldLineNo: oldNo++, newLineNo: null })
    } else {
      current.lines.push({ type: 'context', content, oldLineNo: oldNo++, newLineNo: newNo++ })
    }
  }
  return diff
}
