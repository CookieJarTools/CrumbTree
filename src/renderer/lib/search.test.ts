import { describe, expect, it } from 'vitest'
import type { Commit, Ref } from '@shared/types'
import { filterRefs, matchCommit } from './search'
import { parseGitCommand } from './parse-cmd'

const commit = (over: Partial<Commit>): Commit => ({
  hash: 'abc1234def',
  parents: [],
  authorName: 'Ada Lovelace',
  authorEmail: 'ada@example.com',
  timestamp: 0,
  subject: 'Fix the thing',
  refs: ['main'],
  ...over
})

describe('matchCommit', () => {
  it('matches on subject, hash, author, ref; empty query matches all', () => {
    const c = commit({})
    expect(matchCommit(c, '')).toBe(true)
    expect(matchCommit(c, 'fix')).toBe(true)
    expect(matchCommit(c, 'abc12')).toBe(true)
    expect(matchCommit(c, 'ada')).toBe(true)
    expect(matchCommit(c, 'main')).toBe(true)
    expect(matchCommit(c, 'nope')).toBe(false)
  })
})

describe('filterRefs', () => {
  const refs: Ref[] = [
    { name: 'main', type: 'localBranch', hash: 'aaaa111' },
    { name: 'feature/login', type: 'localBranch', hash: 'bbbb222' }
  ]
  it('filters by name and by hash', () => {
    expect(filterRefs(refs, 'login').map((r) => r.name)).toEqual(['feature/login'])
    expect(filterRefs(refs, 'aaaa').map((r) => r.name)).toEqual(['main'])
    expect(filterRefs(refs, '')).toHaveLength(2)
  })
})

describe('parseGitCommand', () => {
  it('strips a leading git and splits args', () => {
    expect(parseGitCommand('git log --oneline')).toEqual({ ok: true, args: ['log', '--oneline'] })
    expect(parseGitCommand('status')).toEqual({ ok: true, args: ['status'] })
  })
  it('handles quoted arguments', () => {
    expect(parseGitCommand('commit -m "hello world"')).toEqual({
      ok: true,
      args: ['commit', '-m', 'hello world']
    })
  })
  it('rejects empty input and unbalanced quotes', () => {
    expect(parseGitCommand('   ').ok).toBe(false)
    expect(parseGitCommand('git ').ok).toBe(false)
    expect(parseGitCommand('commit -m "unclosed').ok).toBe(false)
  })
})
