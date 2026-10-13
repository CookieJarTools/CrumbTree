import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { FileChangeType, FileStatus } from '@shared/types'
import {
  buildFileTree,
  flattenTree,
  treeFilePaths,
  type FlatRow,
  type TreeFolderNode
} from '@shared/file-tree'
import { useStore, type MenuItem } from '../store/store'
import { Icon } from './ui/Icon'

const TYPE_MARK: Record<FileChangeType, { m: string; cls: string }> = {
  added: { m: 'A', cls: 'add' },
  modified: { m: 'M', cls: 'mod' },
  deleted: { m: 'D', cls: 'del' },
  renamed: { m: 'R', cls: 'mod' },
  untracked: { m: 'U', cls: 'add' },
  conflicted: { m: '!', cls: 'confl' }
}

function FileRow({
  f,
  staged,
  label,
  depth,
  active,
  selected,
  onClick,
  onContextMenu,
  onToggle,
  onDiscard
}: {
  f: FileStatus
  staged: boolean
  label: string
  depth: number
  active: boolean
  selected: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  onToggle: () => void
  onDiscard?: () => void
}) {
  const t = TYPE_MARK[f.type]
  return (
    <div
      className={`file-row stage ${active ? 'active' : ''} ${selected ? 'selected' : ''}`}
      style={{ paddingLeft: 4 + depth * 14 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={f.path}
    >
      <button
        className="stage-toggle"
        onClick={(e) => (e.stopPropagation(), onToggle())}
        title={staged ? 'Unstage' : 'Stage'}
      >
        <Icon name={staged ? 'minus' : 'plus'} size={13} />
      </button>
      <span className={`ft ${t.cls}`}>{t.m}</span>
      <span className="file-path">{label}</span>
      {onDiscard && (
        <button
          className="discard-btn"
          onClick={(e) => (e.stopPropagation(), onDiscard())}
          title="Discard changes"
        >
          <Icon name="undo" size={12} />
        </button>
      )}
    </div>
  )
}

function FolderRow({
  name,
  depth,
  collapsed,
  onToggle,
  onContextMenu
}: {
  name: string
  depth: number
  collapsed: boolean
  onToggle: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className="tree-folder"
      style={{ paddingLeft: 4 + depth * 14 }}
      onClick={onToggle}
      onContextMenu={onContextMenu}
      title={name}
    >
      <Icon name="chevron" size={12} className={`tree-caret ${collapsed ? '' : 'open'}`} />
      <Icon name="folder" size={13} className="tree-folder-icon" />
      <span className="tree-folder-name">{name}</span>
    </div>
  )
}

type Section = 'u' | 's'

export function StagingPanel() {
  const s = useStore(
    useShallow((st) => ({
      status: st.status,
      stage: st.stage,
      unstage: st.unstage,
      discard: st.discard,
      commit: st.commit,
      stageMany: st.stageMany,
      unstageMany: st.unstageMany,
      discardMany: st.discardMany,
      createStash: st.createStash,
      promptText: st.promptText,
      openMenu: st.openMenu,
      selectWorkingFile: st.selectWorkingFile,
      selectedFile: st.selectedFile,
      copy: st.copy,
      openFileHistory: st.openFileHistory,
      busy: st.busy
    }))
  )
  const [message, setMessage] = useState('')
  const [amend, setAmend] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<number | null>(null)
  const [mode, setMode] = useState<'list' | 'tree'>(() =>
    localStorage.getItem('crumb.filesView') === 'tree' ? 'tree' : 'list'
  )
  // Collapsed folders, keyed "<section>:<path>" so the two lists collapse independently.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const setViewMode = (m: 'list' | 'tree'): void => {
    setMode(m)
    localStorage.setItem('crumb.filesView', m)
  }

  const q = query.trim().toLowerCase()
  const status = s.status
  const match = (f: FileStatus): boolean => !q || f.path.toLowerCase().includes(q)
  const staged = useMemo(() => (status?.staged ?? []).filter(match), [status, q])
  const unstaged = useMemo(
    () => [...(status?.conflicted ?? []), ...(status?.unstaged ?? [])].filter(match),
    [status, q]
  )

  const uTree = useMemo(() => buildFileTree(unstaged), [unstaged])
  const sTree = useMemo(() => buildFileTree(staged), [staged])
  const collapsedFor = (sec: Section) =>
    new Set([...collapsed].filter((k) => k[0] === sec).map((k) => k.slice(2)))

  // The rows each section renders — a flat file list, or the flattened folder tree.
  const asFileRow = (f: FileStatus): FlatRow<FileStatus> => ({
    node: { type: 'file', name: f.path, path: f.path, item: f },
    depth: 0
  })
  const uRows =
    mode === 'tree' ? flattenTree(uTree, collapsedFor('u')) : unstaged.map(asFileRow)
  const sRows = mode === 'tree' ? flattenTree(sTree, collapsedFor('s')) : staged.map(asFileRow)

  // Ordered axis of visible files (unstaged then staged) for shift-range + indexing.
  const fileEntries: { path: string; staged: boolean; node: object; f: FileStatus }[] = []
  for (const r of uRows)
    if (r.node.type === 'file') fileEntries.push({ path: r.node.path, staged: false, node: r.node, f: r.node.item })
  for (const r of sRows)
    if (r.node.type === 'file') fileEntries.push({ path: r.node.path, staged: true, node: r.node, f: r.node.item })
  const orderedPaths = fileEntries.map((e) => e.path)
  const nodeIndex = new Map<object, number>()
  fileEntries.forEach((e, i) => nodeIndex.set(e.node, i))
  const selectedPaths = useMemo(
    () => [...new Set(orderedPaths.filter((p) => selected.has(p)))],
    [orderedPaths, selected]
  )
  const selCount = selectedPaths.length

  if (!status) return <div className="detail-empty">No repository open.</div>

  const canCommit = status.staged.length > 0 && message.trim().length > 0
  const dirty = status.staged.length + status.unstaged.length + status.conflicted.length > 0

  const stageAll = (): Promise<void> => s.stageMany(unstaged.map((f) => f.path))
  const unstageAll = (): Promise<void> => s.unstageMany(staged.map((f) => f.path))
  const clearSelection = (): void => {
    setSelected(new Set())
    setAnchor(null)
  }
  const toggleFolder = (sec: Section, path: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      const k = `${sec}:${path}`
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const onRowClick = (index: number, e: React.MouseEvent): void => {
    const path = orderedPaths[index]
    if (e.shiftKey && anchor !== null) {
      e.preventDefault()
      const lo = Math.min(anchor, index)
      const hi = Math.max(anchor, index)
      setSelected(new Set(orderedPaths.slice(lo, hi + 1)))
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(path)) next.delete(path)
        else next.add(path)
        return next
      })
      setAnchor(index)
    } else {
      setSelected(new Set([path]))
      setAnchor(index)
      s.selectWorkingFile(path, fileEntries[index].staged)
    }
  }

  const doDiscard = (f: FileStatus): void => {
    if (confirm(`Discard changes to ${f.path}? This cannot be undone.`)) s.discard(f.path)
  }
  const discardMany = (paths: string[]): void => {
    if (confirm(`Discard changes to ${paths.length} files? This cannot be undone.`)) {
      s.discardMany(paths)
      clearSelection()
    }
  }

  const stashPaths = async (paths: string[]): Promise<void> => {
    const many = paths.length > 1
    const note = await s.promptText({
      title: many ? `Stash ${paths.length} files` : 'Stash changes',
      message: many
        ? `Puts these ${paths.length} files aside so your working tree is clean. Bring them back any time from Stashes.`
        : 'Puts all your current changes aside so you have a clean working tree. Bring them back any time from Stashes.',
      placeholder: 'Optional message…',
      allowEmpty: true,
      initial: message.trim(),
      confirmText: 'Stash'
    })
    if (note === null) return
    await s.createStash(note, true, paths.length > 0 ? paths : undefined)
    clearSelection()
    setMessage('')
  }

  const onRowContextMenu = (index: number, e: React.MouseEvent): void => {
    e.preventDefault()
    const entry = fileEntries[index]
    const path = entry.path
    let targets = selectedPaths
    if (!selected.has(path)) {
      setSelected(new Set([path]))
      setAnchor(index)
      targets = [path]
    }
    const multi = targets.length > 1

    const items: MenuItem[] = multi
      ? [
          { label: `Stash ${targets.length} files`, icon: 'stash', onSelect: () => stashPaths(targets) },
          { label: `Stage ${targets.length} files`, icon: 'plus', onSelect: () => s.stageMany(targets) },
          {
            label: `Discard ${targets.length} files`,
            icon: 'undo',
            danger: true,
            onSelect: () => discardMany(targets)
          },
          { type: 'divider' },
          { label: 'Copy paths', icon: 'copy', onSelect: () => s.copy(targets.join('\n'), 'paths') }
        ]
      : [
          {
            label: entry.staged ? 'Unstage' : 'Stage',
            icon: entry.staged ? 'minus' : 'plus',
            onSelect: () => (entry.staged ? s.unstage(path) : s.stage(path))
          },
          { label: 'Stash this file', icon: 'stash', onSelect: () => stashPaths([path]) },
          ...(!entry.staged
            ? [{ label: 'Discard changes', icon: 'undo' as const, danger: true, onSelect: () => doDiscard(entry.f) }]
            : []),
          { type: 'divider' as const },
          { label: 'View file history', icon: 'history', onSelect: () => s.openFileHistory(path) },
          { label: 'Copy path', icon: 'copy', onSelect: () => s.copy(path, 'path') }
        ]
    s.openMenu(e.clientX, e.clientY, items)
  }

  // Right-clicking a folder acts on every file beneath it.
  const onFolderContextMenu = (
    node: TreeFolderNode<FileStatus>,
    sectionStaged: boolean,
    e: React.MouseEvent
  ): void => {
    e.preventDefault()
    const paths = treeFilePaths([node])
    const items: MenuItem[] = sectionStaged
      ? [{ label: `Unstage folder (${paths.length})`, icon: 'minus', onSelect: () => s.unstageMany(paths) }]
      : [
          { label: `Stage folder (${paths.length})`, icon: 'plus', onSelect: () => s.stageMany(paths) },
          { label: `Stash folder (${paths.length})`, icon: 'stash', onSelect: () => stashPaths(paths) },
          {
            label: `Discard folder (${paths.length})`,
            icon: 'undo',
            danger: true,
            onSelect: () => discardMany(paths)
          }
        ]
    items.push(
      { type: 'divider' },
      { label: 'Copy folder path', icon: 'copy', onSelect: () => s.copy(node.path, 'path') }
    )
    s.openMenu(e.clientX, e.clientY, items)
  }

  const onCommit = async (): Promise<void> => {
    if (!canCommit) return
    await s.commit(message.trim(), amend)
    setMessage('')
    setAmend(false)
  }

  const activePath = (p: string, st: boolean): boolean =>
    s.selectedFile?.file === p && s.selectedFile?.staged === st && !s.selectedFile?.commitHash

  const renderRows = (rows: FlatRow<FileStatus>[], sectionStaged: boolean): React.ReactNode[] => {
    const sec: Section = sectionStaged ? 's' : 'u'
    return rows.map((r) => {
      if (r.node.type === 'folder') {
        return (
          <FolderRow
            key={`fold-${sec}-${r.node.path}`}
            name={r.node.name}
            depth={r.depth}
            collapsed={collapsed.has(`${sec}:${r.node.path}`)}
            onToggle={() => toggleFolder(sec, r.node.path)}
            onContextMenu={(e) => onFolderContextMenu(r.node as TreeFolderNode<FileStatus>, sectionStaged, e)}
          />
        )
      }
      const f = r.node.item
      const idx = nodeIndex.get(r.node)!
      const label =
        mode === 'tree' ? r.node.name : f.oldPath ? `${f.oldPath} → ${f.path}` : f.path
      return (
        <FileRow
          key={`${sec}-${f.path}`}
          f={f}
          staged={sectionStaged}
          label={label}
          depth={mode === 'tree' ? r.depth : 0}
          active={activePath(f.path, sectionStaged)}
          selected={selected.has(f.path)}
          onClick={(e) => onRowClick(idx, e)}
          onContextMenu={(e) => onRowContextMenu(idx, e)}
          onToggle={() => (sectionStaged ? s.unstage(f.path) : s.stage(f.path))}
          onDiscard={sectionStaged ? undefined : () => doDiscard(f)}
        />
      )
    })
  }

  return (
    <div className="staging-panel">
      <div className="stage-search">
        <Icon name="search" size={13} />
        <input value={query} placeholder="Filter files…" onChange={(e) => setQuery(e.target.value)} />
        {query && (
          <button className="side-search-clear" onClick={() => setQuery('')} title="Clear">
            <Icon name="close" size={12} />
          </button>
        )}
        <div className="seg view-seg">
          <button
            className={mode === 'list' ? 'on' : ''}
            onClick={() => setViewMode('list')}
            title="Flat list"
          >
            <Icon name="list" size={14} />
          </button>
          <button
            className={mode === 'tree' ? 'on' : ''}
            onClick={() => setViewMode('tree')}
            title="Folder tree"
          >
            <Icon name="tree" size={14} />
          </button>
        </div>
      </div>

      {selCount > 0 && (
        <div className="stage-selbar">
          <span>
            {selCount} selected
            <span className="stage-selhint"> · shift-click a range, ctrl-click to toggle</span>
          </span>
          <div className="topbar-spacer" />
          <button className="mini-btn" onClick={() => stashPaths(selectedPaths)}>
            Stash these
          </button>
          <button className="mini-btn" onClick={clearSelection}>
            Clear
          </button>
        </div>
      )}

      <div className="stage-section">
        <div className="stage-head">
          <span>Unstaged</span>
          <span className="side-count">{unstaged.length}</span>
          {unstaged.length > 0 && (
            <button className="mini-btn" onClick={stageAll}>
              Stage all
            </button>
          )}
        </div>
        <div className="stage-list">
          {renderRows(uRows, false)}
          {unstaged.length === 0 && <div className="side-empty">Nothing to stage.</div>}
        </div>
      </div>

      <div className="stage-section">
        <div className="stage-head">
          <span>Staged</span>
          <span className="side-count">{staged.length}</span>
          {staged.length > 0 && (
            <button className="mini-btn" onClick={unstageAll}>
              Unstage all
            </button>
          )}
        </div>
        <div className="stage-list">
          {renderRows(sRows, true)}
          {staged.length === 0 && <div className="side-empty">Nothing staged.</div>}
        </div>
      </div>

      <div className="commit-box">
        <textarea
          className="commit-msg"
          placeholder="Commit message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onCommit()
          }}
        />
        <div className="commit-actions">
          <label className="amend-check">
            <input type="checkbox" checked={amend} onChange={(e) => setAmend(e.target.checked)} />
            Amend
          </label>
          <button
            className="stash-btn"
            disabled={!dirty || !!s.busy}
            onClick={() => stashPaths(selectedPaths)}
            title={
              selCount > 0
                ? `Stash the ${selCount} selected file${selCount === 1 ? '' : 's'}`
                : dirty
                  ? 'Put all your changes aside for later'
                  : 'Nothing to stash'
            }
          >
            <Icon name="stash" size={13} />
            Stash{selCount > 0 ? ` (${selCount})` : ''}
          </button>
          <button className="commit-btn" disabled={!canCommit} onClick={onCommit}>
            <Icon name="check" size={14} />
            Commit {staged.length > 0 ? `(${staged.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
