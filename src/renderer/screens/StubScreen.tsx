import { Icon } from '../components/ui/Icon'

type IconName = Parameters<typeof Icon>[0]['name']

const CONTENT: Record<string, { icon: IconName; title: string; blurb: string; bullets: string[] }> = {
  stashes: {
    icon: 'stash',
    title: 'Stash manager',
    blurb: 'Browse, preview, apply, pop and drop stashes with full diffs — coming next.',
    bullets: ['Inspect each stash as a diff', 'Apply or pop without leaving the app', 'Create a stash from the current changes']
  },
  rebase: {
    icon: 'merge',
    title: 'Interactive rebase',
    blurb: 'Reorder, squash, fixup, reword and drop commits by dragging them — the Fork power feature.',
    bullets: ['Drag & drop to reorder commits', 'Squash / fixup / reword / edit / drop', 'Live preview before you rewrite history']
  },
  worktrees: {
    icon: 'worktree',
    title: 'Worktrees',
    blurb: 'First-class git worktree management so you can work on several branches at once.',
    bullets: ['Create a worktree from any branch', 'Switch between worktrees instantly', 'Prune and remove stale worktrees']
  }
}

export function StubScreen({ view }: { view: keyof typeof CONTENT }) {
  const c = CONTENT[view]
  return (
    <div className="stub-screen">
      <div className="stub-card">
        <div className="stub-icon">
          <Icon name={c.icon} size={30} />
        </div>
        <h2>{c.title}</h2>
        <p>{c.blurb}</p>
        <ul>
          {c.bullets.map((b) => (
            <li key={b}>
              <Icon name="check" size={13} /> {b}
            </li>
          ))}
        </ul>
        <span className="stub-badge">On the roadmap</span>
      </div>
    </div>
  )
}
