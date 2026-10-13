import { describe, expect, it } from 'vitest'
import { parseBlame } from './blame-parse'

// Two consecutive lines from commit aaaa, then one from bbbb.
const SAMPLE = `aaaaaaaaaaaa 1 1 2
author Ada Lovelace
author-time 1700000000
summary first change
	line one
aaaaaaaaaaaa 2 2
	line two
bbbbbbbbbbbb 3 3 1
author Bob Builder
author-time 1700000100
summary second change
	line three`

describe('parseBlame', () => {
  it('parses lines with per-commit author/summary, caching repeated commits', () => {
    const b = parseBlame(SAMPLE)
    expect(b).toHaveLength(3)
    expect(b[0]).toMatchObject({ hash: 'aaaaaaaaaaaa', author: 'Ada Lovelace', line: 'line one', startsGroup: true })
    // second line reuses cached metadata and is NOT the start of a new group
    expect(b[1]).toMatchObject({ author: 'Ada Lovelace', summary: 'first change', line: 'line two', startsGroup: false })
    expect(b[2]).toMatchObject({ hash: 'bbbbbbbbbbbb', author: 'Bob Builder', line: 'line three', startsGroup: true })
  })

  it('returns an empty array for empty input', () => {
    expect(parseBlame('')).toEqual([])
  })
})
