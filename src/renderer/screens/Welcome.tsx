import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { Icon } from '../components/ui/Icon'

export function Welcome() {
  const { recent, openDialog, openPath, gitOk, gitVersion, setNewRepo, setClone } = useStore(
    useShallow((s) => ({
      recent: s.recent,
      openDialog: s.openDialog,
      openPath: s.openPath,
      gitOk: s.gitOk,
      gitVersion: s.gitVersion,
      setNewRepo: s.setNewRepo,
      setClone: s.setClone
    }))
  )

  return (
    <div className="welcome">
      <div className="welcome-card">
        <div className="welcome-brand">
          <div className="brand-mark big">
            <Icon name="merge" size={26} />
          </div>
          <div>
            <h1>CrumbTree</h1>
            <p className="welcome-tag">A fast, friendly git client with a beautiful commit graph.</p>
          </div>
        </div>

        {gitOk === false ? (
          <div className="welcome-warn">
            <Icon name="warning" size={16} />
            <div>
              <strong>Git isn't on your PATH.</strong>
              <span>Install Git and restart CrumbTree — everything here runs on your local git.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="welcome-actions">
              <button className="welcome-open" onClick={openDialog}>
                <Icon name="folder" size={17} />
                Open a repository
              </button>
              <button className="welcome-create" onClick={() => setClone(true)}>
                <Icon name="download" size={17} />
                Clone
              </button>
              <button className="welcome-create" onClick={() => setNewRepo(true)}>
                <Icon name="newRepo" size={17} />
                Create new
              </button>
            </div>

            {recent.length > 0 && (
              <div className="welcome-recent">
                <div className="side-label">
                  <span>Recent</span>
                </div>
                {recent.map((r) => (
                  <button key={r.path} className="recent-row" onClick={() => openPath(r.path)}>
                    <Icon name="folder" size={15} />
                    <span className="recent-name">{r.name}</span>
                    <span className="recent-path mono">{r.path}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {gitOk && <div className="welcome-foot mono">git {gitVersion}</div>}
      </div>
    </div>
  )
}
