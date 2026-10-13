import type { GitResult } from '@shared/types'
import type { CrumbApi } from '../../preload'

// Resolve window.crumb lazily on each access. In Electron the preload sets it
// before the renderer runs; the browser demo assigns a mock after module load —
// a lazy proxy makes both work without capturing an early (undefined) value.
export const crumb: CrumbApi = new Proxy({} as CrumbApi, {
  get(_target, prop: string) {
    const api = window.crumb as unknown as Record<string, unknown>
    return api[prop]
  }
})

/** Unwrap a GitResult, throwing its error so callers can try/catch + toast. */
export async function unwrap<T>(p: Promise<GitResult<T>>): Promise<T> {
  const res = await p
  if (!res.ok) throw new Error(res.error || 'git operation failed')
  return res.data as T
}
