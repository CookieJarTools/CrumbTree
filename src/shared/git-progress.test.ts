import { describe, expect, it } from 'vitest'
import { parseProgressLine, progressLabel, splitProgressChunk } from './git-progress'

describe('parseProgressLine', () => {
  it('parses a plain counted phase', () => {
    expect(parseProgressLine('Updating files:  52% (451/867)')).toEqual({
      phase: 'Updating files',
      percent: 52,
      current: 451,
      total: 867,
      detail: null,
      done: false
    })
  })

  it('parses a phase with rate detail', () => {
    expect(parseProgressLine('Receiving objects:  45% (1234/2741), 1.20 MiB | 500.00 KiB/s')).toEqual({
      phase: 'Receiving objects',
      percent: 45,
      current: 1234,
      total: 2741,
      detail: '1.20 MiB | 500.00 KiB/s',
      done: false
    })
  })

  it('flags done and strips it from the detail', () => {
    expect(parseProgressLine('Receiving objects: 100% (2741/2741), 5.32 MiB | 2.11 MiB/s, done.')).toEqual({
      phase: 'Receiving objects',
      percent: 100,
      current: 2741,
      total: 2741,
      detail: '5.32 MiB | 2.11 MiB/s',
      done: true
    })
  })

  it('handles a bare done with no detail', () => {
    expect(parseProgressLine('Resolving deltas: 100% (123/123), done.')).toMatchObject({
      phase: 'Resolving deltas',
      percent: 100,
      detail: null,
      done: true
    })
  })

  it('strips a remote: prefix', () => {
    expect(parseProgressLine('remote: Counting objects:  50% (5/10)')).toMatchObject({
      phase: 'Counting objects',
      percent: 50,
      current: 5,
      total: 10
    })
  })

  it('parses git-lfs filtering', () => {
    expect(parseProgressLine('Filtering content:  62% (10/16), 10.04 MiB | 227.00 KiB/s')).toMatchObject({
      phase: 'Filtering content',
      current: 10,
      total: 16
    })
  })

  it('returns null for non-progress output', () => {
    expect(parseProgressLine('')).toBeNull()
    expect(parseProgressLine('fatal: repository not found')).toBeNull()
    expect(parseProgressLine('Enumerating objects: 50, done.')).toBeNull()
    expect(parseProgressLine('To github.com:me/repo.git')).toBeNull()
  })
})

describe('splitProgressChunk', () => {
  it('splits on carriage returns as well as newlines', () => {
    expect(splitProgressChunk('a: 1% (1/2)\rb: 2% (1/2)\nc')).toEqual([
      'a: 1% (1/2)',
      'b: 2% (1/2)',
      'c'
    ])
  })
})

describe('progressLabel', () => {
  it('renders phase and counts', () => {
    expect(
      progressLabel({ phase: 'Updating files', percent: 8, current: 348, total: 4657, detail: null, done: false })
    ).toBe('Updating files — 348/4657')
  })
})
