// Pure helpers for interactive rebase: turn a plan into a git rebase todo list.
// Kept free of Node/DOM so both the renderer (validation) and main (execution) use it.

export type RebaseAction = 'pick' | 'reword' | 'squash' | 'fixup' | 'edit' | 'drop'

export interface RebaseStep {
  hash: string
  /** Subject, carried for display only. */
  subject?: string
  action: RebaseAction
  /** Replacement commit message — only used by `reword`. */
  message?: string
}

/** Quote a string for POSIX sh — git runs todo `exec` lines through a shell. */
export function shQuote(s: string): string {
  return `'${s.split("'").join(`'\\''`)}'`
}

/**
 * Build a rebase todo list. Steps are applied top to bottom (oldest first).
 *
 * `reword` is expressed as `pick` + `exec git commit --amend -m <msg>` rather than
 * git's own `reword`, because `reword` would block waiting on a commit-message
 * editor. `squash` keeps git's default combined message (the app runs rebase with
 * `core.editor=true`, so nothing ever opens an editor).
 */
export function buildTodo(steps: RebaseStep[]): string {
  const lines: string[] = []
  for (const s of steps) {
    switch (s.action) {
      case 'drop':
        lines.push(`drop ${s.hash}`)
        break
      case 'reword':
        lines.push(`pick ${s.hash}`)
        if (s.message && s.message.trim()) {
          lines.push(`exec git commit --amend -m ${shQuote(s.message.trim())}`)
        }
        break
      case 'squash':
        lines.push(`squash ${s.hash}`)
        break
      case 'fixup':
        lines.push(`fixup ${s.hash}`)
        break
      case 'edit':
        lines.push(`edit ${s.hash}`)
        break
      default:
        lines.push(`pick ${s.hash}`)
    }
  }
  return lines.join('\n') + '\n'
}

/** Why a plan can't run, or null when it's valid. */
export function validatePlan(steps: RebaseStep[]): string | null {
  const kept = steps.filter((s) => s.action !== 'drop')
  if (kept.length === 0) return 'Dropping every commit would leave nothing to rebase.'
  if (kept[0].action === 'squash' || kept[0].action === 'fixup') {
    return 'The first commit has nothing above it to squash into.'
  }
  for (const s of steps) {
    if (s.action === 'reword' && !(s.message ?? '').trim()) {
      return 'Give every reworded commit a new message.'
    }
  }
  return null
}

/** True when the plan would leave history exactly as it is. */
export function isNoop(steps: RebaseStep[], original: string[]): boolean {
  if (steps.length !== original.length) return false
  return steps.every((s, i) => s.action === 'pick' && s.hash === original[i])
}
