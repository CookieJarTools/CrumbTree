import { execFile, execSync, spawn } from 'node:child_process'
import type { GithubOwners, GithubStatus } from '@shared/types'

interface Exec {
  stdout: string
  stderr: string
  code: number
  missing: boolean
}

/** Run the GitHub CLI. `missing` is true when `gh` isn't installed. */
function gh(args: string[], cwd?: string): Promise<Exec> {
  return new Promise((resolve) => {
    execFile('gh', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as NodeJS.ErrnoException | null
      if (e && e.code === 'ENOENT') {
        resolve({ stdout: '', stderr: '', code: -1, missing: true })
        return
      }
      const code = e && typeof e.code === 'number' ? (e.code as number) : e ? 1 : 0
      resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code, missing: false })
    })
  })
}

/** Pick up PATH changes a fresh install made, without restarting the app (Windows). */
function refreshWindowsPath(): void {
  if (process.platform !== 'win32') return
  try {
    const read = (root: string): string => {
      try {
        const out = execSync(`reg query "${root}" /v Path`, { windowsHide: true }).toString()
        const m = out.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/i)
        return m ? m[1].trim() : ''
      } catch {
        return ''
      }
    }
    const machine = read('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment')
    const user = read('HKCU\\Environment')
    process.env.PATH = [process.env.PATH, machine, user].filter(Boolean).join(';')
  } catch {
    /* best effort */
  }
}

/**
 * Install the GitHub CLI via winget, then refresh PATH so it's usable immediately.
 * Verifies `gh` is callable afterwards (also handles the "already installed" case).
 */
export async function installGh(): Promise<void> {
  const run = await new Promise<{ code: number; out: string; missing: boolean }>((resolve) => {
    execFile(
      'winget',
      [
        'install',
        '--id',
        'GitHub.cli',
        '-e',
        '--source',
        'winget',
        '--accept-package-agreements',
        '--accept-source-agreements'
      ],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 5 * 60 * 1000 },
      (err, stdout, stderr) => {
        const e = err as NodeJS.ErrnoException | null
        resolve({
          code: e && typeof e.code === 'number' ? (e.code as number) : e ? 1 : 0,
          out: `${stdout ?? ''}${stderr ?? ''}`,
          missing: !!e && (e as NodeJS.ErrnoException).code === 'ENOENT'
        })
      }
    )
  })
  if (run.missing) {
    throw new Error('winget isn’t available on this PC. Install the GitHub CLI from https://cli.github.com instead.')
  }
  refreshWindowsPath()
  const present = await new Promise<boolean>((resolve) =>
    execFile('gh', ['--version'], { windowsHide: true }, (e) => resolve(!e))
  )
  if (!present) {
    throw new Error(
      run.out.trim().slice(-300) ||
        'Couldn’t confirm the GitHub CLI installed. You may need to restart CrumbTree.'
    )
  }
}

/** Open a terminal where the user can complete interactive `gh auth login`. */
/**
 * The cmd.exe command line that opens a terminal running `gh auth login`.
 *
 * `start` treats its first argument as the new window's title ONLY when it's
 * quoted; an unquoted one is taken as the program to run. Passing the title as a
 * plain spawn arg meant Node didn't quote it (no spaces), so Windows tried to
 * launch it and popped "Windows cannot find 'GitHub-Sign-In'". Hence the explicit
 * quotes, and windowsVerbatimArguments so Node doesn't re-escape them.
 */
export function winAuthLoginCmd(): string {
  return 'start "GitHub Sign-In" cmd /k gh auth login'
}

export function ghAuthLogin(): void {
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', winAuthLoginCmd()], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        windowsVerbatimArguments: true
      }).unref()
    } else if (process.platform === 'darwin') {
      spawn('osascript', ['-e', 'tell app "Terminal" to do script "gh auth login"'], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    } else {
      spawn('x-terminal-emulator', ['-e', 'gh auth login'], { detached: true, stdio: 'ignore' }).unref()
    }
  } catch {
    /* best effort */
  }
}

/** Is the GitHub CLI installed and logged in? */
export async function ghStatus(): Promise<GithubStatus> {
  const who = await gh(['api', 'user', '--jq', '.login'])
  if (who.missing) return { connected: false, login: null, reason: 'no-cli' }
  if (who.code !== 0) return { connected: false, login: null, reason: 'not-authed' }
  return { connected: true, login: who.stdout.trim() }
}

export async function ghOwners(): Promise<GithubOwners> {
  const me = await gh(['api', 'user', '--jq', '.login'])
  if (me.missing) throw new Error('GitHub CLI (gh) isn’t installed.')
  if (me.code !== 0) throw new Error('Not logged in — run `gh auth login`.')
  const user = me.stdout.trim()
  const orgsRes = await gh(['api', 'user/orgs', '--jq', '.[].login'])
  const orgs = orgsRes.code === 0 ? orgsRes.stdout.split('\n').map((l) => l.trim()).filter(Boolean) : []
  return { user, orgs }
}

/** Create a repo via `gh repo create` and return its SSH URL for pushing. */
export async function ghCreateRepo(opts: {
  owner: string
  name: string
  description: string
  isPrivate: boolean
}): Promise<{ sshUrl: string }> {
  const args = ['repo', 'create', `${opts.owner}/${opts.name}`, opts.isPrivate ? '--private' : '--public']
  if (opts.description) args.push('--description', opts.description)
  const res = await gh(args)
  if (res.missing) throw new Error('GitHub CLI (gh) isn’t installed. Install it and run `gh auth login`.')
  if (res.code !== 0) {
    const msg = res.stderr.trim()
    if (/already exists/i.test(msg)) throw new Error(`A repository named “${opts.name}” already exists.`)
    if (/auth/i.test(msg)) throw new Error('Not logged in to GitHub — run `gh auth login`.')
    throw new Error(msg || 'gh repo create failed.')
  }
  return { sshUrl: `git@github.com:${opts.owner}/${opts.name}.git` }
}

/**
 * Open a pull request for the current branch via `gh pr create --fill`. Returns the
 * PR URL. If a PR already exists, returns its URL instead of erroring.
 */
export async function ghCreatePr(cwd: string, base: string, head: string): Promise<{ url: string }> {
  const res = await gh(['pr', 'create', '--base', base, '--head', head, '--fill'], cwd)
  if (res.missing) throw new Error('GitHub CLI (gh) isn’t installed — needed to open a pull request.')
  if (res.code === 0) {
    const url = res.stdout.trim().split('\n').pop() ?? ''
    return { url }
  }
  const msg = res.stderr.trim()
  if (/already exists/i.test(msg)) {
    // A PR is already open for this branch — return its URL.
    const view = await gh(['pr', 'view', head, '--json', 'url', '--jq', '.url'], cwd)
    if (view.code === 0 && view.stdout.trim()) return { url: view.stdout.trim() }
    return { url: '' }
  }
  if (/no commits between/i.test(msg)) throw new Error('There’s nothing new to review yet — save some work first.')
  if (/auth/i.test(msg)) throw new Error('Not logged in to GitHub — run `gh auth login`.')
  throw new Error(msg || 'Couldn’t open a pull request.')
}
