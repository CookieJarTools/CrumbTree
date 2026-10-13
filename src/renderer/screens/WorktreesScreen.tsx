import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Worktree } from '@shared/types'
import { useStore, type MenuItem } from '../store/store'
import { Icon } from '../components/ui/Icon'

function baseName(p: string): string {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p
}
function dirName(p: string): string {
  const norm = p.replace(/[\\/]+$/, '')
  const i = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  return i === -1 ? '' : norm.slice(0, i)
}
function joinP(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + name
}
function sanitizeBranch(b: string): string {
  return b.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Modal to create a new worktree from an existing or new branch. */
function AddWorktreeModal({ onClose }: { onClose: () => void }) {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      refs: st.refs,
      worktrees: st.worktrees,
      pickFolder: st.pickFolder,
      addWorktree: st.addWorktree,
      busy: st.busy
    }))
  )

  const localBranches = useMemo(
    () => s.refs.filter((r) => r.type === 'localBranch').map((r) => r.name),
    [s.refs]
  )
  // Branches already checked out in a worktree can't be checked out again.
  const usedBranches = useMemo(
    () => new Set(s.worktrees.map((w) => w.branch).filter(Boolean) as string[]),
    [s.worktrees]
  )
  const available = useMemo(
    () => localBranches.filter((b) => !usedBranches.has(b)),
    [localBranches, usedBranches]
  )

  const [mode, setMode] = useState<'existing' | 'new'>(available.length > 0 ? 'existing' : 'new')
  const [existing, setExisting] = useState(available[0] ?? '')
  const [newBranch, setNewBranch] = useState('')
  const [base, setBase] = useState(localBranches[0] ?? 'HEAD')
  const [dir, setDir] = useState(s.repo ? dirName(s.repo.path) : '')
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)

  const branch = mode === 'existing' ? existing : newBranch.trim()

  // Suggest a folder name from the chosen branch until the user overrides it.
  useEffect(() => {
    if (nameEdited) return
    const repoName = s.repo ? baseName(s.repo.path) : 'repo'
    setName(branch ? `${repoName}-${sanitizeBranch(branch)}` : '')
  }, [branch, nameEdited, s.repo])

  const target = dir && name ? joinP(dir, name) : ''
  const canCreate = !!branch && !!dir && !!name && !s.busy

  const choose = async () => {
    const f = await s.pickFolder()
    if (f) setDir(f)
  }
  const create = async () => {
    if (!canCreate) return
    const ok = await s.addWorktree(target, branch, mode === 'new', mode === 'new' ? base : undefined)
    if (ok) onClose()
  }

  return (
    <div className="prompt-overlay" onClick={onClose}>
      <div className="newrepo" onClick={(e) => e.stopPropagation()}>
        <div className="newrepo-head">
          <div className="newrepo-title">
            <Icon name="worktree" size={18} />
            New worktree
          </div>
          <button className="studio-step-close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="newrepo-body">
          <div className="nr-field">
            <span>Branch</span>
            <div className="seg wt-seg">
              <button
                className={mode === 'existing' ? 'on' : ''}
                disabled={available.length === 0}
                onClick={() => setMode('existing')}
              >
                Existing branch
              </button>
              <button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>
                New branch
              </button>
            </div>
          </div>

          {mode === 'existing' ? (
            <label className="nr-field">
              <span>Check out</span>
              {available.length > 0 ? (
                <select value={existing} onChange={(e) => setExisting(e.target.value)}>
                  {available.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="nr-hint">Every local branch is already in a worktree.</span>
              )}
            </label>
          ) : (
            <div className="nr-row">
              <label className="nr-field">
                <span>New branch name</span>
                <input
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  placeholder="feature/thing"
                />
              </label>
              <label className="nr-field">
                <span>Based on</span>
                <select value={base} onChange={(e) => setBase(e.target.value)}>
                  <option value="HEAD">HEAD (current)</option>
                  {localBranches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="nr-field">
            <span>Location</span>
            <div className="nr-folder">
              <input readOnly value={dir} placeholder="Choose a parent folder…" />
              <button className="mini-btn" onClick={choose}>
                <Icon name="folder" size={13} /> Choose…
              </button>
            </div>
          </label>

          <label className="nr-field">
            <span>Folder name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameEdited(true)
              }}
              placeholder="repo-branch"
            />
          </label>
        </div>

        <div className="newrepo-foot">
          <span className="nr-summary mono">{target ? `→ ${target}` : 'Pick a branch and folder.'}</span>
          <div className="nr-actions">
            <button className="prompt-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="prompt-ok" disabled={!canCreate} onClick={create}>
              {s.busy ? 'Creating…' : 'Create worktree'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WorktreesScreen() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      worktrees: st.worktrees,
      loadWorktrees: st.loadWorktrees,
      removeWorktree: st.removeWorktree,
      pruneWorktrees: st.pruneWorktrees,
      lockWorktree: st.lockWorktree,
      openWorktree: st.openWorktree,
      openMenu: st.openMenu,
      reveal: st.reveal,
      copy: st.copy
    }))
  )
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    s.loadWorktrees()
  }, [s.loadWorktrees, s.repo?.path])

  if (!s.repo) return <div className="screen-empty">Open a repository to manage worktrees.</div>

  const rowMenu = (w: Worktree): MenuItem[] => {
    const items: MenuItem[] = []
    if (!w.isCurrent) items.push({ label: 'Open in a tab', icon: 'folder', onSelect: () => s.openWorktree(w.path) })
    items.push({ label: 'Reveal in Explorer', icon: 'external', onSelect: () => s.reveal(w.path) })
    items.push({ label: 'Copy path', icon: 'copy', onSelect: () => s.copy(w.path, 'path') })
    if (!w.isMain) {
      items.push({ type: 'divider' })
      items.push({
        label: w.locked ? 'Unlock' : 'Lock',
        icon: 'lock',
        onSelect: () => s.lockWorktree(w.path, !w.locked)
      })
      items.push({
        label: 'Remove',
        icon: 'trash',
        danger: true,
        disabled: w.isCurrent,
        onSelect: () => s.removeWorktree(w.path, false)
      })
    }
    return items
  }

  return (
    <div className="wt-screen">
      <div className="wt-head">
        <div>
          <h2>Worktrees</h2>
          <p className="wt-sub">
            Check out several branches at once, each in its own folder — no stashing to switch.
          </p>
        </div>
        <div className="wt-head-actions">
          <button className="btn" onClick={() => s.pruneWorktrees()} title="Remove records for deleted worktree folders">
            <Icon name="refresh" size={13} /> Prune
          </button>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> New worktree
          </button>
        </div>
      </div>

      <div className="wt-list">
        {s.worktrees.map((w) => (
          <div
            key={w.path}
            className={`wt-item ${w.isCurrent ? 'current' : ''}`}
            onContextMenu={(e) => {
              e.preventDefault()
              s.openMenu(e.clientX, e.clientY, rowMenu(w))
            }}
          >
            <Icon name="worktree" size={16} className="wt-item-icon" />
            <div className="wt-item-main">
              <div className="wt-item-top">
                <span className="wt-item-name">{baseName(w.path)}</span>
                {w.branch ? (
                  <span className="wt-badge branch">
                    <Icon name="branch" size={11} /> {w.branch}
                  </span>
                ) : w.detached ? (
                  <span className="wt-badge detached">detached{w.head ? ` @ ${w.head}` : ''}</span>
                ) : w.bare ? (
                  <span className="wt-badge">bare</span>
                ) : null}
                {w.isMain && <span className="wt-badge main">main</span>}
                {w.isCurrent && <span className="wt-badge cur">this tab</span>}
                {w.locked && (
                  <span className="wt-badge locked" title={w.lockedReason ?? 'Locked'}>
                    <Icon name="lock" size={11} /> locked
                  </span>
                )}
                {w.prunable && <span className="wt-badge prunable">missing</span>}
              </div>
              <div className="wt-item-path mono">{w.path}</div>
            </div>
            <div className="wt-item-actions">
              {!w.isCurrent && (
                <button className="btn sm" onClick={() => s.openWorktree(w.path)}>
                  Open
                </button>
              )}
              {!w.isMain && (
                <button
                  className="btn sm danger"
                  disabled={w.isCurrent}
                  title={w.isCurrent ? 'You can’t remove the worktree you’re in' : 'Remove this worktree'}
                  onClick={() => s.removeWorktree(w.path, false)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {s.worktrees.length === 0 && <div className="side-empty">No worktrees yet.</div>}
      </div>

      {adding && <AddWorktreeModal onClose={() => setAdding(false)} />}
    </div>
  )
}
