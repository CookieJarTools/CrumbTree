import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { RepoInfo } from '@shared/types'
import { gitExec, gitStream } from './exec'
import { openRepo } from './repo'

/**
 * Git 2.45.1+ refuses to run repository hooks (e.g. the post-checkout hook that
 * Git LFS installs) during `git clone` and exits non-zero — "Clone succeeded,
 * but checkout failed." The objects are fully fetched; only the working-tree
 * checkout via the hook was blocked. Recognise this benign case so we can finish
 * the checkout ourselves without executing the untrusted hook.
 */
export function isBenignCloneCheckoutFailure(stderr: string): boolean {
  return (
    /GIT_CLONE_PROTECTION_ACTIVE/i.test(stderr) ||
    /hook found during .?git clone.?/i.test(stderr) ||
    /Clone succeeded, but checkout failed/i.test(stderr)
  )
}

/**
 * Clone `url` into `<dir>/<name>` and return the opened repo. Uses the user's
 * own git (and their SSH keys / credential helper) — no secrets pass through us.
 */
export async function cloneRepo(url: string, dir: string, name: string): Promise<RepoInfo> {
  const cleanUrl = url.trim()
  if (!cleanUrl) throw new Error('Enter a repository URL to clone.')
  if (!dir) throw new Error('Choose a destination folder.')
  const folder = (name || 'repo').trim()
  const target = join(dir, folder)

  // Refuse to clone into a non-empty directory (git would fail anyway; nicer message).
  if (existsSync(target)) {
    const entries = await readdir(target).catch(() => [] as string[])
    if (entries.length > 0) {
      throw new Error(`“${folder}” already exists here and isn't empty. Pick another name or folder.`)
    }
  }

  // Git 2.45.1+ blocks repository hooks during `git clone` and fails the whole
  // command (common with Git LFS, which installs a post-checkout hook). Cloning
  // is an explicit, user-initiated action here — the same trust context as the
  // user running `git clone` themselves — so we set GIT_CLONE_PROTECTION_ACTIVE
  // =false, exactly as git's own error message recommends. This lets the LFS
  // hook run and the clone finish cleanly instead of erroring out.
  const res = await gitStream(dir, ['clone', '--progress', cleanUrl, folder], {
    env: { GIT_CLONE_PROTECTION_ACTIVE: 'false' }
  })
  if (res.code !== 0) {
    // Fallback for any git that still trips on the hook: the objects are already
    // fetched, so finish the working tree from HEAD. `git restore` does not fire
    // the post-checkout hook, so it completes without re-running anything.
    if (isBenignCloneCheckoutFailure(res.stderr) && existsSync(join(target, '.git'))) {
      await gitExec(target, ['restore', '--source=HEAD', ':/'])
    } else {
      throw new Error(
        res.stderr.trim() || 'Clone failed. Check the URL and your access to the repository.'
      )
    }
  }
  return openRepo(target)
}
