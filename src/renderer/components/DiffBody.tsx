import type { FileDiff } from '@shared/types'

/** Read-only unified-diff renderer shared by the file-history and stash views. */
export function DiffBody({
  diff,
  empty = 'No changes.'
}: {
  diff: FileDiff | null
  empty?: string
}) {
  if (!diff) return <div className="diff-empty">Loading diff…</div>
  if (diff.binary) return <div className="diff-empty">Binary file — no textual diff.</div>
  if (diff.hunks.length === 0) return <div className="diff-empty">{empty}</div>
  return (
    <div className="diff-body mono">
      {diff.hunks.map((h, hi) => (
        <div key={hi} className="hunk">
          <div className="hunk-head">
            <span className="hunk-info">{h.header}</span>
          </div>
          {h.lines.map((l, i) => (
            <div key={i} className={`dl ${l.type}`}>
              <span className="ln">{l.oldLineNo ?? ''}</span>
              <span className="ln">{l.newLineNo ?? ''}</span>
              <span className="dc">
                <span className="sign">
                  {l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}
                </span>
                {l.content}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
