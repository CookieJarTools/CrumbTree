export interface PatternSuggestion {
  pattern: string
  label: string
  hint: string
}

function ext(path: string): string {
  const base = path.split('/').pop() ?? path
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1) : ''
}

function basename(path: string): string {
  return path.split('/').pop() ?? path
}

function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/**
 * Given a repo-relative file (or directory) path, produce the ordered set of LFS
 * tracking patterns a user might want — mirroring "just this file / all of this type /
 * files with this name / everything in this folder". Pure and deterministic.
 */
export function suggestPatterns(path: string, isDir = false): PatternSuggestion[] {
  const clean = path.replace(/^\.\//, '').replace(/\/+$/, '')
  if (isDir) {
    const out: PatternSuggestion[] = [
      { pattern: `${clean}/**`, label: 'Everything in this folder', hint: `${clean}/**` }
    ]
    return out
  }

  const e = ext(clean)
  const name = basename(clean)
  const dir = dirname(clean)
  const out: PatternSuggestion[] = []

  out.push({ pattern: clean, label: 'Just this file', hint: clean })
  if (e) {
    out.push({ pattern: `*.${e}`, label: `All .${e} files`, hint: `*.${e}` })
  }
  out.push({ pattern: `**/${name}`, label: 'Files with this name anywhere', hint: `**/${name}` })
  if (dir) {
    out.push({ pattern: `${dir}/**`, label: 'Everything in this folder', hint: `${dir}/**` })
    if (e) {
      out.push({ pattern: `${dir}/*.${e}`, label: `.${e} files in this folder`, hint: `${dir}/*.${e}` })
    }
  }
  return out
}
