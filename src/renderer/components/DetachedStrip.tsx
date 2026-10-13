import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { shortHash } from '../lib/format'
import { Icon } from './ui/Icon'

/**
 * Detached HEAD is the one state where committing quietly loses work, so say so
 * plainly and keep the way out one click away.
 */
export function DetachedStrip() {
  const { repo, refs, branchHere, checkout } = useStore(
    useShallow((s) => ({
      repo: s.repo,
      refs: s.refs,
      branchHere: s.branchHere,
      checkout: s.checkout
    }))
  )

  const home = useMemo(() => {
    const local = refs.filter((r) => r.type === 'localBranch')
    return (
      local.find((r) => r.name === 'main') ??
      local.find((r) => r.name === 'master') ??
      local[0] ??
      null
    )
  }, [refs])

  if (!repo?.head.detached) return null

  const leave = (): void => {
    if (!home) return
    const ok = confirm(
      `Go back to ${home.name}?\n\nAny commits you made here aren't on a branch yet — they'll be left behind. Use "Create branch here" first if you want to keep them.`
    )
    if (ok) checkout(home.name)
  }

  return (
    <div className="detached-strip">
      <Icon name="warning" size={14} />
      <span>
        You&rsquo;re not on a branch — HEAD is detached at{' '}
        <span className="mono">{shortHash(repo.head.hash ?? '')}</span>. Commits made here
        won&rsquo;t belong to any branch and can&rsquo;t be pushed.
      </span>
      <div className="topbar-spacer" />
      {home && (
        <button className="tb-btn" onClick={leave}>
          Back to {home.name}
        </button>
      )}
      <button className="tb-btn accent" onClick={() => branchHere()}>
        Create branch here
      </button>
    </div>
  )
}
