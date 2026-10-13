import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { crumb, unwrap } from '../lib/api'
import {
  assembleLines,
  conflictCount,
  parseConflicts,
  type ConflictChoice,
  type Segment
} from '../lib/conflict-parse'
import { Icon } from '../components/ui/Icon'

export function ConflictsScreen() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      mergeState: st.mergeState,
      resolveConflictFile: st.resolveConflictFile,
      useConflictSide: st.useConflictSide,
      continueMerge: st.continueMerge,
      abortMerge: st.abortMerge,
      busy: st.busy
    }))
  )

  const conflicted = s.mergeState?.conflicted ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [choices, setChoices] = useState<ConflictChoice[]>([])
  const [binary, setBinary] = useState(false)
  // Manual edit mode: null = using the chunk picker; string = hand-edited text.
  const [edited, setEdited] = useState<string | null>(null)

  // Keep a valid selection as files get resolved.
  useEffect(() => {
    if (conflicted.length === 0) {
      setSelected(null)
      return
    }
    if (!selected || !conflicted.some((f) => f.path === selected)) {
      setSelected(conflicted[0].path)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.mergeState])

  // Load and parse the selected file.
  useEffect(() => {
    if (!selected || !s.repo) return
    let cancelled = false
    setEdited(null)
    unwrap(crumb.conflictRead(s.repo.path, selected)).then((text) => {
      if (cancelled) return
      const segs = parseConflicts(text)
      const n = conflictCount(segs)
      setBinary(n === 0)
      setSegments(segs)
      setChoices(Array(n).fill('ours'))
    })
    return () => {
      cancelled = true
    }
  }, [selected, s.repo])

  const blocks = useMemo(() => segments.filter((seg) => seg.type === 'conflict'), [segments])
  const previewLines = useMemo(() => assembleLines(segments, choices), [segments, choices])
  const preview = useMemo(() => previewLines.map((l) => l.text).join('\n'), [previewLines])

  if (!s.mergeState) {
    return <div className="diff-empty">No merge in progress.</div>
  }

  const editing = edited !== null
  const resultText = editing ? edited : preview

  const setChoice = (i: number, choice: ConflictChoice) =>
    setChoices((c) => c.map((x, idx) => (idx === i ? choice : x)))

  const markResolved = () => {
    if (selected) s.resolveConflictFile(selected, resultText)
  }

  return (
    <div className="conflicts-screen">
      <div className="conflicts-bar">
        <Icon name="merge" size={15} />
        <span>
          Merging <strong>{s.mergeState.source ?? 'a branch'}</strong> —{' '}
          {conflicted.length === 0
            ? 'all conflicts resolved'
            : `${conflicted.length} file${conflicted.length === 1 ? '' : 's'} left`}
        </span>
        <div className="topbar-spacer" />
        <button className="tb-btn" onClick={() => s.abortMerge()}>
          <Icon name="close" size={14} /> Abort
        </button>
        <button
          className="tb-btn accent"
          disabled={conflicted.length > 0 || !!s.busy}
          onClick={() => s.continueMerge()}
        >
          <Icon name="check" size={14} /> Continue
        </button>
      </div>

      <div className="conflicts-body">
        <div className="conflicts-files">
          <div className="stage-head">
            <span>Conflicted files</span>
            <span className="side-count">{conflicted.length}</span>
          </div>
          <div className="conflicts-filelist">
            {conflicted.map((f) => (
              <button
                key={f.path}
                className={`file-row ${selected === f.path ? 'active' : ''}`}
                onClick={() => setSelected(f.path)}
                title={f.path}
              >
                <span className="ft confl">!</span>
                <span className="file-path">{f.path}</span>
              </button>
            ))}
            {conflicted.length === 0 && (
              <div className="side-empty">All resolved — click Continue above.</div>
            )}
          </div>
        </div>

        <div className="conflicts-resolve">
          {!selected ? (
            <div className="diff-empty">Select a file to resolve its conflicts.</div>
          ) : binary ? (
            <div className="conflicts-binary">
              <p>This file can’t be resolved chunk-by-chunk. Pick a whole side:</p>
              <div className="conflicts-whole">
                <button className="tb-btn" onClick={() => selected && s.useConflictSide(selected, 'ours')}>
                  Use ours (this branch)
                </button>
                <button className="tb-btn" onClick={() => selected && s.useConflictSide(selected, 'theirs')}>
                  Use theirs (incoming)
                </button>
              </div>
            </div>
          ) : editing ? (
            <>
              <div className="conflicts-toolbar">
                <span className="mono conflicts-path">{selected}</span>
                <span className="conflicts-editing-tag">editing manually</span>
                <div className="topbar-spacer" />
                <button
                  className="mini-btn"
                  onClick={() => setEdited(null)}
                  disabled={blocks.length === 0}
                  title={blocks.length === 0 ? 'No chunks to pick from' : 'Discard manual edits'}
                >
                  Back to chunk picker
                </button>
              </div>
              <div className="conflicts-editwrap">
                <textarea
                  className="conflicts-editor mono"
                  value={edited ?? ''}
                  spellCheck={false}
                  onChange={(e) => setEdited(e.target.value)}
                />
              </div>
              <div className="conflicts-actions">
                <button className="commit-btn" onClick={markResolved}>
                  <Icon name="check" size={14} /> Mark resolved
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="conflicts-toolbar">
                <span className="mono conflicts-path">{selected}</span>
                <div className="topbar-spacer" />
                <button className="mini-btn" onClick={() => setEdited(preview)} title="Hand-edit the merged result">
                  <Icon name="rename" size={12} /> Edit manually
                </button>
                <span className="conflicts-whole-label">Whole file:</span>
                <button className="mini-btn" onClick={() => setChoices(choices.map(() => 'ours'))}>
                  Ours
                </button>
                <button className="mini-btn" onClick={() => setChoices(choices.map(() => 'theirs'))}>
                  Theirs
                </button>
              </div>

              <div className="conflicts-blocks">
                {blocks.map((seg, i) => {
                  if (seg.type !== 'conflict') return null
                  const choice = choices[i]
                  return (
                    <div key={i} className="conflict-block">
                      <div className="conflict-block-head">
                        <span>Conflict {i + 1}</span>
                        <div className="conflict-picks">
                          {(['ours', 'theirs', 'both'] as ConflictChoice[]).map((k) => (
                            <button
                              key={k}
                              className={`conflict-pick ${choice === k ? 'on' : ''}`}
                              onClick={() => setChoice(i, k)}
                            >
                              {k === 'ours' ? 'Use ours' : k === 'theirs' ? 'Use theirs' : 'Keep both'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="conflict-sides mono">
                        <div className={`conflict-side ours ${choice === 'theirs' ? 'off' : ''}`}>
                          <div className="conflict-side-label">Ours (this branch)</div>
                          {seg.ours.map((l, k) => (
                            <div key={k} className="conflict-line">
                              {l || ' '}
                            </div>
                          ))}
                        </div>
                        <div className={`conflict-side theirs ${choice === 'ours' ? 'off' : ''}`}>
                          <div className="conflict-side-label">Theirs (incoming)</div>
                          {seg.theirs.map((l, k) => (
                            <div key={k} className="conflict-line">
                              {l || ' '}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="conflicts-preview">
                <div className="conflicts-preview-head">
                  Result preview
                  <span className="conflicts-preview-key">
                    <span className="key-swatch ours" /> from ours
                    <span className="key-swatch theirs" /> from theirs
                  </span>
                </div>
                <div className="conflicts-preview-body mono">
                  {previewLines.map((l, i) => (
                    <div key={i} className={`conflicts-preview-line ${l.origin}`}>
                      {l.text || ' '}
                    </div>
                  ))}
                </div>
              </div>

              <div className="conflicts-actions">
                <button className="commit-btn" onClick={markResolved}>
                  <Icon name="check" size={14} /> Mark resolved
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
