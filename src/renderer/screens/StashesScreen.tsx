import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { FileChangeType, FileDiff, FileStatus } from '@shared/types'
import { useStore, type MenuItem } from '../store/store'
import { crumb, unwrap } from '../lib/api'
import { relativeTime } from '../lib/format'
import { Resizer, useSize } from '../components/Resizer'
import { DiffBody } from '../components/DiffBody'
import { Icon } from '../components/ui/Icon'

const TYPE_MARK: Record<FileChangeType, { m: string; cls: string }> = {
  added: { m: 'A', cls: 'add' },
  modified: { m: 'M', cls: 'mod' },
  deleted: { m: 'D', cls: 'del' },
  renamed: { m: 'R', cls: 'mod' },
  untracked: { m: 'U', cls: 'add' },
  conflicted: { m: '!', cls: 'del' }
}

export function StashesScreen() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      stashes: st.stashes,
      status: st.status,
      busy: st.busy,
      createStash: st.createStash,
      applyStash: st.applyStash,
      popStash: st.popStash,
      dropStash: st.dropStash,
      loadStashes: st.loadStashes,
      promptText: st.promptText,
      openMenu: st.openMenu
    }))
  )

  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [files, setFiles] = useState<FileStatus[] | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const listW = useSize('stashListW', 340)

  useEffect(() => {
    s.loadStashes()
  }, [s.loadStashes, s.repo?.path])

  // Keep a valid selection as the list changes.
  useEffect(() => {
    if (s.stashes.length === 0) {
      setSelectedRef(null)
      return
    }
    if (!selectedRef || !s.stashes.some((x) => x.ref === selectedRef)) {
      setSelectedRef(s.stashes[0].ref)
    }
  }, [s.stashes, selectedRef])

  // Load the selected stash's files.
  useEffect(() => {
    if (!selectedRef || !s.repo) {
      setFiles(null)
      setSelectedFile(null)
      return
    }
    let cancelled = false
    setFiles(null)
    setSelectedFile(null)
    setDiff(null)
    unwrap(crumb.stashFiles(s.repo.path, selectedRef)).then((f) => {
      if (cancelled) return
      setFiles(f)
      setSelectedFile(f[0]?.path ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [selectedRef, s.repo])

  // Load the selected file's diff.
  useEffect(() => {
    if (!selectedRef || !selectedFile || !s.repo) {
      setDiff(null)
      return
    }
    let cancelled = false
    setDiff(null)
    unwrap(crumb.stashDiff(s.repo.path, selectedRef, selectedFile)).then(
      (d) => !cancelled && setDiff(d)
    )
    return () => {
      cancelled = true
    }
  }, [selectedRef, selectedFile, s.repo])

  const hasChanges = useMemo(
    () =>
      !!s.status &&
      s.status.staged.length + s.status.unstaged.length + s.status.conflicted.length > 0,
    [s.status]
  )

  const onStash = async () => {
    const msg = await s.promptText({
      title: 'Stash changes',
      message: 'Save your working changes aside. Add an optional note to find it later.',
      placeholder: 'Optional message…',
      allowEmpty: true,
      confirmText: 'Stash'
    })
    if (msg === null) return
    await s.createStash(msg, true)
  }

  const stashMenu = (e: React.MouseEvent, ref: string) => {
    e.preventDefault()
    const items: MenuItem[] = [
      { label: 'Apply (keep stash)', onSelect: () => s.applyStash(ref) },
      { label: 'Pop (apply & remove)', onSelect: () => s.popStash(ref) },
      { label: 'Drop (delete)', danger: true, onSelect: () => s.dropStash(ref) }
    ]
    s.openMenu(e.clientX, e.clientY, items)
  }

  if (!s.repo) return <div className="screen-empty">Open a repository to manage stashes.</div>

  const busy = s.busy === 'stash'

  return (
    <div className="stash-screen">
      <div className="stash-list" style={{ width: listW }}>
        <div className="stash-list-head">
          <span className="side-title">Stashes</span>
          <button className="btn primary sm" onClick={onStash} disabled={busy || !hasChanges}
            title={hasChanges ? 'Stash your working changes' : 'No changes to stash'}>
            <Icon name="plus" size={13} /> Stash changes
          </button>
        </div>

        <div className="stash-items">
          {s.stashes.length === 0 && (
            <div className="side-empty">
              No stashes yet. Use “Stash changes” to set your work aside without committing.
            </div>
          )}
          {s.stashes.map((st) => (
            <button
              key={st.ref}
              className={`stash-item ${selectedRef === st.ref ? 'active' : ''}`}
              onClick={() => setSelectedRef(st.ref)}
              onContextMenu={(e) => stashMenu(e, st.ref)}
            >
              <Icon name="stash" size={15} className="stash-item-icon" />
              <span className="stash-item-text">
                <span className="stash-item-msg">{st.message}</span>
                <span className="stash-item-meta">
                  <span className="mono">{st.ref}</span>
                  {st.branch && (
                    <>
                      {' · on '}
                      <span className="stash-item-branch">{st.branch}</span>
                    </>
                  )}
                  {st.timestamp ? ` · ${relativeTime(st.timestamp)}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Resizer axis="x" sizeKey="stashListW" def={340} min={240} max={560} dir={1} />

      <div className="stash-detail">
        {!selectedRef ? (
          <div className="diff-empty">Select a stash to see what’s inside it.</div>
        ) : (
          <>
            <div className="stash-detail-head">
              <div className="stash-actions">
                <button className="btn sm" disabled={busy} onClick={() => s.applyStash(selectedRef)}>
                  Apply
                </button>
                <button className="btn sm" disabled={busy} onClick={() => s.popStash(selectedRef)}>
                  Pop
                </button>
                <button
                  className="btn sm danger"
                  disabled={busy}
                  onClick={() => s.dropStash(selectedRef)}
                >
                  Drop
                </button>
              </div>
            </div>

            <div className="stash-detail-body">
              <div className="stash-files">
                {files === null && <div className="side-empty">Loading…</div>}
                {files?.length === 0 && <div className="side-empty">No files in this stash.</div>}
                {files?.map((f) => {
                  const t = TYPE_MARK[f.type]
                  return (
                    <button
                      key={f.path}
                      className={`file-row ${selectedFile === f.path ? 'active' : ''}`}
                      onClick={() => setSelectedFile(f.path)}
                      title={f.path}
                    >
                      <span className={`ft ${t.cls}`}>{t.m}</span>
                      <span className="file-path">
                        {f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="stash-diff">
                {selectedFile ? (
                  <DiffBody diff={diff} empty="No textual changes." />
                ) : (
                  <div className="diff-empty">Select a file.</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
