import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Ref } from '@shared/types'
import { useStore, type MenuItem } from '../store/store'
import { filterRefs } from '../lib/search'
import { isBaseBranch } from '../lib/refs'
import { useSize } from './Resizer'
import { Icon } from './ui/Icon'

function SectionLabel({
  children,
  count,
  className = ''
}: {
  children: string
  count?: number
  className?: string
}) {
  return (
    <div className={`side-label ${className}`}>
      <span>{children}</span>
      {count !== undefined && <span className="side-count">{count}</span>}
    </div>
  )
}

function NavItem({
  icon,
  label,
  active,
  badge,
  onClick
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  active?: boolean
  badge?: string | number
  onClick: () => void
}) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} title={label}>
      <Icon name={icon} size={16} />
      <span className="nav-label">{label}</span>
      {badge !== undefined && badge !== 0 && badge !== '' && <span className="nav-badge">{badge}</span>}
    </button>
  )
}

function RefRow({ r }: { r: Ref }) {
  const a = useStore(
    useShallow((s) => ({
      checkout: s.checkout,
      status: s.status,
      currentBranch: s.repo?.head.branch,
      openMenu: s.openMenu,
      promptText: s.promptText,
      copy: s.copy,
      deleteBranch: s.deleteBranch,
      renameBranch: s.renameBranch,
      deleteTag: s.deleteTag,
      createBranchAt: s.createBranchAt,
      openMergeDialog: s.openMergeDialog,
      createPrFor: s.createPrFor,
      pullBranch: s.pullBranch,
      focusCommit: s.focusCommit,
      toggleFav: s.toggleFav,
      isFav: s.isFav,
      favourites: s.favourites
    }))
  )
  const dirty =
    !!a.status && a.status.staged.length + a.status.unstaged.length + a.status.conflicted.length > 0
  const canFav = r.type === 'localBranch'
  const faved = canFav && a.isFav('branch', r.name)

  const doCheckout = () => {
    if (dirty && !confirm(`You have uncommitted changes. Checkout ${r.name} anyway?`)) return
    a.checkout(r.name)
  }

  const newBranchHere = async () => {
    const name = await a.promptText({
      title: 'New branch',
      label: `Create a new branch starting at ${r.name}`,
      placeholder: 'branch-name',
      confirmText: 'Create'
    })
    if (name) a.createBranchAt(name, r.name)
  }

  // The branch's remote was deleted ("gone") — offer to clean up the local copy.
  const deleteGone = async () => {
    const yes = await a.promptText({
      title: `Delete ${r.name}?`,
      message: `Its upstream ${r.upstream ?? 'branch'} was deleted on the remote — this branch is probably finished with (e.g. its PR was merged). This removes only your local copy.`,
      confirmOnly: true,
      danger: true,
      confirmText: 'Delete branch'
    })
    if (yes) a.deleteBranch(r.name)
  }

  const buildMenu = (): MenuItem[] => {
    const favItem: MenuItem = {
      label: faved ? 'Unfavourite' : 'Favourite',
      icon: faved ? 'starOn' : 'star',
      onSelect: () => a.toggleFav('branch', r.name)
    }
    // Pushes the branch then opens a GitHub PR against the main branch.
    const prItem: MenuItem = {
      label: 'Create pull request…',
      icon: 'github',
      disabled: isBaseBranch(r.name),
      onSelect: () => a.createPrFor(r.name)
    }

    // Fast-forward this branch from its upstream without checking it out.
    const pullItem: MenuItem = {
      label: 'Pull (update from remote)',
      icon: 'pull',
      onSelect: () => a.pullBranch(r.name)
    }
    // `git branch -m` — works on any local branch, current or not, dirty or clean.
    const renameItem: MenuItem = {
      label: 'Rename…',
      icon: 'rename',
      onSelect: async () => {
        const name = await a.promptText({
          title: 'Rename branch',
          initial: r.name,
          confirmText: 'Rename'
        })
        if (name && name !== r.name) a.renameBranch(r.name, name)
      }
    }

    if (r.type === 'localBranch') {
      if (r.current) {
        return [
          pullItem,
          prItem,
          { type: 'divider' },
          renameItem,
          favItem,
          { label: 'New branch from here…', icon: 'branch', onSelect: newBranchHere },
          { label: 'Copy name', icon: 'copy', onSelect: () => a.copy(r.name, 'name') }
        ]
      }
      return [
        { label: 'Checkout', icon: 'branch', onSelect: doCheckout },
        pullItem,
        {
          label: `Merge into ${a.currentBranch ?? 'current'}…`,
          icon: 'merge',
          disabled: !a.currentBranch,
          onSelect: () => a.openMergeDialog(r.name)
        },
        prItem,
        favItem,
        { type: 'divider' },
        renameItem,
        { label: 'Delete', icon: 'trash', danger: true, onSelect: () => a.deleteBranch(r.name) },
        { type: 'divider' },
        { label: 'New branch from here…', icon: 'branch', onSelect: newBranchHere },
        { label: 'Copy name', icon: 'copy', onSelect: () => a.copy(r.name, 'name') }
      ]
    }
    if (r.type === 'remoteBranch') {
      return [
        { label: 'Checkout', icon: 'branch', onSelect: doCheckout },
        { type: 'divider' },
        { label: 'Copy name', icon: 'copy', onSelect: () => a.copy(r.name, 'name') }
      ]
    }
    if (r.type === 'tag') {
      return [
        { label: 'Checkout', icon: 'tag', onSelect: () => a.checkout(r.name) },
        { type: 'divider' },
        { label: 'Delete', icon: 'trash', danger: true, onSelect: () => a.deleteTag(r.name) },
        { label: 'Copy name', icon: 'copy', onSelect: () => a.copy(r.name, 'name') }
      ]
    }
    return [{ label: 'Copy hash', icon: 'copy', onSelect: () => a.copy(r.hash, 'hash') }]
  }

  return (
    <button
      className={`ref-row ${r.current ? 'current' : ''}`}
      onClick={() => a.focusCommit(r.hash)}
      onDoubleClick={() => r.type !== 'tag' && r.type !== 'head' && !r.current && doCheckout()}
      onContextMenu={(e) => {
        e.preventDefault()
        a.openMenu(e.clientX, e.clientY, buildMenu())
      }}
      title={
        r.current
          ? `${r.name} (current) · ${r.hash}`
          : `${r.name} — click to view in history, double-click to check out, right-click for options`
      }
    >
      <Icon name={r.type === 'tag' ? 'tag' : r.type === 'remoteBranch' ? 'remote' : 'branch'} size={14} />
      <span className="ref-name">{r.remote ? r.name.slice(r.remote.length + 1) : r.name}</span>
      {faved && <Icon name="starOn" size={11} className="ref-star" />}
      {r.type === 'localBranch' && r.gone && (
        <span
          role="button"
          tabIndex={0}
          className="ref-gone"
          title={`Its remote branch (${r.upstream ?? 'upstream'}) was deleted — click to delete this local branch`}
          onClick={(e) => {
            e.stopPropagation()
            deleteGone()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              deleteGone()
            }
          }}
        >
          <Icon name="warning" size={12} />
        </span>
      )}
      {r.current && <span className="ref-dot" />}
    </button>
  )
}

export function Sidebar() {
  const { refs, repo, status, noobMode, setNoobMode, view, setView, isFav, favourites } = useStore(
    useShallow((s) => ({
      refs: s.refs,
      repo: s.repo,
      status: s.status,
      noobMode: s.noobMode,
      setNoobMode: s.setNoobMode,
      view: s.view,
      setView: s.setView,
      isFav: s.isFav,
      favourites: s.favourites
    }))
  )
  const width = useSize('sidebarW', 236)
  const [remotesOpen, setRemotesOpen] = useState(true)
  const [query, setQuery] = useState('')

  const q = query.trim()
  const local = useMemo(() => filterRefs(refs.filter((r) => r.type === 'localBranch'), q), [refs, q])
  // Depend on `favourites` so the split recomputes when a star is toggled.
  const favLocal = useMemo(() => local.filter((r) => isFav('branch', r.name)), [local, isFav, favourites])
  const rest = useMemo(() => local.filter((r) => !isFav('branch', r.name)), [local, isFav, favourites])
  // Branches you're working on (feature branches) vs. shared mainline branches.
  const yourWork = useMemo(() => rest.filter((r) => !isBaseBranch(r.name)), [rest])
  const baseLocal = useMemo(() => rest.filter((r) => isBaseBranch(r.name)), [rest])
  const remotes = useMemo(() => {
    const groups: Record<string, Ref[]> = {}
    for (const r of filterRefs(refs.filter((x) => x.type === 'remoteBranch'), q))
      if (r.remote) (groups[r.remote] ??= []).push(r)
    return groups
  }, [refs, q])
  const tags = useMemo(() => filterRefs(refs.filter((r) => r.type === 'tag'), q), [refs, q])
  const detached = refs.find((r) => r.type === 'head')

  const changeCount = status
    ? status.staged.length + status.unstaged.length + status.conflicted.length
    : 0

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Icon name="merge" size={17} />
        </div>
        <div className="brand-name">CrumbTree</div>
      </div>

      <div className="sidebar-scroll">
        <SectionLabel className="side-workspace-label">Workspace</SectionLabel>
        <nav className="side-nav">
          <NavItem icon="history" label="History" active={view === 'history'} onClick={() => setView('history')} />
          <NavItem
            icon="changes"
            label="Changes"
            active={view === 'changes'}
            badge={changeCount}
            onClick={() => setView('changes')}
          />
          <NavItem icon="stash" label="Stashes" active={view === 'stashes'} onClick={() => setView('stashes')} />
          <NavItem icon="merge" label="Rebase" active={view === 'rebase'} onClick={() => setView('rebase')} />
          <NavItem
            icon="worktree"
            label="Worktrees"
            active={view === 'worktrees'}
            onClick={() => setView('worktrees')}
          />
          <NavItem icon="database" label="LFS" active={view === 'lfs'} onClick={() => setView('lfs')} />
        </nav>

        {repo && (
          <>
            <div className="side-search">
              <Icon name="search" size={13} />
              <input
                value={query}
                placeholder="Find branch, tag or hash…"
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="side-search-clear" onClick={() => setQuery('')} title="Clear">
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            {favLocal.length > 0 && (
              <>
                <SectionLabel count={favLocal.length}>Favourites</SectionLabel>
                {favLocal.map((r) => (
                  <RefRow key={`fav-${r.name}`} r={r} />
                ))}
              </>
            )}

            {yourWork.length > 0 && (
              <>
                <SectionLabel count={yourWork.length}>Your work</SectionLabel>
                {yourWork.map((r) => (
                  <RefRow key={`yw-${r.name}`} r={r} />
                ))}
              </>
            )}

            <SectionLabel count={baseLocal.length + favLocal.length + yourWork.length}>
              Branches
            </SectionLabel>
            {detached && <RefRow r={detached} />}
            {baseLocal.map((r) => (
              <RefRow key={r.name} r={r} />
            ))}
            {local.length === 0 && !detached && (
              <div className="side-empty">{q ? 'No matches' : 'No local branches'}</div>
            )}

            {Object.keys(remotes).length > 0 && (
              <>
                <button className="side-label side-label-btn" onClick={() => setRemotesOpen((o) => !o)}>
                  <span>Remotes</span>
                  <Icon
                    name="chevron"
                    size={13}
                    style={{ transform: remotesOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}
                  />
                </button>
                {remotesOpen &&
                  Object.entries(remotes).map(([remote, list]) => (
                    <div key={remote} className="remote-group">
                      <div className="remote-name">
                        <Icon name="remote" size={12} /> {remote}
                      </div>
                      {list.map((r) => (
                        <RefRow key={r.name} r={r} />
                      ))}
                    </div>
                  ))}
              </>
            )}

            {tags.length > 0 && (
              <>
                <SectionLabel count={tags.length}>Tags</SectionLabel>
                {tags.slice(0, 60).map((r) => (
                  <RefRow key={r.name} r={r} />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="sidebar-foot">
        <button
          className={`noob-toggle ${noobMode ? 'on' : ''}`}
          onClick={() => setNoobMode(!noobMode)}
          title="Switch to a simpler, guided workspace"
        >
          <span className="noob-track">
            <span className="noob-knob" />
          </span>
          <span className="noob-label">
            <Icon name="sparkle" size={13} />
            Minimal Mode
          </span>
        </button>
      </div>
    </aside>
  )
}
