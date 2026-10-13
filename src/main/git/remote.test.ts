import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pullBranch } from './remote'

// Integration test: update a branch from its upstream WITHOUT checking it out.

let remote = ''
let clone = ''
const g = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' })

beforeEach(() => {
  // A bare "origin" with a main branch and one commit.
  remote = mkdtempSync(join(tmpdir(), 'crumb-remote-'))
  const seed = mkdtempSync(join(tmpdir(), 'crumb-seed-'))
  g(seed, 'init', '-q', '-b', 'main')
  g(seed, 'config', 'user.email', 't@t')
  g(seed, 'config', 'user.name', 't')
  writeFileSync(join(seed, 'a.txt'), 'one\n')
  g(seed, 'add', '-A')
  g(seed, 'commit', '-qm', 'c1')
  g(remote, 'init', '-q', '--bare', '-b', 'main')
  // Make the bare's default branch main so a fresh clone checks it out.
  g(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main')
  g(seed, 'remote', 'add', 'origin', remote)
  g(seed, 'push', '-q', 'origin', 'main')

  // The working clone: on a feature branch, with main tracking origin/main.
  clone = mkdtempSync(join(tmpdir(), 'crumb-clone-'))
  g(clone, 'clone', '-q', remote, '.')
  g(clone, 'config', 'user.email', 't@t')
  g(clone, 'config', 'user.name', 't')
  g(clone, 'checkout', '-qb', 'feature')

  // Advance origin/main by pushing a new commit from the seed.
  writeFileSync(join(seed, 'a.txt'), 'two\n')
  g(seed, 'commit', '-qam', 'c2')
  g(seed, 'push', '-q', 'origin', 'main')
  g(clone, 'fetch', '-q', 'origin')
  rmSync(seed, { recursive: true, force: true })
})

afterEach(() => {
  rmSync(remote, { recursive: true, force: true })
  rmSync(clone, { recursive: true, force: true })
})

describe('pullBranch', () => {
  it('fast-forwards a branch you are not on, without checkout', async () => {
    const onBefore = g(clone, 'rev-parse', '--abbrev-ref', 'HEAD').trim()
    const res = await pullBranch(clone, 'main')
    expect(res.updated).toBe(1)
    expect(res.upstream).toBe('origin/main')
    // local main now equals origin/main
    expect(g(clone, 'rev-parse', 'main').trim()).toBe(g(clone, 'rev-parse', 'origin/main').trim())
    // and we never left the feature branch
    expect(g(clone, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe(onBefore)
    expect(onBefore).toBe('feature')
  })

  it('reports 0 when already up to date', async () => {
    await pullBranch(clone, 'main')
    const res = await pullBranch(clone, 'main')
    expect(res.updated).toBe(0)
  })

  it('refuses (throws) when the branch has diverged from its upstream', async () => {
    // Give local main a commit that origin doesn't have -> non-fast-forward.
    g(clone, 'branch', '-f', 'main', 'HEAD')
    g(clone, 'checkout', '-q', 'main')
    writeFileSync(join(clone, 'local.txt'), 'divergent\n')
    g(clone, 'add', '-A')
    g(clone, 'commit', '-qm', 'local-only')
    g(clone, 'checkout', '-q', 'feature')
    await expect(pullBranch(clone, 'main')).rejects.toThrow(/diverged|current branch|update/i)
  })
})
