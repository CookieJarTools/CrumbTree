import { describe, expect, it } from 'vitest'
import { suggestPatterns } from './lfs-suggest'
import { sanitizeBranchName } from './branchname'

describe('suggestPatterns', () => {
  it('offers file / type / name / folder options for a nested file', () => {
    const s = suggestPatterns('art/textures/wood.psd')
    const patterns = s.map((p) => p.pattern)
    expect(patterns).toContain('art/textures/wood.psd') // just this file
    expect(patterns).toContain('*.psd') // all of this type
    expect(patterns).toContain('**/wood.psd') // this name anywhere
    expect(patterns).toContain('art/textures/**') // this folder
    expect(patterns).toContain('art/textures/*.psd') // type in this folder
  })

  it('handles a root-level file with no directory', () => {
    const patterns = suggestPatterns('logo.png').map((p) => p.pattern)
    expect(patterns).toContain('logo.png')
    expect(patterns).toContain('*.png')
    expect(patterns).toContain('**/logo.png')
    expect(patterns).not.toContain('/**')
  })

  it('handles a file with no extension', () => {
    const patterns = suggestPatterns('bin/tool').map((p) => p.pattern)
    expect(patterns).toContain('bin/tool')
    expect(patterns).toContain('**/tool')
    expect(patterns).toContain('bin/**')
    expect(patterns.some((p) => p.startsWith('*.'))).toBe(false)
  })

  it('offers a single folder glob for directories', () => {
    const s = suggestPatterns('assets/models', true)
    expect(s).toHaveLength(1)
    expect(s[0].pattern).toBe('assets/models/**')
  })
})

describe('sanitizeBranchName', () => {
  it('slugifies spaces and case', () => {
    expect(sanitizeBranchName('My New Feature')).toBe('my-new-feature')
  })
  it('strips illegal characters and emoji', () => {
    expect(sanitizeBranchName('fix: the thing?? 🎨')).toBe('fix-the-thing')
  })
  it('collapses separators and trims edges', () => {
    expect(sanitizeBranchName('--hello///world--')).toBe('hello/world')
  })
  it('returns empty for unusable input', () => {
    expect(sanitizeBranchName('   !!!   ')).toBe('')
  })
})
