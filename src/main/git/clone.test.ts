import { describe, expect, it } from 'vitest'
import { isBenignCloneCheckoutFailure } from './clone'

describe('isBenignCloneCheckoutFailure', () => {
  it('detects the Git 2.45 clone-protection / hook failure', () => {
    const stderr =
      'Updating files: 100% (867/867), done.\n' +
      'fatal: active `post-checkout` hook found during `git clone`: ' +
      'F:/Dev/SpaceGame/.git/hooks/post-checkout For security reasons, this is disallowed by default. ' +
      'If this is intentional and the hook should actually be run, please run the command again with ' +
      '`GIT_CLONE_PROTECTION_ACTIVE=false`\n' +
      'warning: Clone succeeded, but checkout failed.'
    expect(isBenignCloneCheckoutFailure(stderr)).toBe(true)
  })

  it('matches the short "Clone succeeded, but checkout failed" warning alone', () => {
    expect(isBenignCloneCheckoutFailure('warning: Clone succeeded, but checkout failed.')).toBe(true)
  })

  it('does not match ordinary clone failures', () => {
    expect(isBenignCloneCheckoutFailure("fatal: repository 'x' not found")).toBe(false)
    expect(isBenignCloneCheckoutFailure('fatal: Authentication failed')).toBe(false)
    expect(isBenignCloneCheckoutFailure('fatal: could not read Username')).toBe(false)
  })
})
