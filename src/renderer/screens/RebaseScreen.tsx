import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Commit } from '@shared/types'
import { isNoop, validatePlan, type RebaseAction, type RebaseStep } from '@shared/rebase-todo'
import { useStore } from '../store/store'
import { crumb, unwrap } from '../lib/api'
import { shortHash } from '../lib/format'
import { Icon } from '../components/ui/Icon'

const ACTIONS: { id: RebaseAction; label: string; hint: string }[] = [
  { id: 'pick', label: 'Pick', hint: 'Keep this commit as-is' },
  { id: 'reword', label: 'Reword', hint: 'Keep the changes, change the message' },
  { id: 'squash', label: 'Squash', hint: 'Merge into the commit above, joining both messages' },
  { id: 'fixup', label: 'Fixup', hint: 'Merge into the commit above, discard this message' },
  { id: 'edit', label: 'Edit', hint: 'Pause here so you can amend the commit' },
  { id: 'drop', label: 'Drop', hint: 'Remove this commit entirely' }
]

const MAX = 30

export function RebaseScreen() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      status: st.status,
      mergeState: st.mergeState,
      busy: st.busy,
      runRebase: st.runRebase,
      setView: st.setView,
      toast: st.toast
    }))
  )

  const [count, setCount] = useState(5)
  const [commits, setCommits] = useState<Commit[] | null>(null)
  const [plan, setPlan] = useState<RebaseStep[]>([])
  // The drag source lives in a ref, not state: `drop` must read it synchronously,
  // and a state value would still be the pre-render one inside the handler closure.
  const dragRef = useRef<number | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const repoPath = s.repo?.path

  // Load the branch's recent commits (newest first).
  useEffect(() => {
    if (!repoPath) return
    let cancelled = false
    setCommits(null)
    unwrap(crumb.rebaseCommits(repoPath, MAX)).then((c) => !cancelled && setCommits(c))
    return () => {
      cancelled = true
    }
  }, [repoPath])

  // The commits being edited: the newest `count`, shown oldest-first like git's todo.
  const selected = useMemo(
    () => (commits ? commits.slice(0, count).reverse() : []),
    [commits, count]
  )
  const originalOrder = useMemo(() => selected.map((c) => c.hash), [selected])

  const resetPlan = useCallback(() => {
    setPlan(selected.map((c) => ({ hash: c.hash, subject: c.subject, action: 'pick' as const })))
  }, [selected])

  useEffect(() => {
    resetPlan()
  }, [resetPlan])

  const byHash = useMemo(() => new Map(selected.map((c) => [c.hash, c])), [selected])

  // The commit the replayed commits land on: the parent of the oldest one.
  const base = selected[0]?.parents[0] ?? null
  const isRoot = selected.length > 0 && selected[0].parents.length === 0

  const dirty =
    !!s.status && s.status.staged.length + s.status.unstaged.length + s.status.conflicted.length > 0
  const rebasing = s.mergeState?.kind === 'rebase'
  const invalid = plan.length > 0 ? validatePlan(plan) : 'Nothing to rebase.'
  const noop = isNoop(plan, originalOrder)
  const canRun = !invalid && !noop && !dirty && !rebasing && !s.busy

  const setAction = (i: number, action: RebaseAction) => {
    setPlan((p) => p.map((st, idx) => (idx === i ? { ...st, action } : st)))
  }
  const setMessage = (i: number, message: string) => {
    setPlan((p) => p.map((st, idx) => (idx === i ? { ...st, message } : st)))
  }
  const move = (from: number, to: number) => {
    if (from === to) return
    setPlan((p) => {
      const next = [...p]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const onDrop = (to: number) => {
    const from = dragRef.current
    if (from !== null) move(from, to)
    dragRef.current = null
    setDragIndex(null)
    setOverIndex(null)
  }

  const run = async () => {
    if (!canRun) return
    const kept = plan.filter((p) => p.action !== 'drop').length
    const dropped = plan.length - kept
    const summary = dropped > 0 ? `${kept} kept, ${dropped} dropped` : `${kept} commits`
    if (!confirm(`Rewrite the last ${plan.length} commits (${summary})?\n\nThis rewrites history — avoid it on commits you've already pushed and shared.`))
      return
    await s.runRebase(isRoot ? null : base, plan)
  }

  if (!s.repo) return <div className="screen-empty">Open a repository to rebase.</div>

  return (
    <div className="rb-screen">
      <div className="rb-head">
        <div>
          <h2>Interactive rebase</h2>
          <p className="rb-sub">
            Reorder, squash, reword or drop your recent commits. They&rsquo;re applied top to
            bottom — drag to reorder.
          </p>
        </div>
        <div className="rb-head-actions">
          <label className="rb-count">
            Last
            <select
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value, 10))}
              disabled={!commits}
            >
              {Array.from({ length: Math.min(MAX, commits?.length ?? 0) }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                )
              )}
            </select>
            commits
          </label>
          <button className="btn" onClick={resetPlan} disabled={noop}>
            <Icon name="undo" size={13} /> Reset
          </button>
          <button className="btn primary" onClick={run} disabled={!canRun}>
            <Icon name="play" size={13} /> {s.busy ? 'Rebasing…' : 'Start rebase'}
          </button>
        </div>
      </div>

      {rebasing ? (
        <div className="rb-warn">
          <Icon name="warning" size={15} />
          <span>
            A rebase is already in progress. Finish or cancel it first —{' '}
            <button className="rb-link" onClick={() => s.setView('conflicts')}>
              go to it
            </button>
            .
          </span>
        </div>
      ) : dirty ? (
        <div className="rb-warn">
          <Icon name="warning" size={15} />
          <span>
            You have uncommitted changes. Commit or stash them before rebasing —{' '}
            <button className="rb-link" onClick={() => s.setView('stashes')}>
              stash them
            </button>
            .
          </span>
        </div>
      ) : null}

      {commits === null ? (
        <div className="side-empty">Loading commits…</div>
      ) : (
        <div className="rb-list">
          {plan.map((step, i) => {
            const c = byHash.get(step.hash)
            const merge = (c?.parents.length ?? 0) > 1
            return (
              <div
                key={step.hash}
                className={`rb-row ${step.action} ${overIndex === i ? 'over' : ''} ${
                  dragIndex === i ? 'dragging' : ''
                }`}
                draggable
                onDragStart={() => {
                  dragRef.current = i
                  setDragIndex(i)
                }}
                onDragEnd={() => {
                  dragRef.current = null
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOverIndex(i)
                }}
                onDrop={() => onDrop(i)}
              >
                <span className="rb-grip" title="Drag to reorder">
                  <Icon name="menu" size={14} />
                </span>
                <span className="rb-index">{i + 1}</span>

                <div className="rb-actions">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      className={`rb-act ${step.action === a.id ? 'on' : ''} act-${a.id}`}
                      title={a.hint}
                      onClick={() => setAction(i, a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>

                <span className="rb-hash mono">{shortHash(step.hash)}</span>
                <span className="rb-subject">
                  {step.subject || '(no message)'}
                  {merge && <span className="rb-merge-flag"> · merge commit</span>}
                </span>

                {step.action === 'reword' && (
                  <input
                    className="rb-msg"
                    autoFocus
                    value={step.message ?? ''}
                    placeholder="New commit message…"
                    onChange={(e) => setMessage(i, e.target.value)}
                    onDragStart={(e) => e.preventDefault()}
                    draggable={false}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="rb-foot">
        <span className={`rb-status ${invalid ? 'bad' : ''}`}>
          {invalid
            ? invalid
            : noop
              ? 'No changes yet — reorder a commit or pick an action.'
              : `Rewrites ${plan.length} commit${plan.length === 1 ? '' : 's'}${
                  isRoot ? ' (including the root commit)' : base ? ` onto ${shortHash(base)}` : ''
                }.`}
        </span>
      </div>
    </div>
  )
}
