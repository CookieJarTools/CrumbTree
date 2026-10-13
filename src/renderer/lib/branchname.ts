/**
 * Turn free text into a git-legal branch name. Lowercases, converts whitespace and
 * illegal characters to dashes, and collapses/trims dashes and dots. Returns '' when
 * nothing usable remains (caller should reject empty names).
 */
export function sanitizeBranchName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s~^:?*[\]\\]+/g, '-') // whitespace + git-forbidden chars
    .replace(/[^a-z0-9._/-]/g, '') // drop anything else (accents, emoji, …)
    .replace(/\/{2,}/g, '/') // no empty path segments
    .replace(/-{2,}/g, '-') // collapse dashes
    .replace(/\.{2,}/g, '.') // no ".." (illegal in refs)
    .replace(/^[-/.]+|[-/.]+$/g, '') // trim leading/trailing separators
    .replace(/\.lock$/, 'lock') // refs may not end in .lock
}
