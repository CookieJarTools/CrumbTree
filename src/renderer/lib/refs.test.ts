import { describe, expect, it } from 'vitest'
import { dedupeRefs, isBaseBranch } from './refs'

const remotes = new Set(['origin'])

describe('isBaseBranch', () => {
  it('recognises mainline branches case-insensitively', () => {
    expect(isBaseBranch('main')).toBe(true)
    expect(isBaseBranch('Master')).toBe(true)
    expect(isBaseBranch('development')).toBe(true)
    expect(isBaseBranch('Runtime')).toBe(false)
    expect(isBaseBranch('dev/height_fix')).toBe(false)
  })
})

describe('dedupeRefs', () => {
  it('collapses an in-sync local + remote branch to just the local name', () => {
    expect(dedupeRefs(['main', 'origin/main'], remotes)).toEqual(['main'])
  })

  it('drops origin/HEAD', () => {
    expect(dedupeRefs(['main', 'origin/main', 'origin/HEAD'], remotes)).toEqual(['main'])
  })

  it('keeps a remote branch when there is no matching local branch (diverged/remote-only)', () => {
    expect(dedupeRefs(['origin/feature'], remotes)).toEqual(['origin/feature'])
  })

  it('handles branch names with slashes', () => {
    expect(dedupeRefs(['dev/height_fix', 'origin/dev/height_fix'], remotes)).toEqual(['dev/height_fix'])
  })

  it('leaves tags and unrelated refs alone', () => {
    expect(dedupeRefs(['1.2.3', 'main', 'origin/main'], remotes)).toEqual(['1.2.3', 'main'])
  })
})
