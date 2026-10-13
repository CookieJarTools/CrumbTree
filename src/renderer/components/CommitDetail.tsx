import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { avatarHue, initials, relativeTime, shortHash } from '../lib/format'
import { Icon } from './ui/Icon'
import type { FileChangeType } from '@shared/types'

const TYPE_MARK: Record<FileChangeType, { m: string; cls: string }> = {
  added: { m: 'A', cls: 'add' },
  modified: { m: 'M', cls: 'mod' },
  deleted: { m: 'D', cls: 'del' },
  renamed: { m: 'R', cls: 'mod' },
  untracked: { m: 'U', cls: 'add' },
  conflicted: { m: '!', cls: 'del' }
}

export function CommitDetail() {
  const { selectedHash, commits, commitFiles, selectCommitFile, selectedFile, openMenu, openFileHistory, copy } =
    useStore(
      useShallow((s) => ({
        selectedHash: s.selectedHash,
        commits: s.commits,
        commitFiles: s.commitFiles,
        selectCommitFile: s.selectCommitFile,
        selectedFile: s.selectedFile,
        openMenu: s.openMenu,
        openFileHistory: s.openFileHistory,
        copy: s.copy
      }))
    )

  const commit = useMemo(
    () => commits.find((c) => c.hash === selectedHash) ?? null,
    [commits, selectedHash]
  )

  if (!commit) {
    return (
      <div className="detail-empty">
        <Icon name="commit" size={26} />
        <p>Select a commit to see its details.</p>
      </div>
    )
  }

  const hue = avatarHue(commit.authorEmail || commit.authorName)

  return (
    <div className="commit-detail">
      <div className="detail-head">
        <div className="detail-subject">{commit.subject}</div>
        <div className="detail-meta">
          <span className="avatar" style={{ background: `hsl(${hue} 45% 34%)` }}>
            {initials(commit.authorName)}
          </span>
          <span className="detail-author">{commit.authorName}</span>
          <span className="detail-sep">·</span>
          <span className="detail-time">{relativeTime(commit.timestamp)}</span>
          <span className="detail-sep">·</span>
          <span className="mono detail-hash">{shortHash(commit.hash)}</span>
        </div>
        {commit.parents.length > 1 && (
          <div className="detail-parents">
            <Icon name="merge" size={12} /> Merge of {commit.parents.length} parents
          </div>
        )}
      </div>

      <div className="detail-files-head">
        <span>Changed files</span>
        <span className="side-count">{commitFiles.length}</span>
      </div>
      <div className="detail-files">
        {commitFiles.map((f) => {
          const t = TYPE_MARK[f.type]
          const active = selectedFile?.file === f.path && selectedFile?.commitHash === commit.hash
          return (
            <button
              key={f.path}
              className={`file-row ${active ? 'active' : ''}`}
              onClick={() => selectCommitFile(f.path, commit.hash)}
              onContextMenu={(e) => {
                e.preventDefault()
                openMenu(e.clientX, e.clientY, [
                  { label: 'View file history', icon: 'history', onSelect: () => openFileHistory(f.path) },
                  { label: 'Copy path', icon: 'copy', onSelect: () => copy(f.path, 'path') }
                ])
              }}
              title={f.path}
            >
              <span className={`ft ${t.cls}`}>{t.m}</span>
              <span className="file-path">{f.oldPath ? `${f.oldPath} → ${f.path}` : f.path}</span>
            </button>
          )
        })}
        {commitFiles.length === 0 && <div className="side-empty">No file changes.</div>}
      </div>
    </div>
  )
}
