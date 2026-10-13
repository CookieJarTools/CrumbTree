import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { Icon } from './ui/Icon'

export function TopBar() {
  const { repo, openDialog, refresh, fetch, pull, push, busy, togglePalette, toggleDrawer } = useStore(
    useShallow((s) => ({
      repo: s.repo,
      openDialog: s.openDialog,
      refresh: s.refresh,
      fetch: s.fetch,
      pull: s.pull,
      push: s.push,
      busy: s.busy,
      togglePalette: s.togglePalette,
      toggleDrawer: s.toggleDrawer
    }))
  )

  const head = repo?.head

  return (
    <header className="topbar">
      <button className="repo-picker" onClick={openDialog} title="Open a repository">
        <Icon name="folder" size={15} />
        <span className="repo-name">{repo ? repo.name : 'Open repository'}</span>
        <Icon name="chevron" size={13} style={{ transform: 'rotate(90deg)', opacity: 0.5 }} />
      </button>

      {head && (
        <div className="branch-pill" title={head.upstream ? `Tracking ${head.upstream}` : 'No upstream'}>
          <Icon name="branch" size={13} />
          <span className="mono">{head.detached ? head.hash : head.branch}</span>
          {(head.ahead > 0 || head.behind > 0) && (
            <span className="ab">
              {head.ahead > 0 && (
                <span className="ahead">
                  <Icon name="push" size={11} />
                  {head.ahead}
                </span>
              )}
              {head.behind > 0 && (
                <span className="behind">
                  <Icon name="pull" size={11} />
                  {head.behind}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <div className="topbar-spacer" />

      {busy && (
        <span className="busy">
          <span className="spinner" />
          {busy}
        </span>
      )}

      {repo && (
        <div className="sync-group">
          <button className="tb-btn" onClick={fetch} title="Fetch all (git fetch --all --prune)">
            <Icon name="fetch" size={15} /> Fetch
          </button>
          <button className="tb-btn" onClick={pull} disabled={!head?.upstream} title="Pull (fast-forward only)">
            <Icon name="pull" size={15} /> Pull
          </button>
          <button className="tb-btn accent" onClick={push} disabled={!head?.upstream} title="Push">
            <Icon name="push" size={15} /> Push
          </button>
          <button className="tb-icon" onClick={refresh} title="Refresh">
            <Icon name="refresh" size={15} />
          </button>
        </div>
      )}

      <button className="tb-icon" onClick={() => toggleDrawer()} title="Operation log">
        <Icon name="terminal" size={15} />
      </button>
      <button className="cmdk-chip" onClick={() => togglePalette(true)} title="Command palette">
        <span className="mono">Ctrl K</span>
      </button>
    </header>
  )
}
