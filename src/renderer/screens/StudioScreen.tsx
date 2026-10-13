import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { FileChangeType } from '@shared/types'
import { useStore, type MenuItem, type StudioResult } from '../store/store'
import { filterRefs } from '../lib/search'
import { isBaseBranch } from '../lib/refs'
import { Resizer, useSize } from '../components/Resizer'
import { DiffView } from '../components/DiffView'
import { Icon } from '../components/ui/Icon'

const CHANGE_LABEL: Record<FileChangeType, { label: string; cls: string }> = {
  added: { label: 'New', cls: 'add' },
  untracked: { label: 'New', cls: 'add' },
  modified: { label: 'Edited', cls: 'mod' },
  renamed: { label: 'Renamed', cls: 'mod' },
  deleted: { label: 'Deleted', cls: 'del' },
  conflicted: { label: 'Needs fixing', cls: 'del' }
}

type StepKey = 'pull' | 'branch' | 'save' | 'finish'
type IconName = Parameters<typeof Icon>[0]['name']

interface ActionDef {
  key: StepKey
  icon: IconName
  title: string
  subtitle: string
  blurb: string
  cta: string
  needsInput?: 'branch' | 'message'
  inputLabel?: string
  placeholder?: string
}

const ACTIONS: ActionDef[] = [
  {
    key: 'pull',
    icon: 'download',
    title: 'Get the latest',
    subtitle: "Everyone else's newest changes",
    blurb: "Bring in everyone else's newest changes so you're up to date.",
    cta: 'Get the latest'
  },
  {
    key: 'branch',
    icon: 'sparkle',
    title: 'Start new work',
    subtitle: 'A fresh space for your changes',
    blurb: 'Make a fresh space so your changes stay separate until they’re finished.',
    cta: 'Start working',
    needsInput: 'branch',
    inputLabel: 'What are you working on?',
    placeholder: 'e.g. new character textures'
  },
  {
    key: 'save',
    icon: 'upload',
    title: 'Save my work',
    subtitle: 'Save and upload your changes',
    blurb: 'Save what you changed and upload it so it’s backed up and your team can see it.',
    cta: 'Save & upload',
    needsInput: 'message',
    inputLabel: 'What did you change?',
    placeholder: 'e.g. repainted the armour'
  },
  {
    key: 'finish',
    icon: 'flag',
    title: 'Send for review',
    subtitle: 'Ask a teammate to add your work',
    blurb: 'Open a pull request so a teammate can review your work and add it to the main project. This never changes the project by itself.',
    cta: 'Create pull request'
  }
]

export function StudioScreen() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      status: st.status,
      refs: st.refs,
      busy: st.busy,
      setNoobMode: st.setNoobMode,
      checkout: st.checkout,
      studioPull: st.studioPull,
      studioNewBranch: st.studioNewBranch,
      studioSave: st.studioSave,
      studioFinish: st.studioFinish,
      pollUpdates: st.pollUpdates,
      installGithubCli: st.installGithubCli,
      githubSignIn: st.githubSignIn,
      openMenu: st.openMenu,
      promptText: st.promptText,
      renameBranch: st.renameBranch,
      deleteBranch: st.deleteBranch,
      toggleFav: st.toggleFav,
      isFav: st.isFav,
      favourites: st.favourites,
      copy: st.copy,
      selectWorkingFile: st.selectWorkingFile,
      discard: st.discard
    }))
  )

  const [active, setActive] = useState<ActionDef | null>(null)
  const [text, setText] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [result, setResult] = useState<StudioResult | null>(null)
  const [running, setRunning] = useState(false)
  const [query, setQuery] = useState('')
  const [viewFile, setViewFile] = useState<string | null>(null)
  const sidebarW = useSize('studioSidebarW', 260)

  const branch = s.repo?.head.branch ?? '—'
  const onPrimary = isBaseBranch(branch)
  const behind = s.repo?.head.behind ?? 0
  const ahead = s.repo?.head.ahead ?? 0
  const changeCount = s.status
    ? s.status.staged.length + s.status.unstaged.length + s.status.conflicted.length
    : 0
  const conflicts = s.status?.conflicted.length ?? 0
  const dirty = changeCount > 0

  // Poll for new changes so "Get the latest" reflects reality.
  const poll = s.pollUpdates
  const repoPath = s.repo?.path
  useEffect(() => {
    if (!repoPath) return
    poll()
    const id = setInterval(poll, 120000)
    return () => clearInterval(id)
  }, [poll, repoPath])

  const changes = s.status
    ? [...s.status.conflicted, ...s.status.unstaged, ...s.status.staged].filter(
        (f, i, arr) => arr.findIndex((x) => x.path === f.path) === i
      )
    : []

  const allLocalNames = useMemo(
    () => s.refs.filter((r) => r.type === 'localBranch').map((r) => r.name),
    [s.refs]
  )
  const localBranches = useMemo(
    () => filterRefs(s.refs.filter((r) => r.type === 'localBranch'), query),
    [s.refs, query]
  )
  const favs = localBranches.filter((b) => s.isFav('branch', b.name))
  const yourWork = localBranches.filter((b) => !s.isFav('branch', b.name) && !isBaseBranch(b.name))
  const projectBranches = localBranches.filter(
    (b) => !s.isFav('branch', b.name) && isBaseBranch(b.name)
  )

  const banner: { tone: string; text: string } = conflicts
    ? { tone: 'warn', text: `${conflicts} file${conflicts === 1 ? '' : 's'} need fixing before you can continue.` }
    : dirty
      ? {
          tone: 'info',
          text: `You have ${changeCount} unsaved change${changeCount === 1 ? '' : 's'} — use Save my work to keep them safe.`
        }
      : behind
        ? {
            tone: 'accent',
            text: `There ${behind === 1 ? 'is' : 'are'} ${behind} new change${behind === 1 ? '' : 's'} to get — click Get the latest.`
          }
        : ahead
          ? { tone: 'info', text: 'Your saved work isn’t uploaded yet — use Save my work to upload.' }
          : { tone: 'ok', text: 'Everything is saved and up to date.' }

  const open = (step: ActionDef) => {
    setActive(step)
    setText('')
    if (step.key === 'branch') {
      setBaseBranch(allLocalNames.find(isBaseBranch) ?? branch)
    }
    setResult(null)
  }
  const close = () => {
    setActive(null)
    setResult(null)
    setText('')
  }

  const runStep = async () => {
    if (!active) return
    setRunning(true)
    let res: StudioResult
    if (active.key === 'pull') res = await s.studioPull()
    else if (active.key === 'branch') res = await s.studioNewBranch(text, baseBranch)
    else if (active.key === 'save') res = await s.studioSave(text)
    else res = await s.studioFinish()
    setRunning(false)
    setResult(res)
  }

  const switchTo = (name: string, isCurrent: boolean) => {
    if (isCurrent) return
    if (dirty && !confirm(`You have ${changeCount} unsaved change(s). Switch to "${name}" anyway?`)) return
    s.checkout(name)
  }

  const viewChange = (path: string, staged: boolean) => {
    s.selectWorkingFile(path, staged)
    setViewFile(path)
  }
  const undoChange = async (path: string) => {
    const yes = await s.promptText({
      title: 'Undo this change?',
      message: `Undo your changes to “${path}”? This can’t be undone.`,
      confirmOnly: true,
      danger: true,
      confirmText: 'Undo change'
    })
    if (yes) {
      s.discard(path)
      setViewFile(null)
    }
  }

  const branchMenu = (name: string, isCurrent: boolean): MenuItem[] => {
    const faved = s.isFav('branch', name)
    const items: MenuItem[] = [
      {
        label: faved ? 'Unfavourite' : 'Favourite',
        icon: faved ? 'starOn' : 'star',
        onSelect: () => s.toggleFav('branch', name)
      }
    ]
    if (!isCurrent) items.push({ label: 'Switch to this', icon: 'branch', onSelect: () => switchTo(name, false) })
    items.push(
      { type: 'divider' },
      {
        label: 'Rename…',
        icon: 'rename',
        onSelect: async () => {
          const n = await s.promptText({ title: 'Rename', initial: name, confirmText: 'Rename' })
          if (n && n !== name) s.renameBranch(name, n)
        }
      }
    )
    if (!isCurrent) items.push({ label: 'Delete', icon: 'trash', danger: true, onSelect: () => s.deleteBranch(name) })
    items.push({ type: 'divider' }, { label: 'Copy name', icon: 'copy', onSelect: () => s.copy(name, 'name') })
    return items
  }

  const BranchRow = ({ name }: { name: string }) => {
    const isCurrent = name === branch
    const faved = s.isFav('branch', name)
    return (
      <button
        className={`studio-branch ${isCurrent ? 'current' : ''}`}
        onDoubleClick={() => switchTo(name, isCurrent)}
        onContextMenu={(e) => {
          e.preventDefault()
          s.openMenu(e.clientX, e.clientY, branchMenu(name, isCurrent))
        }}
        title={isCurrent ? `${name} — you're here` : `${name} — double-click to switch, right-click for options`}
      >
        <Icon name="branch" size={14} />
        <span className="studio-branch-label">{name}</span>
        {faved && <Icon name="starOn" size={11} className="ref-star" />}
        {isCurrent && <span className="studio-here-dot" />}
      </button>
    )
  }

  return (
    <div className="studio-v2">
      <aside className="studio-sidebar" style={{ width: sidebarW }}>
        <div className="studio-sidebar-head">
          <Icon name="branch" size={14} />
          Your work
        </div>
        <div className="studio-sidebar-search">
          <Icon name="search" size={13} />
          <input value={query} placeholder="Find work…" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="studio-sidebar-hint">Double-click to open · right-click for options</div>
        <div className="studio-branch-scroll">
          {favs.length > 0 && <div className="studio-branch-group">Favourites</div>}
          {favs.map((b) => (
            <BranchRow key={`f-${b.name}`} name={b.name} />
          ))}
          {yourWork.length > 0 && <div className="studio-branch-group">Your work</div>}
          {yourWork.map((b) => (
            <BranchRow key={b.name} name={b.name} />
          ))}
          {projectBranches.length > 0 && <div className="studio-branch-group">Project branches</div>}
          {projectBranches.map((b) => (
            <BranchRow key={`p-${b.name}`} name={b.name} />
          ))}
          {localBranches.length === 0 && <div className="side-empty">No work found.</div>}
        </div>
      </aside>

      <Resizer axis="x" sizeKey="studioSidebarW" def={260} min={200} max={420} dir={1} />

      <div className="studio-main">
        <header className="studio-head">
          <div className="studio-brand">
            <div className="brand-mark">
              <Icon name="sparkle" size={17} />
            </div>
            <div>
              <div className="studio-project">{s.repo?.name ?? 'No project'}</div>
              <div className="studio-branch-line">
                You’re working on <strong>{onPrimary ? 'the main project' : branch}</strong>
              </div>
            </div>
          </div>
          <button className="studio-exit" onClick={() => s.setNoobMode(false)}>
            Switch to full mode
          </button>
        </header>

        <div className={`studio-banner ${banner.tone}`}>
          <Icon
            name={banner.tone === 'ok' ? 'check' : banner.tone === 'warn' ? 'warning' : 'dot'}
            size={15}
          />
          {banner.text}
        </div>

        <div className="studio-actions">
          {ACTIONS.map((a) => {
            const isPull = a.key === 'pull'
            const upToDate = isPull && behind === 0
            const important = isPull && behind > 0
            return (
              <div
                key={a.key}
                className={`studio-action ${important ? 'important' : ''} ${upToDate ? 'muted' : ''}`}
              >
                <span className="studio-action-icon">
                  <Icon name={a.icon} size={18} />
                </span>
                <div className="studio-action-text">
                  <span className="studio-action-title">{a.title}</span>
                  <span className="studio-action-sub">
                    {isPull
                      ? upToDate
                        ? 'You’re up to date'
                        : `${behind} new change${behind === 1 ? '' : 's'} waiting`
                      : a.subtitle}
                  </span>
                </div>
                <button className="studio-action-btn" disabled={upToDate} onClick={() => open(a)}>
                  <Icon name={a.icon} size={13} />
                  {isPull
                    ? upToDate
                      ? 'Up to date'
                      : `Get ${behind} change${behind === 1 ? '' : 's'}`
                    : a.cta}
                </button>
              </div>
            )
          })}
        </div>

        <div className="studio-changes">
          <div className="studio-changes-head">
            <Icon name="changes" size={15} />
            What you’ve changed
            {changes.length > 0 && <span className="side-count">{changes.length}</span>}
          </div>
          {changes.length === 0 ? (
            <div className="studio-changes-empty">Nothing changed yet — your work is saved.</div>
          ) : (
            <div className="studio-changes-list">
              {changes.map((f) => {
                const t = CHANGE_LABEL[f.type]
                return (
                  <div key={f.path} className="studio-change">
                    <span className={`studio-change-tag ${t.cls}`}>{t.label}</span>
                    <span className="studio-change-path" title={f.path}>
                      {f.path}
                    </span>
                    <button className="studio-change-view" onClick={() => viewChange(f.path, f.staged)}>
                      View
                    </button>
                    <button
                      className="studio-change-undo"
                      onClick={() => undoChange(f.path)}
                      title="Undo this change"
                    >
                      <Icon name="undo" size={13} /> Undo
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {viewFile && (
        <div className="studio-overlay" onClick={() => setViewFile(null)}>
          <div className="studio-diff-modal" onClick={(e) => e.stopPropagation()}>
            <div className="studio-diff-head">
              <span className="mono">{viewFile}</span>
              <div className="topbar-spacer" />
              <button className="studio-diff-undo" onClick={() => undoChange(viewFile)}>
                <Icon name="undo" size={13} /> Undo this change
              </button>
              <button className="studio-step-close" onClick={() => setViewFile(null)}>
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="studio-diff-body">
              <DiffView />
            </div>
          </div>
        </div>
      )}

      {active && (
        <div className="studio-overlay" onClick={close}>
          <div className="studio-step" onClick={(e) => e.stopPropagation()}>
            <button className="studio-step-close" onClick={close}>
              <Icon name="close" size={16} />
            </button>
            {!result ? (
              <>
                <div className="studio-step-icon">
                  <Icon name={active.icon} size={28} />
                </div>
                <h2>{active.title}</h2>
                <p className="studio-step-blurb">{active.blurb}</p>

                {active.key === 'branch' && (
                  <label className="studio-field">
                    <span>Start from</span>
                    <select value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)}>
                      {allLocalNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                          {isBaseBranch(n) ? '  (main project)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {active.needsInput && (
                  <label className="studio-field">
                    <span>{active.inputLabel}</span>
                    {active.needsInput === 'message' ? (
                      <textarea
                        autoFocus
                        value={text}
                        placeholder={active.placeholder}
                        onChange={(e) => setText(e.target.value)}
                      />
                    ) : (
                      <input
                        autoFocus
                        value={text}
                        placeholder={active.placeholder}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runStep()}
                      />
                    )}
                  </label>
                )}

                <button className="studio-go" onClick={runStep} disabled={running}>
                  {running ? <span className="spinner" /> : <Icon name="check" size={16} />}
                  {running ? (s.busy ?? 'Working…') : active.cta}
                </button>
              </>
            ) : (
              <div className={`studio-result ${result.ok ? 'ok' : result.needsHuman ? 'warn' : 'err'}`}>
                <div className="studio-result-icon">
                  <Icon name={result.ok ? 'check' : 'warning'} size={30} />
                </div>
                <p>{result.message}</p>
                {result.needsGhInstall ? (
                  <>
                    <button
                      className="studio-go"
                      disabled={running}
                      onClick={async () => {
                        setRunning(true)
                        const ok = await s.installGithubCli()
                        setRunning(false)
                        setResult(
                          ok
                            ? { ok: false, needsGhAuth: true, message: 'GitHub CLI installed. Now sign in to GitHub to finish.' }
                            : { ok: false, needsHuman: true, message: 'Couldn’t install it automatically — you can get it from cli.github.com.' }
                        )
                      }}
                    >
                      {running ? <span className="spinner" /> : <Icon name="download" size={16} />}
                      {running ? 'Installing…' : 'Install GitHub CLI'}
                    </button>
                    <button className="studio-result-secondary" onClick={close}>
                      Not now
                    </button>
                  </>
                ) : result.needsGhAuth ? (
                  <>
                    <button
                      className="studio-go"
                      onClick={() => {
                        s.githubSignIn()
                        close()
                      }}
                    >
                      <Icon name="github" size={16} /> Sign in to GitHub
                    </button>
                    <button className="studio-result-secondary" onClick={close}>
                      Not now
                    </button>
                  </>
                ) : (
                  <button className="studio-go" onClick={close}>
                    {result.ok ? 'Great!' : 'OK'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
