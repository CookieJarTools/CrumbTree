import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DiffHunk, FileDiff } from '@shared/types'
import { useStore } from '../store/store'
import { buildHunkPatch } from '../lib/patch'
import { Icon } from './ui/Icon'

function UnifiedHunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      {hunk.lines.map((l, i) => (
        <div key={i} className={`dl ${l.type}`}>
          <span className="ln">{l.oldLineNo ?? ''}</span>
          <span className="ln">{l.newLineNo ?? ''}</span>
          <span className="dc">
            <span className="sign">{l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}</span>
            {l.content}
          </span>
        </div>
      ))}
    </>
  )
}

function SplitHunk({ hunk }: { hunk: DiffHunk }) {
  // Pair del/add lines side by side; context spans both columns.
  const rows: { left?: (typeof hunk.lines)[0]; right?: (typeof hunk.lines)[0] }[] = []
  let i = 0
  while (i < hunk.lines.length) {
    const l = hunk.lines[i]
    if (l.type === 'context') {
      rows.push({ left: l, right: l })
      i++
    } else {
      const dels: (typeof hunk.lines)[0][] = []
      const adds: (typeof hunk.lines)[0][] = []
      while (i < hunk.lines.length && hunk.lines[i].type === 'del') dels.push(hunk.lines[i++])
      while (i < hunk.lines.length && hunk.lines[i].type === 'add') adds.push(hunk.lines[i++])
      const n = Math.max(dels.length, adds.length)
      for (let k = 0; k < n; k++) rows.push({ left: dels[k], right: adds[k] })
    }
  }
  return (
    <>
      {rows.map((r, idx) => (
        <div key={idx} className="dl-split">
          <span className="ln">{r.left?.oldLineNo ?? ''}</span>
          <span className={`dc half ${r.left ? r.left.type : 'empty'}`}>{r.left?.content ?? ''}</span>
          <span className="ln">{r.right?.newLineNo ?? ''}</span>
          <span className={`dc half ${r.right ? r.right.type : 'empty'}`}>{r.right?.content ?? ''}</span>
        </div>
      ))}
    </>
  )
}

export function DiffView() {
  const { diff, mode, setMode, selectedFile, status, stagePatch, diffLoading, openFileHistory } =
    useStore(
      useShallow((s) => ({
        diff: s.diff,
        mode: s.diffMode,
        setMode: s.setDiffMode,
        selectedFile: s.selectedFile,
        status: s.status,
        stagePatch: s.stagePatch,
        diffLoading: s.diffLoading,
        openFileHistory: s.openFileHistory
      }))
    )

  const isUntracked = useMemo(() => {
    if (!selectedFile || !status) return false
    return status.unstaged.some((f) => f.path === selectedFile.file && f.type === 'untracked')
  }, [selectedFile, status])

  const canStageHunks = !!selectedFile && !selectedFile.commitHash && !isUntracked

  if (diffLoading) return <div className="diff-empty">Loading diff…</div>
  if (!selectedFile) return <div className="diff-empty">Select a file to view its changes.</div>
  if (!diff) return <div className="diff-empty">No diff available.</div>

  const stat = diffStat(diff)

  const applyHunk = (hunk: DiffHunk) => {
    const patch = buildHunkPatch(diff, hunk)
    // If the file is staged, applying a hunk means removing it from the index.
    stagePatch(patch, !!selectedFile.staged)
  }

  return (
    <div className="diff-view">
      <div className="diff-toolbar">
        <span className="diff-path mono">{diff.path}</span>
        <span className="diff-stat">
          <span className="add">+{stat.add}</span>
          <span className="del">−{stat.del}</span>
        </span>
        <div className="diff-toolbar-spacer" />
        <button
          className="diff-history-btn"
          onClick={() => openFileHistory(selectedFile.file)}
          title="Show this file's history"
        >
          <Icon name="history" size={13} /> History
        </button>
        <div className="seg">
          <button className={mode === 'split' ? 'on' : ''} onClick={() => setMode('split')}>
            Split
          </button>
          <button className={mode === 'unified' ? 'on' : ''} onClick={() => setMode('unified')}>
            Unified
          </button>
        </div>
      </div>

      <div className="diff-body mono">
        {diff.binary ? (
          <div className="diff-empty">Binary file — no textual diff.</div>
        ) : diff.hunks.length === 0 ? (
          <div className="diff-empty">No changes to display.</div>
        ) : (
          diff.hunks.map((hunk, hi) => (
            <div key={hi} className="hunk">
              <div className="hunk-head">
                <span className="hunk-info">{hunk.header}</span>
                {canStageHunks && (
                  <button className="hunk-btn" onClick={() => applyHunk(hunk)}>
                    <Icon name={selectedFile.staged ? 'minus' : 'plus'} size={12} />
                    {selectedFile.staged ? 'Unstage hunk' : 'Stage hunk'}
                  </button>
                )}
              </div>
              {mode === 'split' ? <SplitHunk hunk={hunk} /> : <UnifiedHunk hunk={hunk} />}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function diffStat(diff: FileDiff): { add: number; del: number } {
  let add = 0
  let del = 0
  for (const h of diff.hunks)
    for (const l of h.lines) {
      if (l.type === 'add') add++
      else if (l.type === 'del') del++
    }
  return { add, del }
}
