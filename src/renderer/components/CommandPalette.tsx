import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { Icon } from './ui/Icon'

interface Command {
  id: string
  label: string
  hint?: string
  icon: Parameters<typeof Icon>[0]['name']
  run: () => void
}

export function CommandPalette() {
  const store = useStore()
  const { paletteOpen, togglePalette } = store
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      { id: 'open', label: 'Open repository…', icon: 'folder', run: () => store.openDialog() },
      { id: 'clone', label: 'Clone repository…', hint: 'from a URL', icon: 'download', run: () => store.setClone(true) },
      { id: 'history', label: 'Go to History', icon: 'history', run: () => store.setView('history') },
      { id: 'changes', label: 'Go to Changes', icon: 'changes', run: () => store.setView('changes') },
      { id: 'fetch', label: 'Fetch all', hint: 'git fetch --all --prune', icon: 'fetch', run: () => store.fetch() },
      { id: 'pull', label: 'Pull (fast-forward)', icon: 'pull', run: () => store.pull() },
      { id: 'push', label: 'Push', icon: 'push', run: () => store.push() },
      { id: 'refresh', label: 'Refresh', icon: 'refresh', run: () => store.refresh() },
      { id: 'stashes', label: 'Go to Stashes', icon: 'stash', run: () => store.setView('stashes') },
      {
        id: 'stash-save',
        label: 'Stash changes',
        hint: 'save working changes aside',
        icon: 'stash',
        run: async () => {
          store.setView('stashes')
          const msg = await store.promptText({
            title: 'Stash changes',
            message: 'Save your working changes aside. Add an optional note to find it later.',
            placeholder: 'Optional message…',
            allowEmpty: true,
            confirmText: 'Stash'
          })
          if (msg !== null) store.createStash(msg, true)
        }
      },
      { id: 'oplog', label: 'Toggle operation log', icon: 'terminal', run: () => store.toggleDrawer() }
    ]
    if (store.selectedFile) {
      base.push({
        id: 'filehistory',
        label: `File history: ${store.selectedFile.file}`,
        hint: 'log + blame',
        icon: 'history',
        run: () => store.selectedFile && store.openFileHistory(store.selectedFile.file)
      })
    }
    // Branch checkout commands.
    for (const r of store.refs) {
      if (r.type === 'localBranch' && !r.current) {
        base.push({
          id: `co-${r.name}`,
          label: `Checkout ${r.name}`,
          hint: 'branch',
          icon: 'branch',
          run: () => store.checkout(r.name)
        })
      }
    }
    for (const rr of store.recent) {
      base.push({
        id: `recent-${rr.path}`,
        label: `Open ${rr.name}`,
        hint: rr.path,
        icon: 'folder',
        run: () => store.openPath(rr.path)
      })
    }
    return base
  }, [store])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 40)
    return commands
      .filter((c) => (c.label + ' ' + (c.hint ?? '')).toLowerCase().includes(q))
      .slice(0, 40)
  }, [commands, query])

  useEffect(() => {
    if (paletteOpen) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [paletteOpen])

  useEffect(() => setCursor(0), [query])

  if (!paletteOpen) return null

  const exec = (c: Command) => {
    togglePalette(false)
    c.run()
  }

  return (
    <div className="palette-overlay" onClick={() => togglePalette(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Icon name="search" size={16} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Type a command or branch…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(c + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(c - 1, 0))
              } else if (e.key === 'Enter') {
                if (filtered[cursor]) exec(filtered[cursor])
              } else if (e.key === 'Escape') {
                togglePalette(false)
              }
            }}
          />
        </div>
        <div className="palette-list">
          {filtered.map((c, i) => (
            <button
              key={c.id}
              className={`palette-item ${i === cursor ? 'active' : ''}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => exec(c)}
            >
              <Icon name={c.icon} size={15} />
              <span className="palette-label">{c.label}</span>
              {c.hint && <span className="palette-hint mono">{c.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="side-empty">No matching commands.</div>}
        </div>
      </div>
    </div>
  )
}
