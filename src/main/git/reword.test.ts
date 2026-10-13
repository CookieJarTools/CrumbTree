import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commitMessage, rewordCommit } from './reword'

let repo = ''
const g = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
const subject = (ref: string) => g('log', '-1', '--format=%s', ref).trim()
const sha = (ref: string) => g('rev-parse', ref).trim()
const author = (ref: string) => g('log', '-1', '--format=%an <%ae> %ad', '--date=raw', ref).trim()

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'crumb-reword-'))
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  writeFileSync(join(repo, 'a.txt'), '1\n')
  g('add', '-A')
  g('commit', '-qm', 'first commit\n\nwith a body line')
  writeFileSync(join(repo, 'b.txt'), '2\n')
  g('add', '-A')
  g('commit', '-qm', 'second commit')
  writeFileSync(join(repo, 'c.txt'), '3\n')
  g('add', '-A')
  g('commit', '-qm', 'third commit')
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('commitMessage', () => {
  it('returns the full message including the body', async () => {
    const first = g('rev-list', '--max-parents=0', 'HEAD').trim()
    expect(await commitMessage(repo, first)).toBe('first commit\n\nwith a body line')
  })
})

describe('rewordCommit', () => {
  it('rewords the tip and keeps its tree and author', async () => {
    const treeBefore = g('rev-parse', 'HEAD^{tree}').trim()
    const authBefore = author('HEAD')
    await rewordCommit(repo, 'HEAD', 'third commit (reworded)')
    expect(subject('HEAD')).toBe('third commit (reworded)')
    expect(g('rev-parse', 'HEAD^{tree}').trim()).toBe(treeBefore) // no file changes
    expect(author('HEAD')).toBe(authBefore) // author + date preserved
  })

  it('rewords an earlier commit, preserving the ones after it', async () => {
    const secondOld = sha('HEAD~1')
    const thirdSubjectBefore = subject('HEAD')
    const thirdAuthorBefore = author('HEAD')
    await rewordCommit(repo, secondOld, 'second commit (reworded)')

    expect(g('rev-list', '--count', 'HEAD').trim()).toBe('3')
    expect(subject('HEAD~1')).toBe('second commit (reworded)')
    expect(subject('HEAD')).toBe(thirdSubjectBefore) // third's message intact
    expect(author('HEAD')).toBe(thirdAuthorBefore) // and its author/date
    expect(sha('HEAD~1')).not.toBe(secondOld) // history rewritten
  })

  it('works with a dirty working tree and leaves it untouched (the reported bug)', async () => {
    // This is the exact scenario that broke rebase-based reword: reword must NOT
    // check out anything, so uncommitted changes are simply left alone.
    writeFileSync(join(repo, 'a.txt'), 'uncommitted edit\n')
    writeFileSync(join(repo, 'untracked.txt'), 'new\n')
    const statusBefore = g('status', '--porcelain').trim()

    await rewordCommit(repo, sha('HEAD~2'), 'first commit reworded\n\nbody kept')

    expect(subject('HEAD~2')).toBe('first commit reworded')
    expect(await commitMessage(repo, sha('HEAD~2'))).toBe('first commit reworded\n\nbody kept')
    // working tree exactly as it was
    expect(g('status', '--porcelain').trim()).toBe(statusBefore)
    expect(readFileSync(join(repo, 'a.txt'), 'utf8')).toBe('uncommitted edit\n')
  })

  it('refuses a commit that is not on the current branch', async () => {
    g('checkout', '-qb', 'other')
    writeFileSync(join(repo, 'o.txt'), 'o\n')
    g('add', '-A')
    g('commit', '-qm', 'only on other')
    const otherOnly = sha('HEAD')
    g('checkout', '-q', 'main')
    await expect(rewordCommit(repo, otherOnly, 'nope')).rejects.toThrow(/current branch/i)
  })
})
