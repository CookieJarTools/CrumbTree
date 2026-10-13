export interface ParsedCommand {
  ok: boolean
  args?: string[]
  error?: string
}

/**
 * Parse a typed terminal line into git arguments. Quote-aware split; a leading
 * `git` token is stripped. The result is always run as `git <args>` via execFile
 * (no shell), so shell metacharacters are harmless literals — we only reject empty
 * input and unbalanced quotes. Pure — unit-tested.
 */
export function parseGitCommand(line: string): ParsedCommand {
  const trimmed = line.trim()
  if (!trimmed) return { ok: false, error: 'Type a git command.' }

  const tokens = tokenize(trimmed)
  if (!tokens) return { ok: false, error: 'Unbalanced quotes.' }

  let args = tokens
  if (args[0]?.toLowerCase() === 'git') args = args.slice(1)
  if (args.length === 0) return { ok: false, error: 'Type a git subcommand, e.g. status.' }

  return { ok: true, args }
}

function tokenize(input: string): string[] | null {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let has = false
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quote) {
      if (c === quote) quote = null
      else cur += c
    } else if (c === '"' || c === "'") {
      quote = c
      has = true
    } else if (c === ' ' || c === '\t') {
      if (has || cur) {
        out.push(cur)
        cur = ''
        has = false
      }
    } else {
      cur += c
      has = true
    }
  }
  if (quote) return null
  if (has || cur) out.push(cur)
  return out
}
