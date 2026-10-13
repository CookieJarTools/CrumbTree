import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { validateRepoName } from '../lib/repo-create'
import { Icon } from './ui/Icon'

function basename(p: string): string {
  return p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
}

export function NewRepoDialog() {
  const s = useStore(
    useShallow((st) => ({
      open: st.newRepoOpen,
      setNewRepo: st.setNewRepo,
      github: st.github,
      owners: st.githubOwners,
      loadOwners: st.loadOwners,
      githubStatus: st.githubStatus,
      installGithubCli: st.installGithubCli,
      githubSignIn: st.githubSignIn,
      pickFolder: st.pickFolder,
      createRepo: st.createRepo,
      busy: st.busy
    }))
  )
  const close = () => s.setNewRepo(false)

  const [folder, setFolder] = useState('')
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(true)
  const [publish, setPublish] = useState(false)
  const [owner, setOwner] = useState('')
  const [addReadme, setAddReadme] = useState(true)
  const [gitignore, setGitignore] = useState<'none' | 'node' | 'unity'>('none')
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (s.open) {
      setFolder('')
      setName('')
      setNameEdited(false)
      setDescription('')
      setIsPrivate(true)
      setAddReadme(true)
      setGitignore('none')
      // Re-check gh each time the dialog opens (the user may have run `gh auth login`).
      s.githubStatus().then(() => {
        setPublish(useStore.getState().github.connected)
        if (useStore.getState().github.connected) s.loadOwners()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.open])

  useEffect(() => {
    if (s.owners && !owner) setOwner(s.owners.user)
  }, [s.owners, owner])

  const nameCheck = useMemo(() => validateRepoName(name || basename(folder)), [name, folder])
  const effectiveName = name || basename(folder)
  const orgs = s.owners?.orgs ?? []
  const ownerIsOrg = !!s.owners && owner !== s.owners.user

  if (!s.open) return null

  const choose = async () => {
    const f = await s.pickFolder()
    if (f) {
      setFolder(f)
      if (!nameEdited) setName(basename(f))
    }
  }

  const recheck = async () => {
    await s.githubStatus()
    if (useStore.getState().github.connected) {
      setPublish(true)
      s.loadOwners()
    }
  }

  const canCreate = !!folder && nameCheck.ok && (!publish || (s.github.connected && !!owner))

  const create = async () => {
    if (!canCreate) return
    const ok = await s.createRepo({
      folder,
      name: effectiveName,
      description,
      isPrivate,
      publish,
      owner: publish ? owner : '',
      ownerIsOrg: publish && ownerIsOrg,
      addReadme,
      gitignore
    })
    if (ok) close()
  }

  const summary = folder
    ? publish
      ? `Create a ${isPrivate ? 'private' : 'public'} repo “${effectiveName}” under ${owner || '…'} and push it.`
      : `Create a local repository “${effectiveName}” in this folder.`
    : 'Choose a folder to begin.'

  return (
    <div className="prompt-overlay" onClick={close}>
      <div className="newrepo" onClick={(e) => e.stopPropagation()}>
        <div className="newrepo-head">
          <div className="newrepo-title">
            <Icon name="newRepo" size={18} />
            New repository
          </div>
          <button className="studio-step-close" onClick={close}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="newrepo-body">
          <label className="nr-field">
            <span>Folder</span>
            <div className="nr-folder">
              <input readOnly value={folder} placeholder="Choose a folder (new or an existing app)…" />
              <button className="mini-btn" onClick={choose}>
                <Icon name="folder" size={13} /> Choose…
              </button>
            </div>
            <span className="nr-hint">Point at an existing project to turn it into a repo, or an empty folder.</span>
          </label>

          <div className="nr-row">
            <label className="nr-field">
              <span>Name</span>
              <input
                value={effectiveName}
                onChange={(e) => {
                  setName(e.target.value)
                  setNameEdited(true)
                }}
                placeholder="my-project"
              />
              {name && !nameCheck.ok && <span className="nr-error">{nameCheck.error}</span>}
            </label>
            <label className="nr-field">
              <span>Description (optional)</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it?" />
            </label>
          </div>

          <div className="nr-field">
            <span>Set-up files</span>
            <div className="nr-inline">
              <label className="nr-check">
                <input type="checkbox" checked={addReadme} onChange={(e) => setAddReadme(e.target.checked)} />
                Add a README
              </label>
              <label className="nr-check">
                .gitignore:
                <select value={gitignore} onChange={(e) => setGitignore(e.target.value as typeof gitignore)}>
                  <option value="none">None</option>
                  <option value="node">Node</option>
                  <option value="unity">Unity</option>
                </select>
              </label>
            </div>
          </div>

          <div className="nr-field">
            <span>Publish</span>
            <label className="nr-check nr-publish">
              <input
                type="checkbox"
                checked={publish}
                disabled={!s.github.connected}
                onChange={(e) => setPublish(e.target.checked)}
              />
              <Icon name="github" size={15} />
              Create it on GitHub and push (over SSH)
              {!s.github.connected && <span className="nr-hint"> — needs the GitHub CLI, see below</span>}
            </label>
          </div>

          {publish && s.github.connected && (
            <div className="nr-row">
              <label className="nr-field">
                <span>Owner</span>
                <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                  {s.owners && <option value={s.owners.user}>{s.owners.user} (you)</option>}
                  {orgs.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="nr-field">
                <span>Visibility</span>
                <div className="nr-visibility">
                  <button className={`nr-vis ${isPrivate ? 'on' : ''}`} onClick={() => setIsPrivate(true)}>
                    <Icon name="lock" size={13} /> Private
                  </button>
                  <button className={`nr-vis ${!isPrivate ? 'on' : ''}`} onClick={() => setIsPrivate(false)}>
                    <Icon name="globe" size={13} /> Public
                  </button>
                </div>
              </label>
            </div>
          )}

          {!s.github.connected && (
            <div className="nr-connect">
              <div className="nr-connect-head">
                <Icon name="github" size={15} /> Publish uses the GitHub CLI (no token needed)
              </div>
              <p className="nr-hint">
                {s.github.reason === 'no-cli'
                  ? 'The GitHub CLI isn’t installed. I can install it for you, then you sign in (choose SSH).'
                  : 'You’re not signed in yet. I can open the GitHub sign-in for you (choose SSH), then re-check.'}
              </p>
              <div className="nr-connect-actions">
                {s.github.reason === 'no-cli' ? (
                  <button
                    className="mini-btn nr-install"
                    disabled={installing}
                    onClick={async () => {
                      setInstalling(true)
                      await s.installGithubCli()
                      setInstalling(false)
                    }}
                  >
                    {installing ? 'Installing…' : 'Install GitHub CLI'}
                  </button>
                ) : (
                  <button className="mini-btn nr-install" onClick={() => s.githubSignIn()}>
                    Sign in to GitHub
                  </button>
                )}
                <button className="mini-btn" onClick={recheck}>
                  Re-check
                </button>
              </div>
            </div>
          )}
          {s.github.connected && (
            <div className="nr-connected">
              <Icon name="check" size={13} /> GitHub CLI signed in as {s.github.login} · pushes over SSH
            </div>
          )}
        </div>

        <div className="newrepo-foot">
          <span className="nr-summary">{summary}</span>
          <div className="nr-actions">
            <button className="prompt-cancel" onClick={close}>
              Cancel
            </button>
            <button className="prompt-ok" disabled={!canCreate || !!s.busy} onClick={create}>
              {s.busy ? 'Working…' : publish ? 'Create & publish' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
