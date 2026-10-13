import type { TerminalResult } from '@shared/types'
import { gitExec } from './exec'

/**
 * Run a user-typed git command in the repo. `args` is already parsed/split by the
 * renderer; we always invoke the real `git` binary via execFile (no shell), so this
 * is git-only by construction. Returns stdout/stderr/code for display.
 */
export async function runGit(cwd: string, args: string[]): Promise<TerminalResult> {
  // Silent: the renderer appends its own op-log entry that also carries stdout,
  // so we don't want a duplicate auto-logged entry.
  const res = await gitExec(cwd, args, undefined, { silent: true })
  return { stdout: res.stdout, stderr: res.stderr, code: res.code }
}
