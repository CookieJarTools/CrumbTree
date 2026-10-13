import { describe, expect, it } from 'vitest'
import { looksLikeGitUrl, repoNameFromUrl } from './clone-url'

describe('looksLikeGitUrl', () => {
  it('accepts common remote forms', () => {
    expect(looksLikeGitUrl('https://github.com/owner/repo.git')).toBe(true)
    expect(looksLikeGitUrl('https://github.com/owner/repo')).toBe(true)
    expect(looksLikeGitUrl('git@github.com:owner/repo.git')).toBe(true)
    expect(looksLikeGitUrl('ssh://git@host.com/owner/repo.git')).toBe(true)
    expect(looksLikeGitUrl('  https://gitlab.com/a/b/c.git  ')).toBe(true)
  })

  it('rejects non-URLs and prose', () => {
    expect(looksLikeGitUrl('')).toBe(false)
    expect(looksLikeGitUrl('just some copied text')).toBe(false)
    expect(looksLikeGitUrl('https://github.com')).toBe(false) // no repo path
    expect(looksLikeGitUrl('C:\\Users\\me\\notes.txt')).toBe(false)
  })
})

describe('repoNameFromUrl', () => {
  it('derives the folder name', () => {
    expect(repoNameFromUrl('https://github.com/owner/repo.git')).toBe('repo')
    expect(repoNameFromUrl('https://github.com/owner/repo')).toBe('repo')
    expect(repoNameFromUrl('git@github.com:owner/my-cool-repo.git')).toBe('my-cool-repo')
    expect(repoNameFromUrl('ssh://git@host/team/Service.API.git')).toBe('Service.API')
    expect(repoNameFromUrl('https://github.com/owner/repo/')).toBe('repo')
  })

  it('returns empty for junk', () => {
    expect(repoNameFromUrl('')).toBe('')
    expect(repoNameFromUrl('   ')).toBe('')
  })
})
