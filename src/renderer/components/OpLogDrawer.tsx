import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { OPLOG_PEEK_HEIGHT } from '../lib/ui'
import { Icon } from './ui/Icon'

export function OpLogDrawer() {
  const {
    drawerOpen,
    drawerPeek,
    toggleDrawer,
    opLog,
    runTerminal,
    repo,
    layout,
    setSize,
    gitProgress
  } = useStore(
    useShallow((s) => ({
      drawerOpen: s.drawerOpen,
      drawerPeek: s.drawerPeek,
      toggleDrawer: s.toggleDrawer,
      opLog: s.opLog,
      runTerminal: s.runTerminal,
      repo: s.repo,
      layout: s.layout,
      setSize: s.setSize,
      gitProgress: s.gitProgress
    }))
  )
  const endRef = useRef<HTMLDivElement>(null)
  const [cmd, setCmd] = useState('')
  const [hist, setHist] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)

  // Height the log animates to: 0 when shut, a crack when the friend is peeking.
  const fullHeight = layout['oplogH'] ?? 240
  const height = drawerOpen ? (drawerPeek ? OPLOG_PEEK_HEIGHT : fullHeight) : 0

  useEffect(() => {
    if (drawerOpen && !drawerPeek) endRef.current?.scrollIntoView()
  }, [opLog.length, drawerOpen, drawerPeek])

  // Stays mounted so the height can transition; `visibility` keeps it out of the
  // tab order while it's shut.

  const submit = () => {
    const c = cmd.trim()
    if (!c) return
    runTerminal(c)
    setHist((h) => [...h, c])
    setHistIdx(-1)
    setCmd('')
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit()
    else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const i = histIdx === -1 ? hist.length - 1 : Math.max(0, histIdx - 1)
      if (hist[i] !== undefined) {
        setHistIdx(i)
        setCmd(hist[i])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx === -1) return
      const i = histIdx + 1
      if (i >= hist.length) {
        setHistIdx(-1)
        setCmd('')
      } else {
        setHistIdx(i)
        setCmd(hist[i])
      }
    }
  }

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = height
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(600, Math.max(140, startH + (startY - ev.clientY)))
      setSize('oplogH', next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={`oplog-drawer ${drawerOpen ? 'open' : ''} ${drawerPeek ? 'peek' : ''}`}
      style={{ height }}
      aria-hidden={!drawerOpen}
    >
      {!drawerPeek && (
        <div className="oplog-resize" onMouseDown={startResize} title="Drag to resize" />
      )}
      <div className="oplog-head">
        <Icon name="terminal" size={14} />
        <span>Terminal</span>
        <span className="side-count">{opLog.length}</span>
        <div className="topbar-spacer" />
        <span className="oplog-sub">
          {drawerPeek ? 'someone’s having a nose…' : 'Type a git command and press Enter.'}
        </span>
        <button
          className="tb-icon"
          onClick={() => toggleDrawer(drawerPeek ? true : false)}
          title={drawerPeek ? 'Open properly' : 'Close'}
        >
          <Icon name={drawerPeek ? 'chevron' : 'close'} size={14} />
        </button>
      </div>
      {gitProgress && (
        <div className="oplog-progress">
          <div className="oplog-progress-top">
            <span className="oplog-progress-phase">{gitProgress.phase}</span>
            {gitProgress.current !== null && gitProgress.total !== null && (
              <span className="oplog-progress-count mono">
                {gitProgress.current.toLocaleString()}/{gitProgress.total.toLocaleString()}
              </span>
            )}
            {gitProgress.detail && (
              <span className="oplog-progress-detail mono">{gitProgress.detail}</span>
            )}
            <div className="topbar-spacer" />
            <span className="oplog-progress-pct mono">{gitProgress.percent}%</span>
          </div>
          <div className="oplog-progress-track">
            <div className="oplog-progress-fill" style={{ width: `${gitProgress.percent}%` }} />
          </div>
        </div>
      )}

      <div className="oplog-body mono">
        {opLog.length === 0 && <div className="side-empty">No commands run yet.</div>}
        {opLog.map((e) => (
          <div key={e.id} className={`oplog-row ${e.ok ? '' : 'err'} ${e.input ? 'typed' : ''}`}>
            <span className={`oplog-mark ${e.input ? 'prompt' : e.ok ? 'ok' : 'err'}`}>
              {e.input ? '$' : e.ok ? '›' : '✕'}
            </span>
            <span className="oplog-cmd">{e.command}</span>
            {!e.input && <span className="oplog-ms">{e.ms}ms</span>}
            {e.stdout && <div className="oplog-out">{e.stdout}</div>}
            {e.stderr && <div className="oplog-stderr">{e.stderr}</div>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="oplog-input" hidden={drawerPeek}>
        <span className="oplog-prompt mono">git</span>
        <input
          className="mono"
          value={cmd}
          placeholder={repo ? 'status  ·  log --oneline -10  ·  branch -a' : 'open a repository first'}
          disabled={!repo}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={onKey}
        />
        <button className="oplog-run" onClick={submit} disabled={!repo || !cmd.trim()} title="Run">
          <Icon name="play" size={13} />
        </button>
      </div>
    </div>
  )
}
