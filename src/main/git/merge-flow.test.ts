import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mergeCurrent } from './branchops'
import { mergeContinue, mergeState, writeResolved } from './conflicts'

let repo = ''
const g = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'crumb-merge-'))
  g('init', '-q', '-b', 'main')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  writeFileSync(join(repo, 'f.txt'), 'base\n')
  g('add', '-A')
  g('commit', '-qm', 'base')
  // feature branch changes the same line
  g('checkout', '-qb', 'feature')
  writeFileSync(join(repo, 'f.txt'), 'feature change\n')
  g('add', '-A')
  g('commit', '-qm', 'feature edit')
  // main changes it differently
  g('checkout', '-q', 'main')
  writeFileSync(join(repo, 'f.txt'), 'main change\n')
  g('add', '-A')
  g('commit', '-qm', 'main edit')
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('merge conflict → resolve → continue', () => {
  it('leaves a conflicting merge in progress, then completes after resolution', async () => {
    const outcome = await mergeCurrent(repo, 'feature', 'merge')
    expect(outcome).toMatchObject({ ok: false, conflict: true })

    const state = await mergeState(repo)
    expect(state.inProgress).toBe(true)
    expect(state.kind).toBe('merge')
    expect(state.conflicted.map((f) => f.path)).toContain('f.txt')

    // Resolve (as an external editor would: write final content + stage it).
    await writeResolved(repo, 'f.txt', 'reconciled\n')

    const after = await mergeContinue(repo)
    expect(after.inProgress).toBe(false)
    expect(readFileSync(join(repo, 'f.txt'), 'utf8')).toBe('reconciled\n')
    // a real merge commit with two parents was created
    expect(g('rev-list', '--count', '--merges', 'HEAD').trim()).toBe('1')
    expect(g('log', '-1', '--format=%P').trim().split(' ')).toHaveLength(2)
  })

  it('refuses to START a merge when uncommitted changes would be overwritten', async () => {
    // dirty the conflicting file without committing
    writeFileSync(join(repo, 'f.txt'), 'uncommitted local work\n')
    await expect(mergeCurrent(repo, 'feature', 'merge')).rejects.toThrow(
      /overwritten by merge|commit your changes or stash/i
    )
    // and no merge was started
    expect((await mergeState(repo)).inProgress).toBe(false)
  })
})
