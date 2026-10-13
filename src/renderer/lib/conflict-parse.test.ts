import { describe, expect, it } from 'vitest'
import { assemble, assembleLines, conflictCount, hasConflicts, parseConflicts } from './conflict-parse'

const TWO_WAY = `line 1
<<<<<<< HEAD
our change
=======
their change
>>>>>>> feature
line 2`

const DIFF3 = `<<<<<<< HEAD
ours
||||||| base
original
=======
theirs
>>>>>>> feature`

describe('parseConflicts', () => {
  it('parses a 2-way conflict into text + conflict + text', () => {
    const segs = parseConflicts(TWO_WAY)
    expect(segs.map((s) => s.type)).toEqual(['text', 'conflict', 'text'])
    expect(conflictCount(segs)).toBe(1)
    const c = segs[1]
    if (c.type !== 'conflict') throw new Error('expected conflict')
    expect(c.ours).toEqual(['our change'])
    expect(c.theirs).toEqual(['their change'])
  })

  it('parses diff3 base', () => {
    const c = parseConflicts(DIFF3)[0]
    if (c.type !== 'conflict') throw new Error('expected conflict')
    expect(c.ours).toEqual(['ours'])
    expect(c.theirs).toEqual(['theirs'])
    expect(c.base).toEqual(['original'])
  })

  it('returns a single text segment when there are no conflicts', () => {
    const segs = parseConflicts('just\ntext')
    expect(segs).toEqual([{ type: 'text', lines: ['just', 'text'] }])
    expect(conflictCount(segs)).toBe(0)
  })
})

describe('assemble', () => {
  const segs = parseConflicts(TWO_WAY)
  it('takes ours / theirs / both', () => {
    expect(assemble(segs, ['ours'])).toBe('line 1\nour change\nline 2')
    expect(assemble(segs, ['theirs'])).toBe('line 1\ntheir change\nline 2')
    expect(assemble(segs, ['both'])).toBe('line 1\nour change\ntheir change\nline 2')
  })
  it('defaults to ours when no choice given', () => {
    expect(assemble(segs, [])).toBe('line 1\nour change\nline 2')
  })
})

describe('assembleLines', () => {
  const segs = parseConflicts(TWO_WAY)
  it('tags context vs. conflict-origin lines', () => {
    expect(assembleLines(segs, ['theirs'])).toEqual([
      { text: 'line 1', origin: 'context' },
      { text: 'their change', origin: 'theirs' },
      { text: 'line 2', origin: 'context' }
    ])
  })
  it('tags both sides for "keep both"', () => {
    const both = assembleLines(segs, ['both']).filter((l) => l.origin !== 'context')
    expect(both).toEqual([
      { text: 'our change', origin: 'ours' },
      { text: 'their change', origin: 'theirs' }
    ])
  })
})

describe('hasConflicts', () => {
  it('detects markers', () => {
    expect(hasConflicts(TWO_WAY)).toBe(true)
    expect(hasConflicts('line 1\nline 2')).toBe(false)
  })
})
