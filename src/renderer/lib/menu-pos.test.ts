import { describe, expect, it } from 'vitest'
import { clampMenuPosition } from './menu-pos'

describe('clampMenuPosition', () => {
  const VW = 1000
  const VH = 800

  it('leaves a menu that fits where it is', () => {
    expect(clampMenuPosition(100, 100, 200, 300, VW, VH)).toEqual({ x: 100, y: 100 })
  })

  it('flips back from the right edge', () => {
    const p = clampMenuPosition(950, 100, 200, 300, VW, VH)
    expect(p.x).toBe(VW - 200 - 6)
    expect(p.y).toBe(100)
  })

  it('flips back from the bottom edge', () => {
    const p = clampMenuPosition(100, 780, 200, 300, VW, VH)
    expect(p.y).toBe(VH - 300 - 6)
  })

  it('never returns a negative origin for an oversized menu', () => {
    const p = clampMenuPosition(10, 10, 2000, 2000, VW, VH)
    expect(p.x).toBeGreaterThanOrEqual(6)
    expect(p.y).toBeGreaterThanOrEqual(6)
  })
})
