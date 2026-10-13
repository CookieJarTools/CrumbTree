import type { CSSProperties } from 'react'

type IconName =
  | 'branch'
  | 'commit'
  | 'tag'
  | 'remote'
  | 'stash'
  | 'folder'
  | 'search'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'refresh'
  | 'check'
  | 'plus'
  | 'minus'
  | 'undo'
  | 'merge'
  | 'worktree'
  | 'history'
  | 'changes'
  | 'terminal'
  | 'close'
  | 'chevron'
  | 'dot'
  | 'warning'
  | 'database'
  | 'upload'
  | 'download'
  | 'sparkle'
  | 'flag'
  | 'trash'
  | 'menu'
  | 'winMin'
  | 'winMax'
  | 'winRestore'
  | 'copy'
  | 'rename'
  | 'external'
  | 'star'
  | 'starOn'
  | 'play'
  | 'lock'
  | 'globe'
  | 'github'
  | 'newRepo'
  | 'tree'
  | 'list'

const PATHS: Record<IconName, string> = {
  tree: 'M6 4v11a2 2 0 0 0 2 2h2M6 4a1.6 1.6 0 1 0 0 .01M14 10h6M14 10a1.6 1.6 0 1 0 0 .01M14 17h6M14 17a1.6 1.6 0 1 0 0 .01',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  branch: 'M6 3v7a3 3 0 0 0 3 3h3M6 3a2 2 0 1 0 0 .01M6 13a2 2 0 1 0 0 .01M15 8a2 2 0 1 0 0 .01',
  commit: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM2 12h6m8 0h6',
  tag: 'M3 3h7l11 11-7 7L3 10V3zM7 7h.01',
  remote: 'M4 5h16v10H4zM8 19h8M12 15v4',
  stash: 'M3 7l9-4 9 4-9 4-9-4zM3 12l9 4 9-4M3 17l9 4 9-4',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5',
  fetch: 'M12 3v12m0 0l-4-4m4 4l4-4M4 20h16',
  pull: 'M12 21V9m0 12l-4-4m4 4l4-4M4 4h16',
  push: 'M12 3v12m0-12l-4 4m4-4l4 4M4 20h16',
  refresh: 'M20 11a8 8 0 1 0-1 5m1 4v-5h-5',
  check: 'M4 12l5 5L20 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1',
  merge: 'M7 3v12a4 4 0 0 0 4 4h6M7 3a2 2 0 1 0 0 .01M17 19a2 2 0 1 0 0 .01M17 9v8M17 9a2 2 0 1 0 0-.01',
  worktree: 'M4 4h7v7H4zM13 13h7v7h-7zM7.5 11v2M11 16.5h2',
  history: 'M12 8v4l3 2M3.5 12a8.5 8.5 0 1 0 2-5.5M3 3v4h4',
  changes: 'M4 5h16M4 12h10M4 19h7M17 15l3 3-3 3M20 18h-6',
  terminal: 'M4 5h16v14H4zM7 9l3 3-3 3M13 15h4',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  dot: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  warning: 'M12 3l9 16H3l9-16zM12 10v4M12 17v.01',
  database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  upload: 'M12 15V4m0 0l-4 4m4-4l4 4M5 20h14',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 4v3M20.5 5.5h-3',
  flag: 'M5 21V4m0 0l9 1.5L19 4v9l-5 1.5L5 13',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  menu: 'M4 7h16M4 12h16M4 17h16',
  winMin: 'M5 12h14',
  winMax: 'M5 5h14v14H5z',
  winRestore: 'M8 8V5h11v11h-3M5 8h11v11H5z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  rename: 'M4 20h16M4 20v-4L14 6l4 4L8 20H4M13 7l4 4',
  external: 'M14 5h5v5M19 5l-8 8M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  starOn: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  play: 'M7 5l11 7-11 7z',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3M5 10h14v10H5zM12 14v3',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.5 5.8 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.8-3.5-9s1-6.5 3.5-9z',
  github:
    'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.3-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.6 0 0 .8-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.6.7 1 1.6 1 2.7 0 3.8-2.4 4.7-4.6 4.9.3.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 12 2z',
  newRepo: 'M4 5h16v14H4zM8 9h8M12 9v0M15 15h4M17 13v4'
}

export function Icon({
  name,
  size = 16,
  className,
  style,
  strokeWidth = 1.7
}: {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
  strokeWidth?: number
}) {
  const filled = name === 'dot' || name === 'starOn' || name === 'play'
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
