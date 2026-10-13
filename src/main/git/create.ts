import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { RepoCreateOptions, RepoInfo } from '@shared/types'
import { gitExec, gitOrThrow } from './exec'
import { isRepo, openRepo } from './repo'

const GITIGNORES: Record<'node' | 'unity', string> = {
  node: 'node_modules/\ndist/\nout/\nbuild/\n*.log\n.DS_Store\n.env\n.env.local\ncoverage/\n',
  unity:
    '[Ll]ibrary/\n[Tt]emp/\n[Oo]bj/\n[Bb]uild/\n[Bb]uilds/\n[Ll]ogs/\n[Uu]serSettings/\n*.csproj\n*.sln\n*.user\n.DS_Store\n'
}

/**
 * Create a repository from a folder: git init (if needed), optional README/.gitignore,
 * first commit, then optionally add an SSH remote and push over the user's SSH key.
 * `sshUrl` comes from `gh repo create`. Returns the opened repo.
 */
export async function createRepo(
  opts: RepoCreateOptions,
  sshUrl: string | null
): Promise<RepoInfo> {
  const path = opts.folder

  if (!(await isRepo(path))) {
    await gitOrThrow(path, ['init', '-b', 'main'])
  }

  if (opts.addReadme && !existsSync(join(path, 'README.md'))) {
    const body = `# ${opts.name}\n\n${opts.description || ''}\n`.trimEnd() + '\n'
    await writeFile(join(path, 'README.md'), body, 'utf8')
  }
  if (opts.gitignore !== 'none' && !existsSync(join(path, '.gitignore'))) {
    await writeFile(join(path, '.gitignore'), GITIGNORES[opts.gitignore], 'utf8')
  }

  // Stage everything and make the first commit (only if there is something to commit).
  await gitOrThrow(path, ['add', '-A'])
  const staged = await gitExec(path, ['diff', '--cached', '--quiet'])
  if (staged.code !== 0) {
    await gitOrThrow(path, ['commit', '-m', 'Initial commit'])
  } else {
    // Empty folder: create an empty root commit so the branch exists to push.
    await gitOrThrow(path, ['commit', '--allow-empty', '-m', 'Initial commit'])
  }

  if (opts.publish && sshUrl) {
    const existing = await gitExec(path, ['remote'])
    if (!existing.stdout.split('\n').includes('origin')) {
      await gitOrThrow(path, ['remote', 'add', 'origin', sshUrl])
    } else {
      await gitOrThrow(path, ['remote', 'set-url', 'origin', sshUrl])
    }
    // Push over SSH — uses the user's key/agent; no secrets involved.
    const push = await gitExec(path, ['push', '-u', 'origin', 'main'])
    if (push.code !== 0) {
      throw new Error(
        push.stderr.trim() ||
          'Created the repo, but the SSH push failed. Check your SSH key is set up with GitHub.'
      )
    }
  }

  return openRepo(path)
}
