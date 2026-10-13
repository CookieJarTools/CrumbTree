import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { Favourites, Workspace } from '@shared/types'

interface RecentRepo {
  path: string
  name: string
  openedAt: number
}

const EMPTY_FAVS: Favourites = { repos: [], branches: {}, commits: {} }

interface Schema {
  recentRepos: RecentRepo[]
  lastRepo: string | null
  window: { width: number; height: number; x?: number; y?: number }
  noobMode: boolean
  gitFriend: boolean
  compactMode: boolean
  openRepos: { path: string; name: string }[]
  activeRepo: string | null
  workspaces: Workspace[]
  activeWorkspaceId: string
  favourites: Favourites
  layout: Record<string, number>
  /** GitHub PAT, base64 (safeStorage-encrypted when available). */
  githubToken: string | null
}

const store = new Store<Schema>({
  defaults: {
    recentRepos: [],
    lastRepo: null,
    window: { width: 1280, height: 820 },
    noobMode: false,
    gitFriend: true,
    compactMode: false,
    openRepos: [],
    activeRepo: null,
    workspaces: [],
    activeWorkspaceId: 'default',
    favourites: EMPTY_FAVS,
    layout: {},
    githubToken: null
  }
})

export function getGithubToken(): string | null {
  const stored = store.get('githubToken')
  if (!stored) return null
  try {
    const buf = Buffer.from(stored, 'base64')
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(buf)
    return buf.toString('utf8')
  } catch {
    return null
  }
}

export function setGithubToken(token: string | null): void {
  if (!token) {
    store.set('githubToken', null)
    return
  }
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf8')
  store.set('githubToken', buf.toString('base64'))
}

export function getFavourites(): Favourites {
  return { ...EMPTY_FAVS, ...store.get('favourites') }
}

export function setFavourites(favs: Favourites): void {
  store.set('favourites', favs)
}

export function getLayout(): Record<string, number> {
  return store.get('layout')
}

export function setLayout(layout: Record<string, number>): void {
  store.set('layout', layout)
}

export function getOpenRepos(): { path: string; name: string }[] {
  return store.get('openRepos')
}

export function setOpenRepos(repos: { path: string; name: string }[]): void {
  store.set('openRepos', repos)
}

export function getActiveRepo(): string | null {
  return store.get('activeRepo')
}

export function setActiveRepo(path: string | null): void {
  store.set('activeRepo', path)
}

export function getWorkspaces(): Workspace[] {
  const ws = store.get('workspaces')
  if (ws && ws.length > 0) return ws
  // Migrate: fold any legacy open repos into a single default workspace.
  return [
    { id: 'default', name: 'Default', repos: getOpenRepos(), activeRepo: getActiveRepo() }
  ]
}

export function setWorkspaces(workspaces: Workspace[]): void {
  store.set('workspaces', workspaces)
}

export function getActiveWorkspaceId(): string {
  const id = store.get('activeWorkspaceId')
  const all = getWorkspaces()
  return all.some((w) => w.id === id) ? id : all[0].id
}

export function setActiveWorkspaceId(id: string): void {
  store.set('activeWorkspaceId', id)
}

export function getNoobMode(): boolean {
  return store.get('noobMode')
}

export function setNoobMode(on: boolean): void {
  store.set('noobMode', on)
}

export function getGitFriend(): boolean {
  return store.get('gitFriend')
}

export function setGitFriend(on: boolean): void {
  store.set('gitFriend', on)
}

export function getCompactMode(): boolean {
  return store.get('compactMode')
}

export function setCompactMode(on: boolean): void {
  store.set('compactMode', on)
}

export function getRecentRepos(): RecentRepo[] {
  return store.get('recentRepos').slice(0, 12)
}

export function addRecentRepo(path: string, name: string): void {
  const existing = store.get('recentRepos').filter((r) => r.path !== path)
  existing.unshift({ path, name, openedAt: Date.now() })
  store.set('recentRepos', existing.slice(0, 12))
  store.set('lastRepo', path)
}

export function getLastRepo(): string | null {
  return store.get('lastRepo')
}

export function getWindowBounds(): Schema['window'] {
  return store.get('window')
}

export function setWindowBounds(bounds: Schema['window']): void {
  store.set('window', bounds)
}
