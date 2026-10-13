import { execFile, spawn } from 'node:child_process'
import type { OpLogEntry } from '@shared/types'
import {
  parseProgressLine,
  splitProgressChunk,
  type GitProgressEvent
} from '@shared/git-progress'

export interface GitExecResult {
  stdout: string
  stderr: string
  code: number
}

export interface GitExecError extends Error {
  stderr: string
  code: number
}

type OpLogListener = (entry: OpLogEntry) => void

const opLog: OpLogEntry[] = []
const listeners = new Set<OpLogListener>()
let opId = 0
const MAX_LOG = 500

export function onOpLog(listener: OpLogListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getOpLog(): OpLogEntry[] {
  return opLog.slice(-MAX_LOG)
}

function record(entry: OpLogEntry): void {
  opLog.push(entry)
  if (opLog.length > MAX_LOG) opLog.shift()
  for (const l of listeners) l(entry)
}

// ---- Live progress (long-running network ops) ----

type ProgressListener = (p: GitProgressEvent | null) => void
const progressListeners = new Set<ProgressListener>()

/** Subscribe to live progress. A null event means "finished — clear the bar". */
export function onGitProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

function emitProgress(p: GitProgressEvent | null): void {
  for (const l of progressListeners) l(p)
}

/**
 * Run git while streaming its `--progress` output (which git writes to stderr,
 * updating in place with \r). Emits at most one event per phase/percent change so
 * we don't flood IPC. Otherwise behaves like gitExec: never throws on non-zero.
 */
export function gitStream(
  cwd: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv }
): Promise<GitExecResult> {
  const started = Date.now()
  const command = `git ${args.join(' ')}`
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd,
      windowsHide: true,
      env: opts?.env ? { ...process.env, ...opts.env } : undefined
    })

    let stdout = ''
    let stderr = ''
    let pending = ''
    let lastKey = ''

    const consume = (line: string): void => {
      const prog = parseProgressLine(line)
      if (!prog) return
      const key = `${prog.phase}:${prog.percent}`
      if (key === lastKey) return
      lastKey = key
      emitProgress({ ...prog, command })
    }

    child.stdout.on('data', (d) => {
      stdout += String(d)
    })
    child.stderr.on('data', (d) => {
      const s = String(d)
      stderr += s
      pending += s
      const parts = splitProgressChunk(pending)
      // The last piece may be an incomplete line — hold it back.
      pending = parts.pop() ?? ''
      for (const p of parts) consume(p)
    })

    const finish = (code: number): void => {
      if (pending) consume(pending)
      emitProgress(null)
      const entry: OpLogEntry = {
        id: ++opId,
        command,
        cwd,
        code,
        ok: code === 0,
        ms: Date.now() - started,
        at: Date.now(),
        stderr: stderr.trim() || undefined
      }
      record(entry)
      resolve({ stdout, stderr, code })
    }

    child.on('error', () => finish(1))
    child.on('close', (code) => finish(code ?? 0))
  })
}

/** gitStream + throw on non-zero, for mutating network ops. */
export async function gitStreamOrThrow(
  cwd: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv }
): Promise<string> {
  const { stdout, stderr, code } = await gitStream(cwd, args, opts)
  if (code !== 0) {
    const err = new Error(stderr.trim() || `git ${args.join(' ')} failed (exit ${code})`) as GitExecError
    err.stderr = stderr
    err.code = code
    throw err
  }
  return stdout
}

/**
 * Run `git <args>` in `cwd`. Resolves with stdout/stderr/code. Never throws for
 * non-zero exit — callers decide what a failure means (some git commands use
 * exit codes as data). Records every invocation in the operation log.
 */
export function gitExec(
  cwd: string,
  args: string[],
  input?: string,
  opts?: { silent?: boolean; env?: NodeJS.ProcessEnv }
): Promise<GitExecResult> {
  const started = Date.now()
  return new Promise((resolve) => {
    const child = execFile(
      'git',
      args,
      {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        env: opts?.env ? { ...process.env, ...opts.env } : undefined
      },
      (err, stdout, stderr) => {
        const code = err && typeof (err as NodeJS.ErrnoException).code === 'number'
          ? ((err as unknown as { code: number }).code as number)
          : err
            ? 1
            : 0
        if (!opts?.silent) {
          const entry: OpLogEntry = {
            id: ++opId,
            command: `git ${args.join(' ')}`,
            cwd,
            code,
            ok: code === 0,
            ms: Date.now() - started,
            at: Date.now(),
            stderr: stderr?.trim() || undefined
          }
          record(entry)
        }
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', code })
      }
    )
    if (input !== undefined) {
      child.stdin?.write(input)
      child.stdin?.end()
    }
  })
}

/** Run git and throw a GitExecError if it exits non-zero. Use for mutating ops. */
export async function gitOrThrow(cwd: string, args: string[], input?: string): Promise<string> {
  const { stdout, stderr, code } = await gitExec(cwd, args, input)
  if (code !== 0) {
    const err = new Error(stderr.trim() || `git ${args.join(' ')} failed (exit ${code})`) as GitExecError
    err.stderr = stderr
    err.code = code
    throw err
  }
  return stdout
}

/** Detect whether git is installed and return its version string. */
export async function gitVersion(): Promise<string> {
  const { stdout, code } = await gitExec(process.cwd(), ['--version'])
  if (code !== 0) throw new Error('git not found on PATH')
  return stdout.trim().replace(/^git version /, '')
}
