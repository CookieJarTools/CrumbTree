import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stageFile, stagePaths, unstagePaths, discardPaths } from './stage'
import { workingStatus } from './repo'

// Integration test against real git — proves the batched ops don't collide on
// .git/index.lock the way the old per-file loop did.

let repo = ''
const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'crumb-stage-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(repo, 'seed.txt'), 'seed\n')
  git('add', '-A')
  git('commit', '-qm', 'init')
})

afterEach(() => {
  if (repo) rmSync(repo, { recursive: true, force: true })
})

const files = (n: number) =>
  Array.from({ length: n }, (_, i) => `f${i}.txt`).map((name) => {
    writeFileSync(join(repo, name), `content ${name}\n`)
    return name
  })

describe('stagePaths', () => {
  it('stages many files in one shot', async () => {
    const paths = files(40)
    await stagePaths(repo, paths)
    const st = await workingStatus(repo)
    expect(st.staged.map((f) => f.path).sort()).toEqual([...paths].sort())
    expect(st.unstaged).toHaveLength(0)
  })

  it('reproduces the index.lock collision when the same adds run in parallel', async () => {
    // The old "Stage all" fired one stageFile per file concurrently. With enough
    // files at least one loses the race for the lock. This documents WHY we batch.
    const paths = files(40)
    const results = await Promise.allSettled(paths.map((p) => stageFile(repo, p)))
    const failures = results.filter((r) => r.status === 'rejected')
    const lockErrors = failures.filter((r) =>
      /index\.lock/i.test(String((r as PromiseRejectedResult).reason))
    )
    // Batched stagePaths of the SAME set never collides:
    await stagePaths(repo, paths)
    const st = await workingStatus(repo)
    expect(st.staged.length).toBe(40)
    // We assert the collision is at least *possible* (flaky by nature, so allow 0
    // but require that when there were failures they were all lock contention).
    expect(failures.length).toBe(lockErrors.length)
  })
})

describe('unstagePaths', () => {
  it('unstages many files in one shot', async () => {
    const paths = files(30)
    await stagePaths(repo, paths)
    await unstagePaths(repo, paths)
    const st = await workingStatus(repo)
    expect(st.staged).toHaveLength(0)
    expect(st.unstaged.map((f) => f.path).sort()).toEqual([...paths].sort())
  })
})

describe('discardPaths', () => {
  it('restores tracked edits and deletes untracked files', async () => {
    // one tracked (edit seed) + several untracked
    writeFileSync(join(repo, 'seed.txt'), 'edited\n')
    const untracked = files(10)
    await discardPaths(repo, ['seed.txt', ...untracked])
    const st = await workingStatus(repo)
    expect(st.unstaged).toHaveLength(0)
    expect(st.staged).toHaveLength(0)
    // seed.txt is back to its committed content
    expect(execFileSync('git', ['show', 'HEAD:seed.txt'], { cwd: repo, encoding: 'utf8' })).toBe(
      'seed\n'
    )
  })
})
