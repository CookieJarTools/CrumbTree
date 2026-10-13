import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, type MenuItem } from '../store/store'
import { suggestPatterns } from '../lib/lfs-suggest'
import { filterPaths } from '../lib/search'
import { Resizer, useSize } from '../components/Resizer'
import { Icon } from '../components/ui/Icon'

export function LfsScreen() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      lfsStatus: st.lfsStatus,
      lfsRules: st.lfsRules,
      lfsFiles: st.lfsFiles,
      lfsTrackedFiles: st.lfsTrackedFiles,
      lfsLoading: st.lfsLoading,
      loadLfs: st.loadLfs,
      trackLfs: st.trackLfs,
      untrackLfs: st.untrackLfs,
      lfsSetup: st.lfsSetup,
      promptText: st.promptText,
      openMenu: st.openMenu
    }))
  )

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const rulesW = useSize('lfsRulesW', 340)

  useEffect(() => {
    s.loadLfs()
  }, [s.loadLfs, s.repo?.path])

  const filtered = useMemo(() => filterPaths(s.lfsFiles, query).slice(0, 500), [s.lfsFiles, query])
  const suggestions = useMemo(() => (selected ? suggestPatterns(selected) : []), [selected])
  const trackedSet = useMemo(() => new Set(s.lfsRules.map((r) => r.pattern)), [s.lfsRules])

  const confirmTrack = async (pattern: string) => {
    if (trackedSet.has(pattern)) return
    const yes = await s.promptText({
      title: 'Track in Git LFS?',
      message: `Files matching “${pattern}” will be stored in Git LFS from now on.`,
      confirmOnly: true,
      confirmText: 'Track'
    })
    if (yes) s.trackLfs(pattern)
  }

  const confirmUntrack = async (pattern: string) => {
    const yes = await s.promptText({
      title: 'Stop tracking?',
      message: `Remove the LFS rule “${pattern}”? Existing committed files stay in LFS; new matching files won’t be added.`,
      confirmOnly: true,
      danger: true,
      confirmText: 'Remove'
    })
    if (yes) s.untrackLfs(pattern)
  }

  const fileMenu = (file: string): MenuItem[] => [
    { type: 'header', label: 'Track in LFS' },
    ...suggestPatterns(file).map(
      (sg): MenuItem => ({
        label: sg.label,
        icon: trackedSet.has(sg.pattern) ? 'check' : 'plus',
        disabled: trackedSet.has(sg.pattern),
        onSelect: () => confirmTrack(sg.pattern)
      })
    )
  ]

  if (!s.lfsStatus) {
    return <div className="diff-empty">{s.lfsLoading ? 'Checking Git LFS…' : 'Open a repository.'}</div>
  }

  // git-lfs not installed on the machine.
  if (!s.lfsStatus.installed) {
    return (
      <div className="lfs-screen">
        <div className="lfs-missing">
          <div className="stub-icon">
            <Icon name="database" size={28} />
          </div>
          <h2>Git LFS isn’t installed</h2>
          <p>
            Large File Storage keeps big binaries (art, textures, audio, video) out of your main
            history so the repo stays fast. Install <span className="mono">git-lfs</span> and reopen
            this repository to manage tracking rules here.
          </p>
          <span className="mono lfs-install-hint">winget install GitHub.GitLFS</span>
        </div>
      </div>
    )
  }

  // Installed, but this repo isn't set up for LFS yet — offer setup before listing files.
  if (!s.lfsStatus.initialized) {
    return (
      <div className="lfs-screen">
        <div className="lfs-missing">
          <div className="stub-icon">
            <Icon name="database" size={28} />
          </div>
          <h2>Set up Git LFS for this repository</h2>
          <p>
            This repository doesn’t use Git LFS yet. Setting it up installs the LFS hooks so large
            files you choose to track are stored efficiently.
          </p>
          <button className="lfs-setup-btn" onClick={() => s.lfsSetup()}>
            <Icon name="database" size={15} /> Set up Git LFS
          </button>
          <span className="lfs-setup-note mono">runs: git lfs install --local</span>
        </div>
      </div>
    )
  }

  return (
    <div className="lfs-screen">
      <div className="lfs-head">
        <div>
          <h2>Git LFS</h2>
          <p className="lfs-sub">
            Store big files efficiently. Pick a file, then choose how to track it.
          </p>
        </div>
        <span className="lfs-status-chip">
          <span className="ref-dot" /> git-lfs {s.lfsStatus.version} · {s.lfsTrackedFiles.length} file
          {s.lfsTrackedFiles.length === 1 ? '' : 's'} in LFS
        </span>
      </div>

      <div className="lfs-body">
        <div className="lfs-add">
          <div className="lfs-section-title">Add a rule</div>
          <div className="lfs-search">
            <Icon name="search" size={15} />
            <input
              value={query}
              placeholder="Find a file or folder…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="lfs-filelist">
            {filtered.map((f) => (
              <button
                key={f}
                className={`lfs-file ${selected === f ? 'active' : ''}`}
                onClick={() => setSelected(f)}
                onDoubleClick={() => {
                  const first = suggestPatterns(f)[0]
                  if (first) confirmTrack(first.pattern)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setSelected(f)
                  s.openMenu(e.clientX, e.clientY, fileMenu(f))
                }}
                title={`${f}\nClick to see options · double-click to track just this file · right-click for all options`}
              >
                <Icon name="folder" size={13} />
                <span className="lfs-file-path">{f}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="side-empty">No matching files.</div>}
          </div>

          {selected && (
            <div className="lfs-suggest">
              <div className="lfs-suggest-head">
                Track <span className="mono">{selected}</span> as…
              </div>
              <div className="lfs-chips">
                {suggestions.map((sg) => {
                  const already = trackedSet.has(sg.pattern)
                  return (
                    <button
                      key={sg.pattern}
                      className={`lfs-chip ${already ? 'done' : ''}`}
                      disabled={already}
                      onClick={() => confirmTrack(sg.pattern)}
                      title={sg.hint}
                    >
                      <Icon name={already ? 'check' : 'plus'} size={12} />
                      <span className="lfs-chip-label">{sg.label}</span>
                      <span className="lfs-chip-pattern mono">{sg.pattern}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="lfs-custom">
            <input
              value={custom}
              placeholder="Custom pattern, e.g. *.blend"
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && custom.trim()) {
                  confirmTrack(custom.trim())
                  setCustom('')
                }
              }}
            />
            <button
              className="mini-btn"
              disabled={!custom.trim()}
              onClick={() => {
                confirmTrack(custom.trim())
                setCustom('')
              }}
            >
              Track
            </button>
          </div>
        </div>

        <Resizer axis="x" sizeKey="lfsRulesW" def={340} min={220} max={640} dir={-1} />

        <div className="lfs-rules" style={{ width: rulesW }}>
          <div className="lfs-section-title">
            Tracked patterns <span className="side-count">{s.lfsRules.length}</span>
          </div>
          <div className="lfs-rulelist">
            {s.lfsRules.map((r) => (
              <div key={r.pattern} className="lfs-rule">
                <Icon name="database" size={13} />
                <span className="mono lfs-rule-pattern" title={r.pattern}>
                  {r.pattern}
                </span>
                <button
                  className="lfs-remove"
                  onClick={() => confirmUntrack(r.pattern)}
                  title="Stop tracking this pattern"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
            {s.lfsRules.length === 0 && (
              <div className="side-empty">No LFS rules yet. Pick a file on the left to add one.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
