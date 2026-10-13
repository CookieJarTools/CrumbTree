import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore, type MenuItem } from '../store/store'
import { crumb } from '../lib/api'
import { Icon } from './ui/Icon'

export function TitleBar() {
  const s = useStore(
    useShallow((st) => ({
      repo: st.repo,
      openRepos: st.openRepos,
      workspaces: st.workspaces,
      activeWorkspaceId: st.activeWorkspaceId,
      noobMode: st.noobMode,
      openDialog: st.openDialog,
      switchRepo: st.switchRepo,
      closeRepo: st.closeRepo,
      openPath: st.openPath,
      setView: st.setView,
      togglePalette: st.togglePalette,
      toggleDrawer: st.toggleDrawer,
      setNoobMode: st.setNoobMode,
      openMenu: st.openMenu,
      copy: st.copy,
      reveal: st.reveal,
      openExternal: st.openExternal,
      toast: st.toast,
      toggleFav: st.toggleFav,
      isFav: st.isFav,
      favourites: st.favourites,
      setNewRepo: st.setNewRepo,
      setClone: st.setClone,
      gitFriend: st.gitFriend,
      setGitFriend: st.setGitFriend,
      promptText: st.promptText,
      createWorkspace: st.createWorkspace,
      switchWorkspace: st.switchWorkspace,
      renameWorkspace: st.renameWorkspace,
      deleteWorkspace: st.deleteWorkspace
    }))
  )
  const activeWorkspace =
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? s.workspaces[0]
  const [isMax, setIsMax] = useState(false)

  useEffect(() => {
    crumb.windowIsMaximized().then((r) => setIsMax(!!r.data))
    return crumb.onMaximizeChanged(setIsMax)
  }, [])

  const newWorkspace = async () => {
    const name = await s.promptText({
      title: 'New workspace',
      message: 'A workspace is its own set of repository tabs — handy for grouping projects.',
      placeholder: 'e.g. Client work, Games…',
      confirmText: 'Create'
    })
    if (name !== null) s.createWorkspace(name)
  }

  const renameWorkspace = async () => {
    if (!activeWorkspace) return
    const name = await s.promptText({
      title: 'Rename workspace',
      initial: activeWorkspace.name,
      confirmText: 'Rename'
    })
    if (name) s.renameWorkspace(activeWorkspace.id, name)
  }

  // Menu listing every workspace (active one checked) plus manage actions.
  const workspaceMenu = (): MenuItem[] => [
    { type: 'header', label: 'Workspaces' },
    ...s.workspaces.map(
      (w): MenuItem => ({
        label: w.name,
        icon: w.id === s.activeWorkspaceId ? 'check' : 'folder',
        onSelect: () => s.switchWorkspace(w.id)
      })
    ),
    { type: 'divider' },
    { label: 'New workspace…', icon: 'plus', onSelect: newWorkspace },
    { label: 'Rename current…', icon: 'rename', disabled: !activeWorkspace, onSelect: renameWorkspace },
    {
      label: 'Delete current',
      icon: 'trash',
      danger: true,
      disabled: s.workspaces.length < 2,
      onSelect: () => activeWorkspace && s.deleteWorkspace(activeWorkspace.id)
    }
  ]

  // Menu shown by the "+" tab button: ways to add a repo to this workspace.
  const addMenu: MenuItem[] = [
    { label: 'Open Repository…', icon: 'folder', onSelect: () => s.openDialog() },
    { label: 'Clone Repository…', icon: 'download', onSelect: () => s.setClone(true) },
    { label: 'New Repository…', icon: 'newRepo', onSelect: () => s.setNewRepo(true) }
  ]

  const appMenu: MenuItem[] = [
    { type: 'header', label: 'File' },
    { label: 'New Repository…', icon: 'newRepo', onSelect: () => s.setNewRepo(true) },
    { label: 'Open Repository…', icon: 'folder', onSelect: () => s.openDialog() },
    { label: 'Clone Repository…', icon: 'download', onSelect: () => s.setClone(true) },
    {
      label: 'Close Repository',
      disabled: !s.repo,
      onSelect: () => s.repo && s.closeRepo(s.repo.path)
    },
    { type: 'divider' },
    { type: 'header', label: 'Workspace' },
    { label: 'New workspace…', icon: 'plus', onSelect: newWorkspace },
    { label: 'Rename current…', icon: 'rename', disabled: !activeWorkspace, onSelect: renameWorkspace },
    { type: 'divider' },
    { type: 'header', label: 'View' },
    { label: 'History', icon: 'history', onSelect: () => s.setView('history') },
    { label: 'Changes', icon: 'changes', onSelect: () => s.setView('changes') },
    { label: 'LFS', icon: 'database', onSelect: () => s.setView('lfs') },
    { label: 'Operation Log', icon: 'terminal', onSelect: () => s.toggleDrawer() },
    { label: 'Command Palette', icon: 'search', onSelect: () => s.togglePalette(true) },
    {
      label: s.noobMode ? 'Turn off Minimal Mode' : 'Turn on Minimal Mode',
      icon: 'sparkle',
      onSelect: () => s.setNoobMode(!s.noobMode)
    },
    {
      label: s.gitFriend ? 'Hide git friend' : 'Show git friend',
      icon: 'sparkle',
      onSelect: () => s.setGitFriend(!s.gitFriend)
    },
    { label: 'Reload', icon: 'refresh', onSelect: () => window.location.reload() },
    { type: 'divider' },
    { type: 'header', label: 'Help' },
    {
      label: 'About CrumbTree',
      onSelect: () => s.toast('info', 'CrumbTree — a fast, friendly git client.')
    },
    { label: 'Documentation', icon: 'external', onSelect: () => s.openExternal('https://git-scm.com/doc') },
    { type: 'divider' },
    { label: 'Quit', onSelect: () => crumb.windowClose() }
  ]

  const openAppMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    s.openMenu(r.left, r.bottom + 2, appMenu)
  }

  const tabMenu = (path: string): MenuItem[] => [
    {
      label: s.isFav('repo', path) ? 'Unfavourite' : 'Favourite',
      icon: s.isFav('repo', path) ? 'starOn' : 'star',
      onSelect: () => s.toggleFav('repo', path)
    },
    { type: 'divider' },
    { label: 'Close', icon: 'close', onSelect: () => s.closeRepo(path) },
    {
      label: 'Close others',
      disabled: s.openRepos.length < 2,
      onSelect: () => s.openRepos.filter((r) => r.path !== path).forEach((r) => s.closeRepo(r.path))
    },
    { type: 'divider' },
    { label: 'Copy path', icon: 'copy', onSelect: () => s.copy(path, 'path') },
    { label: 'Reveal in Explorer', icon: 'external', onSelect: () => s.reveal(path) }
  ]

  // Tabs overflow into a horizontal strip: a vertical wheel over it scrolls sideways,
  // and switching repo brings its tab into view.
  const tabsRef = useRef<HTMLDivElement>(null)
  const onTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = tabsRef.current
    if (!el || e.deltaX !== 0) return // trackpads already scroll horizontally
    el.scrollLeft += e.deltaY
  }
  const activePath = s.repo?.path
  useEffect(() => {
    const el = tabsRef.current
    if (!el || !activePath) return
    const tab = [...el.querySelectorAll<HTMLElement>('.repo-tab')].find(
      (t) => t.dataset.path === activePath
    )
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activePath, s.openRepos.length])

  return (
    <div className="titlebar">
      <div className="tb-left">
        <div className="tb-logo">
          <Icon name="merge" size={15} />
        </div>
        <button className="tb-menu-btn" onClick={openAppMenu} title="Menu">
          <Icon name="menu" size={16} />
        </button>
        <button
          className="tb-workspace"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
            s.openMenu(r.left, r.bottom + 2, workspaceMenu())
          }}
          title="Switch workspace"
        >
          <span className="tb-workspace-name">{activeWorkspace?.name ?? 'Workspace'}</span>
          <Icon name="chevron" size={12} style={{ transform: 'rotate(90deg)' }} />
        </button>
      </div>

      <div className="tb-tabs" ref={tabsRef} onWheel={onTabsWheel}>
        {s.openRepos.map((r) => {
          const active = s.repo?.path === r.path
          return (
            <div
              key={r.path}
              className={`repo-tab ${active ? 'active' : ''}`}
              data-path={r.path}
              onClick={() => s.switchRepo(r.path)}
              onContextMenu={(e) => {
                e.preventDefault()
                s.openMenu(e.clientX, e.clientY, tabMenu(r.path))
              }}
              title={r.path}
            >
              <Icon name={s.isFav('repo', r.path) ? 'starOn' : 'folder'} size={13} />
              <span className="repo-tab-name">{r.name}</span>
              <button
                className="repo-tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  s.closeRepo(r.path)
                }}
                title="Close"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <button
        className="repo-tab-add"
        onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
          s.openMenu(r.left, r.bottom + 2, addMenu)
        }}
        title="Add a repository"
      >
        <Icon name="plus" size={14} />
      </button>

      <div className="tb-spacer" />

      <div className="tb-window-controls">
        <button className="winbtn" onClick={() => crumb.windowMinimize()} title="Minimise">
          <Icon name="winMin" size={13} strokeWidth={1.4} />
        </button>
        <button className="winbtn" onClick={() => crumb.windowToggleMaximize()} title="Maximise">
          <Icon name={isMax ? 'winRestore' : 'winMax'} size={13} strokeWidth={1.4} />
        </button>
        <button className="winbtn close" onClick={() => crumb.windowClose()} title="Close">
          <Icon name="close" size={14} strokeWidth={1.6} />
        </button>
      </div>
    </div>
  )
}
