// Pure helpers for the Clone dialog: recognise a git remote URL (for clipboard
// pre-fill, like Fork) and derive a sensible default folder name from it.

/**
 * Does this text look like a git remote we could clone? Accepts:
 *   https://host/owner/repo(.git)   http://…   git://…
 *   ssh://git@host/owner/repo.git   git@host:owner/repo.git   user@host:path
 */
export function looksLikeGitUrl(text: string): boolean {
  const t = text.trim()
  if (!t || /\s/.test(t)) return false
  if (/^(https?|git|ssh):\/\/[^/]+\/.+/i.test(t)) return true
  // scp-style: user@host:path (at least one "/" or ".git" in the path)
  if (/^[\w.-]+@[\w.-]+:.+/.test(t)) return true
  return false
}

/**
 * Default clone folder name derived from a git URL: the last path segment with
 * any trailing ".git" and slashes stripped. Returns '' if nothing usable.
 */
export function repoNameFromUrl(url: string): string {
  let s = url.trim()
  if (!s) return ''
  // Drop a trailing ".git" (possibly followed by a slash).
  s = s.replace(/\.git\/?$/i, '')
  // Strip any trailing slashes.
  s = s.replace(/[/\\]+$/, '')
  // scp-style "git@host:owner/repo" — take everything after the last "/" or ":".
  const seg = s.split(/[/:\\]/).filter(Boolean).pop() ?? ''
  // Sanitise to a filesystem-friendly folder name.
  return seg.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
}
