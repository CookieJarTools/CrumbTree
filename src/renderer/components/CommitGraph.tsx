import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useShallow } from 'zustand/react/shallow'
import type { GraphRow, Ref } from '@shared/types'
import { useStore, type MenuItem } from '../store/store'
import { laneColor, relativeTime, shortHash } from '../lib/format'
import { maxLaneCount, reachableFrom } from '../lib/graph/layout'
import { matchCommit } from '../lib/search'
import { dedupeRefs, isBaseBranch } from '../lib/refs'
import { Icon } from './ui/Icon'

const LW = 15 // lane width in px
const NODE_R = 4.5
const PAD = 12
const ROW_H = 30
/** Compact mode packs rows tighter. */
const ROW_H_COMPACT = 26

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 === x2) return `M${x1} ${y1} L${x2} ${y2}`
  const my = (y1 + y2) / 2
  return `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

/** Lines and nodes off the checked-out branch fade back so its history reads first. */
const OFF_OPACITY = 0.28

function GraphCell({
  row,
  width,
  height,
  onBranch,
  isHead
}: {
  row: GraphRow
  width: number
  height: number
  /** Commits in the current branch's history; null when unknown (nothing is dimmed). */
  onBranch: Set<string> | null
  isHead: boolean
}) {
  const cx = (lane: number) => lane * LW + LW / 2 + PAD
  const mid = height / 2
  const lit = (hashes: string[]) => !onBranch || hashes.some((h) => onBranch.has(h))
  const nodeLit = lit([row.commit.hash])
  return (
    <svg className="graph-cell" width={width} height={height} style={{ minWidth: width }}>
      {row.edges.map((e, i) => {
        const x1 = cx(e.fromLane)
        const y1 = e.fromTop ? 0 : mid
        const x2 = cx(e.toLane)
        const y2 = e.toBottom ? height : mid
        return (
          <path
            key={i}
            d={edgePath(x1, y1, x2, y2)}
            fill="none"
            stroke={laneColor(e.color)}
            strokeWidth={1.6}
            opacity={lit(e.from) ? 1 : OFF_OPACITY}
          />
        )
      })}
      {isHead ? (
        // HEAD: a hollow ring, so "you are here" reads at a glance.
        <circle
          cx={cx(row.lane)}
          cy={mid}
          r={NODE_R + 0.5}
          fill="var(--bg)"
          stroke={laneColor(row.color)}
          strokeWidth={2.2}
        />
      ) : (
        <circle
          cx={cx(row.lane)}
          cy={mid}
          r={NODE_R}
          fill={laneColor(row.color)}
          stroke="var(--bg)"
          strokeWidth={1.6}
          opacity={nodeLit ? 1 : OFF_OPACITY}
        />
      )}
    </svg>
  )
}

/**
 * What a decoration on a commit actually is. Falls back to the remote-prefix check
 * because a decoration can name a remote branch that isn't in the local ref list.
 */
function refKind(
  name: string,
  refsList: Ref[],
  remotes: Set<string>
): 'localBranch' | 'remoteBranch' | 'tag' {
  const known = refsList.find((r) => r.name === name)
  if (known?.type === 'tag') return 'tag'
  if (known?.type === 'localBranch') return 'localBranch'
  if (known?.type === 'remoteBranch') return 'remoteBranch'
  return remotes.has(name.split('/')[0]) ? 'remoteBranch' : 'localBranch'
}

function RefBadges({ row }: { row: GraphRow }) {
  const b = useStore(
    useShallow((s) => ({
      currentBranch: s.repo?.head.branch,
      refsList: s.refs,
      openMenu: s.openMenu,
      checkout: s.checkout,
      copy: s.copy,
      promptText: s.promptText,
      renameBranch: s.renameBranch,
      deleteBranch: s.deleteBranch,
      deleteTag: s.deleteTag,
      openMergeDialog: s.openMergeDialog,
      createPrFor: s.createPrFor,
      pullBranch: s.pullBranch
    }))
  )
  const { currentBranch, refsList } = b
  const remotes = useMemo(
    () =>
      new Set(
        refsList.filter((r) => r.type === 'remoteBranch' && r.remote).map((r) => r.remote as string)
      ),
    [refsList]
  )
  const visible = useMemo(() => dedupeRefs(row.commit.refs, remotes), [row.commit.refs, remotes])
  if (visible.length === 0) return null

  /** Right-clicking a badge acts on that ref, not on the commit under it. */
  const badgeMenu = (name: string): MenuItem[] => {
    const kind = refKind(name, refsList, remotes)
    const items: MenuItem[] = []

    if (kind === 'tag') {
      items.push({
        label: `Check out tag ${name}`,
        icon: 'tag',
        onSelect: async () => {
          const ok = await b.promptText({
            title: `Check out ${name}?`,
            message:
              'Tags aren’t branches, so this detaches HEAD: you can look around but not push from here.',
            confirmOnly: true,
            confirmText: 'Detach anyway'
          })
          if (ok) b.checkout(name)
        }
      })
      items.push({ type: 'divider' })
      items.push({ label: 'Delete tag', icon: 'trash', danger: true, onSelect: () => b.deleteTag(name) })
      items.push({ label: 'Copy name', icon: 'copy', onSelect: () => b.copy(name, 'name') })
      return items
    }

    const isCurrent = name === currentBranch
    if (isCurrent) {
      items.push({ type: 'header', label: `On ${name}` })
    } else {
      items.push({ label: `Switch to ${name}`, icon: 'branch', onSelect: () => b.checkout(name) })
      if (currentBranch) {
        items.push({
          label: `Merge into ${currentBranch}…`,
          icon: 'merge',
          onSelect: () => b.openMergeDialog(name)
        })
      }
    }
    // Local branches can be brought up to date with their upstream in place.
    if (kind === 'localBranch') {
      items.push({
        label: 'Pull (update from remote)',
        icon: 'pull',
        onSelect: () => b.pullBranch(name)
      })
    }
    if (kind === 'localBranch' && !isBaseBranch(name)) {
      items.push({
        label: 'Create pull request…',
        icon: 'github',
        onSelect: () => b.createPrFor(name)
      })
    }

    if (kind === 'localBranch') {
      items.push({ type: 'divider' })
      items.push({
        // `git branch -m` works on the current branch too, dirty tree or not.
        label: 'Rename…',
        icon: 'rename',
        onSelect: async () => {
          const next = await b.promptText({ title: 'Rename branch', initial: name, confirmText: 'Rename' })
          if (next && next !== name) b.renameBranch(name, next)
        }
      })
      if (!isCurrent) {
        items.push({ label: 'Delete', icon: 'trash', danger: true, onSelect: () => b.deleteBranch(name) })
      }
    }
    items.push({ type: 'divider' })
    items.push({ label: 'Copy name', icon: 'copy', onSelect: () => b.copy(name, 'name') })
    return items
  }

  return (
    <span className="ref-badges">
      {visible.slice(0, 5).map((r) => {
        const isHead = r === currentBranch
        const isRemote = remotes.has(r.split('/')[0])
        return (
          <span
            key={r}
            className={`ref-badge ${isHead ? 'head' : ''} ${isRemote ? 'remote' : ''}`}
            style={{ ['--lane' as string]: laneColor(row.color) } as CSSProperties}
            title={`${r} — right-click for options${isHead ? ' (current branch)' : ''}`}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation() // act on the ref, not the commit row behind it
              b.openMenu(e.clientX, e.clientY, badgeMenu(r))
            }}
          >
            {isHead && <Icon name="check" size={10} />}
            {r}
          </span>
        )
      })}
    </span>
  )
}

export function CommitGraph() {
  const st = useStore(
    useShallow((s) => ({
      rows: s.rows,
      selectedHash: s.selectedHash,
      pendingScroll: s.pendingScroll,
      consumeScroll: s.consumeScroll,
      selectCommit: s.selectCommit,
      openMenu: s.openMenu,
      promptText: s.promptText,
      copy: s.copy,
      checkout: s.checkout,
      createBranchAt: s.createBranchAt,
      createTagAt: s.createTagAt,
      revert: s.revert,
      rewordCommit: s.rewordCommit,
      toggleFav: s.toggleFav,
      isFav: s.isFav,
      favourites: s.favourites,
      refsList: s.refs,
      currentBranch: s.repo?.head.branch,
      headHash: s.repo?.head.hash,
      compactMode: s.compactMode
    }))
  )
  const { rows, selectedHash, selectCommit, openMenu, promptText, copy, checkout, createBranchAt, createTagAt, revert } =
    st
  const remoteNames = useMemo(
    () =>
      new Set(
        st.refsList.filter((r) => r.type === 'remoteBranch' && r.remote).map((r) => r.remote as string)
      ),
    [st.refsList]
  )
  const parentRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  // Compact mode hides the search bar until asked for; this is "asked for".
  const [searchOpen, setSearchOpen] = useState(false)
  const rowH = st.compactMode ? ROW_H_COMPACT : ROW_H

  // Ctrl+F jumps to the commit search (in compact mode this is what reveals it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        // Focus after the bar has rendered (a hidden input can't take focus).
        requestAnimationFrame(() => {
          searchRef.current?.focus()
          searchRef.current?.select()
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = useMemo(
    () => (query.trim() ? rows.filter((r) => matchCommit(r.commit, query)) : rows),
    [rows, query]
  )
  const searching = query.trim().length > 0

  // History of the checked-out branch. Everything else is dimmed so it's obvious
  // which line you're on; if HEAD isn't loaded, dim nothing rather than everything.
  const onBranch = useMemo(() => {
    const set = reachableFrom(rows, st.headHash)
    return set.size > 0 ? set : null
  }, [rows, st.headHash])

  // "Switch to X" for every branch sitting on this commit (tags excluded — they detach).
  const switchItems = (refs: string[]): MenuItem[] => {
    const items: MenuItem[] = []
    for (const name of dedupeRefs(refs, remoteNames)) {
      if (name === st.currentBranch) continue
      if (refKind(name, st.refsList, remoteNames) === 'tag') continue
      items.push({ label: `Switch to ${name}`, icon: 'branch', onSelect: () => checkout(name) })
    }
    if (items.length > 0) items.push({ type: 'divider' })
    return items
  }

  const commitMenu = (hash: string, subject: string, refs: string[] = []): MenuItem[] => [
    // If this commit is the tip of a branch, offer to switch straight to it —
    // that's almost always what you want, and it avoids detaching HEAD.
    ...switchItems(refs),
    {
      label: st.isFav('commit', hash) ? 'Unfavourite' : 'Favourite',
      icon: st.isFav('commit', hash) ? 'starOn' : 'star',
      onSelect: () => st.toggleFav('commit', hash)
    },
    { type: 'divider' },
    {
      // Checking out a bare commit detaches HEAD — say so rather than silently
      // dropping people somewhere commits can't be pushed from.
      label: 'Checkout this commit',
      icon: 'commit',
      onSelect: async () => {
        const ok = await promptText({
          title: 'Check out this commit?',
          message:
            'This detaches HEAD: you’ll be looking at the code as it was, but not on any branch, so you can’t push from here. To work on it, use “New branch here…” instead.',
          confirmOnly: true,
          confirmText: 'Detach anyway'
        })
        if (ok) checkout(hash)
      }
    },
    { type: 'divider' },
    {
      label: 'New branch here…',
      icon: 'branch',
      onSelect: async () => {
        const name = await promptText({
          title: 'New branch',
          label: `Create a branch at ${shortHash(hash)}`,
          placeholder: 'branch-name',
          confirmText: 'Create'
        })
        if (name) createBranchAt(name, hash)
      }
    },
    {
      label: 'New tag here…',
      icon: 'tag',
      onSelect: async () => {
        const name = await promptText({
          title: 'New tag',
          label: `Tag ${shortHash(hash)}`,
          placeholder: 'v1.0.0',
          confirmText: 'Create'
        })
        if (name) createTagAt(name, hash)
      }
    },
    { label: 'Reword message…', icon: 'rename', onSelect: () => st.rewordCommit(hash) },
    { label: 'Revert this commit', icon: 'undo', onSelect: () => revert(hash) },
    { type: 'divider' },
    { label: 'Copy SHA', icon: 'copy', onSelect: () => copy(hash, 'SHA') },
    { label: 'Copy message', icon: 'copy', onSelect: () => copy(subject, 'message') }
  ]

  const gutter = useMemo(
    () => (searching ? PAD : maxLaneCount(rows) * LW + PAD * 2),
    [rows, searching]
  )

  const virt = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowH,
    overscan: 20
  })

  // Row height changes with compact mode; drop the cached sizes.
  const measure = virt.measure
  useEffect(() => {
    measure()
  }, [rowH, measure])

  // Scroll to a commit requested from elsewhere (e.g. clicking a branch/tag).
  const scrollToIndex = virt.scrollToIndex
  useEffect(() => {
    if (!st.pendingScroll || searching) return
    const idx = visible.findIndex((r) => r.commit.hash === st.pendingScroll)
    if (idx >= 0) scrollToIndex(idx, { align: 'center' })
    st.consumeScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.pendingScroll, visible, searching])

  const header = (
    <div className={`graph-toolbar ${searchOpen || query ? 'open' : ''}`}>
      <div className="graph-search">
        <Icon name="search" size={14} />
        <input
          ref={searchRef}
          value={query}
          placeholder="Search commits by message, hash or author…"
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setSearchOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
              e.currentTarget.blur()
            }
          }}
        />
        {query && (
          <button className="graph-search-clear" onClick={() => setQuery('')} title="Clear">
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      {searching && (
        <span className="graph-search-count">
          {visible.length} match{visible.length === 1 ? '' : 'es'}
        </span>
      )}
    </div>
  )

  if (rows.length === 0) {
    return (
      <div className="commit-graph">
        {header}
        <div className="graph-empty">No commits yet — make your first commit from the Changes tab.</div>
      </div>
    )
  }

  return (
    <div
      className={`commit-graph ${searching ? 'flat' : ''}`}
      style={{ ['--gutter']: `${gutter}px` } as CSSProperties}
    >
      {header}
      <div className="graph-header">
        <span className="graph-gutter-spacer" />
        <span className="col-desc">Description</span>
        <span className="col-author">Author</span>
        <span className="col-hash">Commit</span>
        <span className="col-date">Date</span>
      </div>
      <div className="graph-scroll" ref={parentRef}>
        {visible.length === 0 ? (
          <div className="graph-empty">No commits match “{query}”.</div>
        ) : (
          <div className="graph-inner" style={{ height: virt.getTotalSize() }}>
            {virt.getVirtualItems().map((vi) => {
              const row = visible[vi.index]
              const selected = row.commit.hash === selectedHash
              const faved = st.isFav('commit', row.commit.hash)
              const off = onBranch !== null && !onBranch.has(row.commit.hash)
              const isHead = !!st.headHash && row.commit.hash.startsWith(st.headHash)
              return (
                <div
                  key={row.commit.hash}
                  className={`commit-row ${selected ? 'selected' : ''} ${off ? 'off-branch' : ''} ${isHead ? 'is-head' : ''}`}
                  style={{ transform: `translateY(${vi.start}px)`, height: rowH }}
                  onClick={() => selectCommit(row.commit.hash)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    selectCommit(row.commit.hash)
                    openMenu(
                      e.clientX,
                      e.clientY,
                      commitMenu(row.commit.hash, row.commit.subject, row.commit.refs)
                    )
                  }}
                >
                  {searching ? (
                    <span className="graph-cell" />
                  ) : (
                    <GraphCell
                      row={row}
                      width={gutter}
                      height={rowH}
                      onBranch={onBranch}
                      isHead={isHead}
                    />
                  )}
                  <span className="col-desc">
                    {faved && <Icon name="starOn" size={11} className="commit-star" />}
                    <RefBadges row={row} />
                    <span className="commit-subject">{row.commit.subject}</span>
                  </span>
                  <span className="col-author" title={row.commit.authorEmail}>
                    {row.commit.authorName}
                  </span>
                  <span className="col-hash mono">{shortHash(row.commit.hash)}</span>
                  <span className="col-date">{relativeTime(row.commit.timestamp)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
