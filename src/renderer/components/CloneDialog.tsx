import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { looksLikeGitUrl, repoNameFromUrl } from '../lib/clone-url'
import { Icon } from './ui/Icon'

function joinPath(dir: string, name: string): string {
  if (!dir) return name
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[\\/]+$/, '') + sep + name
}

export function CloneDialog() {
  const s = useStore(
    useShallow((st) => ({
      open: st.cloneOpen,
      setClone: st.setClone,
      pickFolder: st.pickFolder,
      cloneRepo: st.cloneRepo,
      readClipboard: st.readClipboard,
      busy: st.busy
    }))
  )
  const close = () => s.setClone(false)

  const [url, setUrl] = useState('')
  const [dir, setDir] = useState('')
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // On open: reset, then pre-fill the URL from the clipboard if it's a git URL (like Fork).
  useEffect(() => {
    if (!s.open) return
    setUrl('')
    setDir('')
    setName('')
    setNameEdited(false)
    setPrefilled(false)
    s.readClipboard().then((text) => {
      if (text && looksLikeGitUrl(text)) {
        const clean = text.trim()
        setUrl(clean)
        setName(repoNameFromUrl(clean))
        setPrefilled(true)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.open])

  const effectiveName = name || repoNameFromUrl(url)
  const urlOk = looksLikeGitUrl(url)
  const canClone = urlOk && !!dir && !!effectiveName && !s.busy

  const target = useMemo(
    () => (dir && effectiveName ? joinPath(dir, effectiveName) : ''),
    [dir, effectiveName]
  )

  if (!s.open) return null

  const onUrl = (v: string) => {
    setUrl(v)
    setPrefilled(false)
    if (!nameEdited) setName(repoNameFromUrl(v))
  }

  const choose = async () => {
    const f = await s.pickFolder()
    if (f) setDir(f)
  }

  const clone = async () => {
    if (!canClone) return
    const ok = await s.cloneRepo(url.trim(), dir, effectiveName)
    if (ok) close()
  }

  return (
    <div className="prompt-overlay" onClick={close}>
      <div className="newrepo" onClick={(e) => e.stopPropagation()}>
        <div className="newrepo-head">
          <div className="newrepo-title">
            <Icon name="download" size={18} />
            Clone repository
          </div>
          <button className="studio-step-close" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="newrepo-body">
          <label className="nr-field">
            <span>Repository URL</span>
            <input
              autoFocus
              value={url}
              onChange={(e) => onUrl(e.target.value)}
              placeholder="https://github.com/owner/repo.git or git@host:owner/repo.git"
            />
            {prefilled ? (
              <span className="nr-hint nr-clip">
                <Icon name="copy" size={12} /> Filled in from your clipboard
              </span>
            ) : (
              url && !urlOk && <span className="nr-error">That doesn’t look like a git URL.</span>
            )}
          </label>

          <label className="nr-field">
            <span>Clone into</span>
            <div className="nr-folder">
              <input readOnly value={dir} placeholder="Choose a parent folder…" />
              <button className="mini-btn" onClick={choose}>
                <Icon name="folder" size={13} /> Choose…
              </button>
            </div>
          </label>

          <label className="nr-field">
            <span>Folder name</span>
            <input
              value={effectiveName}
              onChange={(e) => {
                setName(e.target.value)
                setNameEdited(true)
              }}
              placeholder="repo"
            />
          </label>
        </div>

        <div className="newrepo-foot">
          <span className="nr-summary mono">
            {target ? `→ ${target}` : 'Enter a URL and choose a folder.'}
          </span>
          <div className="nr-actions">
            <button className="prompt-cancel" onClick={close}>
              Cancel
            </button>
            <button className="prompt-ok" disabled={!canClone} onClick={clone}>
              {s.busy ? 'Cloning…' : 'Clone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
