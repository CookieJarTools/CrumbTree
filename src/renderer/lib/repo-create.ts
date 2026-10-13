export interface NameCheck {
  ok: boolean
  error?: string
}

/** Validate a repository name against GitHub's rules. */
export function validateRepoName(name: string): NameCheck {
  const n = name.trim()
  if (!n) return { ok: false, error: 'Give the repository a name.' }
  if (n === '.' || n === '..') return { ok: false, error: 'That name isn’t allowed.' }
  if (!/^[A-Za-z0-9._-]+$/.test(n)) {
    return { ok: false, error: 'Use letters, numbers, dots, dashes or underscores only.' }
  }
  if (n.length > 100) return { ok: false, error: 'That name is too long.' }
  return { ok: true }
}

export type GitignoreKind = 'none' | 'node' | 'unity'

const TEMPLATES: Record<Exclude<GitignoreKind, 'none'>, string> = {
  node: `node_modules/
dist/
out/
build/
*.log
.DS_Store
.env
.env.local
coverage/
`,
  unity: `[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]serSettings/
*.csproj
*.sln
*.user
.DS_Store
`
}

/** Return .gitignore contents for a template kind ('' for none). */
export function gitignoreFor(kind: GitignoreKind): string {
  if (kind === 'none') return ''
  return TEMPLATES[kind]
}
