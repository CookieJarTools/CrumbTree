import { describe, expect, it } from 'vitest'
import { gitignoreFor, validateRepoName } from './repo-create'

describe('validateRepoName', () => {
  it('accepts normal names', () => {
    expect(validateRepoName('my-app').ok).toBe(true)
    expect(validateRepoName('Cool_Thing.2').ok).toBe(true)
  })
  it('rejects empty, dot, and illegal characters', () => {
    expect(validateRepoName('  ').ok).toBe(false)
    expect(validateRepoName('.').ok).toBe(false)
    expect(validateRepoName('my repo').ok).toBe(false)
    expect(validateRepoName('a/b').ok).toBe(false)
    expect(validateRepoName('emoji🎨').ok).toBe(false)
  })
})

describe('gitignoreFor', () => {
  it('returns empty for none and content for templates', () => {
    expect(gitignoreFor('none')).toBe('')
    expect(gitignoreFor('node')).toContain('node_modules/')
    expect(gitignoreFor('unity')).toContain('[Ll]ibrary/')
  })
})
