import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Commit, FileDiff } from '@shared/types'
import { useStore } from '../store/store'
import { crumb, unwrap } from '../lib/api'
import { parseBlame, type BlameLine } from '../lib/blame-parse'
import { avatarHue, initials, relativeTime, shortHash } from '../lib/format'
import { Icon } from './ui/Icon'
import { DiffBody } from './DiffBody'

export function FileHistoryModal() {
  const { fh, close, repo, focusCommit } = useStore(
    useShallow((s) => ({
      fh: s.fileHistory,
      close: s.closeFileHistory,
      repo: s.repo,
      focusCommit: s.focusCommit
    }))
  )
  const [tab, setTab] = useState<'history' | 'blame'>('history')
  const [selected, setSelected] = useState<string | null>(null)
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [blame, setBlame] = useState<BlameLine[] | null>(null)

  const file = fh?.file
  const commits = fh?.commits ?? []

  // Reset when a new file opens.
  useEffect(() => {
    setTab('history')
    setSelected(commits[0]?.hash ?? null)
    setBlame(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  // Load the selected commit's diff + containing branches.
  useEffect(() => {
    if (!selected || !repo || !file) return
    let cancelled = false
    setDiff(null)
    setBranches([])
    unwrap(crumb.commitFileDiff(repo.path, selected, file)).then((d) => !cancelled && setDiff(d))
    unwrap(crumb.branchesContaining(repo.path, selected)).then((b) => !cancelled && setBranches(b))
    return () => {
      cancelled = true
    }
  }, [selected, repo, file])

  // Load blame when the tab is first opened.
  useEffect(() => {
    if (tab !== 'blame' || blame || !repo || !file) return
    unwrap(crumb.fileBlame(repo.path, file)).then((raw) => setBlame(parseBlame(raw)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const selectedCommit = useMemo(
    () => commits.find((c) => c.hash === selected) ?? null,
    [commits, selected]
  )

  if (!fh) return null

  const jump = (hash: string) => {
    focusCommit(hash)
    close()
  }

  return (
    <div className="prompt-overlay" onClick={close}>
      <div className="fh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fh-head">
          <Icon name="history" size={16} />
          <span className="mono fh-path">{file}</span>
          <div className="seg fh-tabs">
            <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
              History
            </button>
            <button className={tab === 'blame' ? 'on' : ''} onClick={() => setTab('blame')}>
              Blame
            </button>
          </div>
          <div className="topbar-spacer" />
          <button className="studio-step-close" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>

        {tab === 'history' ? (
          <div className="fh-body">
            <div className="fh-list">
              {commits.map((c: Commit) => (
                <button
                  key={c.hash}
                  className={`fh-commit ${selected === c.hash ? 'active' : ''}`}
                  onClick={() => setSelected(c.hash)}
                >
                  <span className="avatar" style={{ background: `hsl(${avatarHue(c.authorEmail)} 45% 34%)` }}>
                    {initials(c.authorName)}
                  </span>
                  <span className="fh-commit-text">
                    <span className="fh-commit-subject">{c.subject}</span>
                    <span className="fh-commit-meta">
                      {c.authorName} · <span className="mono">{shortHash(c.hash)}</span> ·{' '}
                      {relativeTime(c.timestamp)}
                    </span>
                  </span>
                </button>
              ))}
              {commits.length === 0 && <div className="side-empty">No history for this file.</div>}
            </div>

            <div className="fh-detail">
              {selectedCommit ? (
                <>
                  <div className="fh-detail-head">
                    <div className="fh-detail-subject">{selectedCommit.subject}</div>
                    <div className="detail-meta">
                      <span className="detail-author">{selectedCommit.authorName}</span>
                      <span className="detail-sep">·</span>
                      <span className="detail-time">{relativeTime(selectedCommit.timestamp)}</span>
                      <span className="detail-sep">·</span>
                      <button className="mono detail-hash fh-jump" onClick={() => jump(selectedCommit.hash)}>
                        {shortHash(selectedCommit.hash)}
                      </button>
                    </div>
                    {branches.length > 0 && (
                      <div className="fh-branches">
                        <span className="fh-branches-label">In branches:</span>
                        {branches.slice(0, 8).map((b) => (
                          <span key={b} className="fh-branch-badge">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <DiffBody diff={diff} empty="No changes in this commit." />
                </>
              ) : (
                <div className="diff-empty">Select a commit.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="fh-blame">
            {!blame ? (
              <div className="diff-empty">Loading blame…</div>
            ) : blame.length === 0 ? (
              <div className="diff-empty">No blame available for this file.</div>
            ) : (
              <div className="fh-blame-lines mono">
                {blame.map((l, i) => (
                  <div key={i} className="fh-blame-line">
                    <button
                      className={`fh-blame-gutter ${l.startsGroup ? 'group' : ''}`}
                      onClick={() => jump(l.hash)}
                      title={l.startsGroup ? `${l.summary}` : ''}
                    >
                      {l.startsGroup && (
                        <>
                          <span className="fh-blame-hash mono">{shortHash(l.hash)}</span>
                          <span className="fh-blame-author">{l.author}</span>
                        </>
                      )}
                    </button>
                    <span className="fh-blame-code">{l.line || ' '}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
