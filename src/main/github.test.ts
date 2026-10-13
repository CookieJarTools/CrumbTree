import { describe, expect, it } from 'vitest'
import { winAuthLoginCmd } from './github'

describe('winAuthLoginCmd', () => {
  const cmd = winAuthLoginCmd()

  it('quotes the window title', () => {
    // An unquoted title is taken by `start` as the program to run, which is what
    // produced "Windows cannot find 'GitHub-Sign-In'".
    expect(cmd).toMatch(/^start\s+"[^"]+"\s/)
  })

  it('runs gh auth login in a terminal that stays open', () => {
    expect(cmd).toContain('cmd /k gh auth login')
  })

  it('puts the program after the title, not before it', () => {
    const titleEnd = cmd.indexOf('"', cmd.indexOf('"') + 1)
    expect(cmd.indexOf('cmd /k')).toBeGreaterThan(titleEnd)
  })
})
