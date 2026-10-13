import type { DiffHunk, FileDiff } from '@shared/types'

/**
 * Rebuild a valid one-hunk unified-diff patch from a parsed hunk, suitable for
 * `git apply --cached`. Because we reproduce the hunk exactly as git emitted it
 * (context included, original header counts), the patch applies cleanly.
 */
export function buildHunkPatch(diff: FileDiff, hunk: DiffHunk): string {
  const a = diff.oldPath ?? diff.path
  const b = diff.path
  const lines: string[] = [
    `diff --git a/${a} b/${b}`,
    `--- a/${a}`,
    `+++ b/${b}`,
    hunk.header
  ]
  for (const l of hunk.lines) {
    if (l.type === 'context' && l.oldLineNo === null && l.newLineNo === null) {
      // "\ No newline at end of file" marker — emit verbatim.
      lines.push(l.content)
    } else if (l.type === 'add') {
      lines.push('+' + l.content)
    } else if (l.type === 'del') {
      lines.push('-' + l.content)
    } else {
      lines.push(' ' + l.content)
    }
  }
  return lines.join('\n') + '\n'
}
