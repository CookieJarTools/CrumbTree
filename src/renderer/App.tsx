import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from './store/store'
import { Sidebar } from './components/Sidebar'
import { Resizer } from './components/Resizer'
import { TopBar } from './components/TopBar'
import { TitleBar } from './components/TitleBar'
import { CommandPalette } from './components/CommandPalette'
import { ContextMenu } from './components/ContextMenu'
import { PromptDialog } from './components/PromptDialog'
import { NewRepoDialog } from './components/NewRepoDialog'
import { CloneDialog } from './components/CloneDialog'
import { MergeDialog } from './components/MergeDialog'
import { MergeStrip } from './components/MergeStrip'
import { DetachedStrip } from './components/DetachedStrip'
import { FileHistoryModal } from './components/FileHistoryModal'
import { OpLogDrawer } from './components/OpLogDrawer'
import { Toasts } from './components/Toasts'
import { GitFriend } from './components/GitFriend'
import { HistoryScreen } from './screens/HistoryScreen'
import { ChangesScreen } from './screens/ChangesScreen'
import { ConflictsScreen } from './screens/ConflictsScreen'
import { LfsScreen } from './screens/LfsScreen'
import { StashesScreen } from './screens/StashesScreen'
import { WorktreesScreen } from './screens/WorktreesScreen'
import { RebaseScreen } from './screens/RebaseScreen'
import { StudioScreen } from './screens/StudioScreen'
import { StubScreen } from './screens/StubScreen'
import { Welcome } from './screens/Welcome'
import './theme/app.css'

export default function App() {
  const { init, repo, view, togglePalette, gitOk, noobMode } = useStore(
    useShallow((s) => ({
      init: s.init,
      repo: s.repo,
      view: s.view,
      togglePalette: s.togglePalette,
      gitOk: s.gitOk,
      noobMode: s.noobMode
    }))
  )

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePalette])

  const showWelcome = !repo || gitOk === false

  const body =
    noobMode && !showWelcome ? (
      <div className="app studio-app">
        <StudioScreen />
      </div>
    ) : (
      <div className="app">
        <Sidebar />
        <Resizer axis="x" sizeKey="sidebarW" def={236} min={190} max={420} dir={1} />
        <div className="main">
          <TopBar />
          <MergeStrip />
          <DetachedStrip />
          <div className="content">
            {/* Keyed on the view so each screen replays its entrance on switch. */}
            <div className="screen-swap" key={showWelcome ? 'welcome' : view}>
              {showWelcome ? (
                <Welcome />
              ) : view === 'history' ? (
                <HistoryScreen />
              ) : view === 'changes' ? (
                <ChangesScreen />
              ) : view === 'lfs' ? (
                <LfsScreen />
              ) : view === 'conflicts' ? (
                <ConflictsScreen />
              ) : view === 'stashes' ? (
                <StashesScreen />
              ) : view === 'worktrees' ? (
                <WorktreesScreen />
              ) : view === 'rebase' ? (
                <RebaseScreen />
              ) : (
                <StubScreen view={view} />
              )}
            </div>
          </div>
          <OpLogDrawer />
        </div>
      </div>
    )

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-shell">{body}</div>
      <CommandPalette />
      <ContextMenu />
      <PromptDialog />
      <NewRepoDialog />
      <CloneDialog />
      <MergeDialog />
      <FileHistoryModal />
      <GitFriend />
      <Toasts />
    </div>
  )
}
