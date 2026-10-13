import { describe, expect, it } from 'vitest'
import type { Commit } from '@shared/types'
import { computeGraph, maxLaneCount, reachableFrom } from './layout'

/** Build a Commit with sensible defaults. */
function c(hash: string, parents: string[] = []): Commit {
  return {
    hash,
    parents,
    authorName: 'Test',
    authorEmail: 't@example.com',
    timestamp: 0,
    subject: hash,
    refs: []
  }
}

describe('computeGraph', () => {
  it('places a linear history in a single lane', () => {
    // newest first: C <- B <- A
    const rows = computeGraph([c('C', ['B']), c('B', ['A']), c('A', [])])
    expect(rows.map((r) => r.lane)).toEqual([0, 0, 0])
    expect(maxLaneCount(rows)).toBe(1)
    // Every non-root row continues straight down.
    expect(rows[0].edges.some((e) => !e.fromTop && e.toBottom && e.toLane === 0)).toBe(true)
    // Root has no outgoing (down) parent edge.
    expect(rows[2].edges.some((e) => !e.fromTop && e.toBottom)).toBe(false)
  })

  it('branches a feature line into a second lane and merges back', () => {
    // R root; A on main; B on feature; M merges A (first parent) and B.
    // date-order newest-first: M, A, B, R
    const rows = computeGraph([
      c('M', ['A', 'B']),
      c('A', ['R']),
      c('B', ['R']),
      c('R', [])
    ])
    const byHash = Object.fromEntries(rows.map((r) => [r.commit.hash, r]))

    // Merge commit sits in lane 0 and fans out to two parents.
    expect(byHash.M.lane).toBe(0)
    const mOut = byHash.M.edges.filter((e) => !e.fromTop && e.toBottom)
    expect(mOut).toHaveLength(2)
    expect(new Set(mOut.map((e) => e.toLane))).toEqual(new Set([0, 1]))

    // First parent keeps lane 0, feature parent takes lane 1.
    expect(byHash.A.lane).toBe(0)
    expect(byHash.B.lane).toBe(1)

    // Two lanes are used at the widest point.
    expect(maxLaneCount(rows)).toBe(2)

    // Root collects both lanes (a merge edge into its node) and terminates.
    const rMergeEdges = byHash.R.edges.filter((e) => e.fromTop && !e.toBottom && e.toLane === byHash.R.lane)
    expect(rMergeEdges.length).toBeGreaterThanOrEqual(1)
    expect(byHash.R.edges.some((e) => !e.fromTop && e.toBottom)).toBe(false)
  })

  it('keeps colours stable along the first-parent line', () => {
    const rows = computeGraph([c('C', ['B']), c('B', ['A']), c('A', [])])
    const colors = new Set(rows.map((r) => r.color))
    expect(colors.size).toBe(1)
  })

  it('handles an octopus merge (3 parents)', () => {
    const rows = computeGraph([
      c('O', ['A', 'B', 'D']),
      c('A', ['R']),
      c('B', ['R']),
      c('D', ['R']),
      c('R', [])
    ])
    const o = rows[0]
    const out = o.edges.filter((e) => !e.fromTop && e.toBottom)
    expect(out).toHaveLength(3)
    expect(maxLaneCount(rows)).toBe(3)
  })

  it('never emits a negative or NaN lane', () => {
    const rows = computeGraph([
      c('M', ['A', 'B']),
      c('A', ['R']),
      c('B', ['R']),
      c('R', [])
    ])
    for (const r of rows) {
      expect(Number.isInteger(r.lane)).toBe(true)
      expect(r.lane).toBeGreaterThanOrEqual(0)
      for (const e of r.edges) {
        expect(e.fromLane).toBeGreaterThanOrEqual(0)
        expect(e.toLane).toBeGreaterThanOrEqual(0)
      }
    }
  })
})

describe('reachableFrom', () => {
  // F (feature tip) and M (main tip) both branch from B.
  //   F -> B, M -> B, B -> A
  const rows = computeGraph([c('F1', ['B1']), c('M1', ['B1']), c('B1', ['A1']), c('A1')])

  it('collects the checked-out branch history and nothing else', () => {
    expect(reachableFrom(rows, 'M1')).toEqual(new Set(['M1', 'B1', 'A1']))
  })

  it('accepts an abbreviated hash', () => {
    expect(reachableFrom(rows, 'F')).toEqual(new Set(['F1', 'B1', 'A1']))
  })

  it('is empty when HEAD is unknown', () => {
    expect(reachableFrom(rows, null).size).toBe(0)
    expect(reachableFrom(rows, 'zzz').size).toBe(0)
  })

  it('tags each edge with the child it descends from', () => {
    const m = rows.find((r) => r.commit.hash === 'M1')!
    // F's line passes through M's row on its way to B.
    const pass = m.edges.find((e) => e.fromTop && e.toBottom)!
    expect(pass.from).toEqual(['F1'])
    expect(m.edges.find((e) => !e.fromTop)!.from).toEqual(['M1'])
  })
})
