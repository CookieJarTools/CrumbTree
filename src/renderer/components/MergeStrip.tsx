import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { Icon } from './ui/Icon'

/** A persistent strip shown while a merge/rebase is in progress and you've navigated away. */
export function MergeStrip() {
  const { mergeState, view, setView, abortMerge, continueMerge } = useStore(
    useShallow((s) => ({
      mergeState: s.mergeState,
      view: s.view,
      setView: s.setView,
      abortMerge: s.abortMerge,
      continueMerge: s.continueMerge
    }))
  )
  if (!mergeState?.inProgress || view === 'conflicts') return null
  const n = mergeState.conflicted.length
  const isRebase = mergeState.kind === 'rebase'
  const verb = isRebase ? 'rebase' : 'merge'

  return (
    <div className="merge-strip">
      <Icon name="warning" size={14} />
      <span>
        A {verb} is in progress
        {n > 0
          ? ` — ${n} conflict${n === 1 ? '' : 's'} to resolve (here or in your editor)`
          : ' — conflicts resolved, ready to finish'}
        .
      </span>
      <div className="topbar-spacer" />
      <button className="tb-btn" onClick={() => abortMerge()}>
        Abort
      </button>
      {n > 0 && (
        <button className="tb-btn" onClick={() => setView('conflicts')}>
          Resolve here
        </button>
      )}
      {/* Continue re-checks state, so it works after resolving externally in Rider etc. */}
      <button className="tb-btn accent" onClick={() => continueMerge()}>
        {n > 0 ? 'Continue' : 'Finish'}
      </button>
    </div>
  )
}
