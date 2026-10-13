import { writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LfsRule, LfsStatus } from '@shared/types'
import { gitExec, gitOrThrow } from './exec'

const NUL = String.fromCharCode(0)

/** Detect git-lfs and whether this repo already tracks anything with it. */
export async function lfsStatus(cwd: string): Promise<LfsStatus> {
  const ver = await gitExec(cwd, ['lfs', 'version'])
  const installed = ver.code === 0
  const version = installed ? ver.stdout.trim().split(/\s+/)[0]?.replace('git-lfs/', '') ?? ver.stdout.trim() : null
  let initialized = false
  if (installed) {
    // "Set up" = LFS filters are configured for this repo (git lfs install --local),
    // OR the repo already tracks patterns.
    const cfg = await gitExec(cwd, ['config', '--local', '--get', 'filter.lfs.process'])
    if (cfg.code === 0 && cfg.stdout.trim()) initialized = true
    else initialized = (await listLfsRules(cwd)).length > 0
  }
  return { installed, version, initialized }
}

/**
 * List LFS-tracked patterns. Prefer parsing `.gitattributes` directly so the pattern
 * text keeps its EXACT case — `git lfs track` lowercases patterns on case-insensitive
 * filesystems (Windows), which then breaks untracking. Fall back to `git lfs track`.
 */
export async function listLfsRules(cwd: string): Promise<LfsRule[]> {
  const fromFile = parseAttributes(cwd)
  if (fromFile.length) return fromFile

  const res = await gitExec(cwd, ['lfs', 'track'])
  if (res.code === 0 && res.stdout.trim()) {
    const rules: LfsRule[] = []
    for (const raw of res.stdout.split('\n')) {
      const line = raw.trim()
      if (!line || /listing tracked/i.test(line) || /listing excluded/i.test(line)) continue
      const m = line.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
      if (m) rules.push({ pattern: m[1].trim(), source: m[2].trim() })
      else rules.push({ pattern: line })
    }
    return dedupe(rules)
  }
  return []
}

function attributesPath(cwd: string): string {
  return join(cwd, '.gitattributes')
}

/** Parse root .gitattributes for LFS-tracked patterns, preserving exact case. */
function parseAttributes(cwd: string): LfsRule[] {
  const path = attributesPath(cwd)
  if (!existsSync(path)) return []
  try {
    const text = readFileSync(path, 'utf8')
    const rules: LfsRule[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      if (/filter=lfs/.test(trimmed)) {
        rules.push({ pattern: unescapePattern(trimmed.split(/\s+/)[0]), source: '.gitattributes' })
      }
    }
    return dedupe(rules)
  } catch {
    return []
  }
}

// .gitattributes escapes spaces in patterns as "[[:space:]]"; show them normally.
function unescapePattern(p: string): string {
  return p.replace(/\[\[:space:\]\]/g, ' ')
}

function dedupe(rules: LfsRule[]): LfsRule[] {
  const seen = new Set<string>()
  return rules.filter((r) => (seen.has(r.pattern) ? false : (seen.add(r.pattern), true)))
}

/** Files available to build LFS rules from: tracked + untracked (excluding ignored). */
export async function listRepoFiles(cwd: string): Promise<string[]> {
  const out = await gitOrThrow(cwd, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z'
  ])
  const files = out.split(NUL).filter(Boolean)
  return Array.from(new Set(files)).sort((a, b) => a.localeCompare(b))
}

/** Files actually stored in LFS right now. */
export async function lfsTrackedFiles(cwd: string): Promise<string[]> {
  const res = await gitExec(cwd, ['lfs', 'ls-files', '--name-only'])
  if (res.code !== 0) return []
  return res.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
}

/** Initialise Git LFS hooks for this repo (safe to run repeatedly). */
export async function lfsInstall(cwd: string): Promise<void> {
  await gitOrThrow(cwd, ['lfs', 'install', '--local'])
}

export async function trackPattern(cwd: string, pattern: string): Promise<void> {
  // Make sure the repo's LFS hooks exist so tracked files are converted on commit.
  const status = await lfsStatus(cwd)
  if (status.installed && !status.initialized) {
    await gitExec(cwd, ['lfs', 'install', '--local'])
  }
  await gitOrThrow(cwd, ['lfs', 'track', '--', pattern])
}

export async function untrackPattern(cwd: string, pattern: string): Promise<void> {
  // `git lfs untrack` matches the pattern case-sensitively against .gitattributes, which
  // fails when the stored case differs (common on Windows). Edit the file directly:
  // drop any LFS line whose pattern token equals `pattern` case-insensitively.
  const path = attributesPath(cwd)
  if (existsSync(path)) {
    const text = readFileSync(path, 'utf8')
    const want = pattern.trim().toLowerCase()
    const kept: string[] = []
    let removed = false
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      const isLfs = /filter=lfs/.test(trimmed)
      const token = isLfs ? unescapePattern(trimmed.split(/\s+/)[0]).toLowerCase() : ''
      if (isLfs && token === want) {
        removed = true
        continue
      }
      kept.push(line)
    }
    if (removed) {
      const body = kept.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '')
      await writeFile(path, body.trim() ? body : '', 'utf8')
      return
    }
  }
  // Fall back to git-lfs if we couldn't match the line ourselves.
  await gitOrThrow(cwd, ['lfs', 'untrack', '--', pattern])
}
