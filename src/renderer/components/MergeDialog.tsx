import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { MergeStrategy } from '@shared/types'
import { useStore } from '../store/store'
import { Icon } from './ui/Icon'

interface Choice {
  key: MergeStrategy
  title: string
  desc: (source: string, current: string) => string
}

const CHOICES: Choice[] = [
  {
    key: 'merge',
    title: 'Merge commit',
    desc: (s, c) => `Combine ${s} into ${c} and record it with a merge commit.`
  },
  {
    key: 'ff',
    title: 'Fast-forward when possible',
    desc: (_s, c) => `Move ${c} straight forward if it can; otherwise make a merge commit.`
  },
  {
    key: 'squash',
    title: 'Squash',
    desc: (s) => `Combine all of ${s}'s changes into a single new commit.`
  },
  {
    key: 'rebase',
    title: 'Rebase',
    desc: (s, c) => `Replay ${c}'s commits on top of ${s} for a straight-line history.`
  }
]

export function MergeDialog() {
  const { dialog, close, mergeInto, current, busy } = useStore(
    useShallow((s) => ({
      dialog: s.mergeDialog,
      close: s.closeMergeDialog,
      mergeInto: s.mergeInto,
      current: s.repo?.head.branch ?? 'current',
      busy: s.busy
    }))
  )
  const [strategy, setStrategy] = useState<MergeStrategy>('merge')

  if (!dialog) return null
  const source = dialog.source
  const chosen = CHOICES.find((c) => c.key === strategy)!

  return (
    <div className="prompt-overlay" onClick={close}>
      <div className="merge-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="merge-head">
          <div className="merge-title">
            <Icon name="merge" size={17} />
            Merge <span className="mono">{source}</span> into <span className="mono">{current}</span>
          </div>
          <button className="studio-step-close" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="merge-choices">
          {CHOICES.map((c) => (
            <button
              key={c.key}
              className={`merge-choice ${strategy === c.key ? 'on' : ''}`}
              onClick={() => setStrategy(c.key)}
            >
              <span className="merge-radio">{strategy === c.key && <span className="merge-radio-dot" />}</span>
              <span className="merge-choice-text">
                <span className="merge-choice-title">{c.title}</span>
                <span className="merge-choice-desc">{c.desc(source, current)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="merge-foot">
          <span className="merge-summary">{chosen.desc(source, current)}</span>
          <div className="nr-actions">
            <button className="prompt-cancel" onClick={close}>
              Cancel
            </button>
            <button className="prompt-ok" disabled={!!busy} onClick={() => mergeInto(source, strategy)}>
              {busy ? 'Merging…' : 'Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
