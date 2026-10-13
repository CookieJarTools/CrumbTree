# CrumbTree

A fast, friendly desktop **git client** with a beautiful vertical commit graph — in the
spirit of [Fork](https://git-fork.com). Built with Electron + React + TypeScript.

## Download

Grab the latest Windows installer (`CrumbTree-Setup-x.y.z.exe`) from the
[Releases page](https://github.com/cookiester34/CrumbTree/releases).

The installer isn't code-signed yet, so Windows SmartScreen may say it "protected your
PC". Click **More info → Run anyway** to install. You'll also need
[git](https://git-scm.com/downloads) installed.

## What it does today (v1 "polished core")

- **Vertical commit graph** — a custom lane-assignment algorithm rendered as an SVG
  overlay on a virtualized list, so it stays smooth on very large histories. Ref labels
  are drawn in their branch's lane colour.
- **Sidebar** grouped into Workspace / Branches / Remotes / Tags, with the current branch
  highlighted and double-click to check out (guarded when the tree is dirty).
- **Commit inspector** — click a commit to see author, hash, merge info and its changed
  files; click a file for its diff.
- **Diff viewer** — side-by-side **and** unified, with add/del gutters and per-hunk staging.
- **Changes / staging** — unstaged & staged lists, stage/unstage/discard by file, **stage
  by hunk**, an amendable commit box (`Ctrl/⌘+Enter` to commit).
- **Sync** — fetch / pull / push with an ahead/behind indicator and toasts.
- **Command palette** (`Ctrl/⌘+K`) — fuzzy actions and branch checkout.
- **Operation log** — every git command CrumbTree runs, shown for trust and debugging.
- **Git LFS manager** — a dedicated panel: pick a file/folder and get smart pattern
  options (just this file · all `*.ext` · files named X anywhere · everything in this
  folder · custom), see all tracked patterns, and remove any with one click. Detects a
  missing `git-lfs` and guides you instead of crashing.
- **Minimal Mode** — a toggle that swaps the whole app for a friendly **Studio** workspace:
  guided cards (Get the latest · Start new work · Switch to other work · Save my work ·
  Finish & combine) in plain language, with artist-safe merges (fast-forward first,
  auto-abort on conflict). "Save my work" commits **and** pushes in one step; switching
  tasks is guarded when there are unsaved changes.
- **Right-click context menus** on branches, tags, commits, repo tabs and files — checkout,
  merge, rename, delete, new branch/tag here, revert, favourite, copy SHA/name/path, and more.
- **Multiple repositories** open as tabs in the title bar; click to switch, they reopen on
  next launch.
- **Modern frameless title bar** with a `≡` menu, repo tabs, and custom window controls.
- **Search everywhere** — History (message/hash/author), Changes (file path), and the
  sidebar branches/tags.
- **Favourites** — star repositories, branches and commits; favourites float to the top.
- Click a branch/tag to **jump the History graph** to its commit.
- **Built-in git terminal** — the operation log lets you type git commands and see output;
  it floats over the content instead of resizing it.
- **Resizable panels** — drag the dividers on the sidebar and panes; sizes persist.
- **Open from other apps** — register `crumbtree://open?path=<repo>` or launch
  `CrumbTree <path>` to open a repository from any external tool.
- **Create repositories** — a New Repository dialog: `git init` a folder (or turn an existing
  app into a repo), add a README/.gitignore, first commit, and optionally **create it on
  GitHub** (choose your account or an organisation, public/private) and **push over SSH**.
  Uses the **GitHub CLI** (`gh`) — no access token to paste; sign in once with `gh auth login`.
- Minimal Mode shows **"What you've changed"** — view and undo each change without leaving
  the simple workspace.

## File history

Right-click any file (or hit **History** in the diff toolbar) to open a **File History**
window: every commit that changed the file across branches — author, date, message, which
branches contain it, and the diff at each commit — plus a **Blame** tab showing, line by
line, who last changed each line and in which commit.

## Merging & conflicts

- **Merge into current…** lets you choose the type — **merge commit**, **squash**,
  **fast-forward when possible**, or **rebase** — with a plain-English summary.
- When a merge conflicts, a **conflict wizard** opens: per chunk, choose **Use ours / Use
  theirs / Keep both** (or take a whole side), see a live preview, mark resolved, then
  **Continue** or **Abort**. A persistent strip keeps the in-progress merge visible.

## On the roadmap (stub screens wired now)

1. Drag-and-drop **interactive rebase** (pick / squash / fixup / reword / drop)
2. Global **Undo** safety net via reflog
3. **Worktree** management + a rich **stash** browser

## Architecture

```
src/
  main/      Electron main process — all git access lives here
    git/     exec, repo/status/refs, log (graph data), diff, stage, remote
    ipc.ts   typed ipcMain handlers
  preload/   contextBridge → window.crumb (typed, context-isolated)
  shared/    ipc-contract.ts + types.ts (single source of truth) + diff-parse.ts
  renderer/  React UI
    lib/graph/layout.ts   pure DAG → lane/colour algorithm (unit-tested)
    components/ · screens/ · theme/
```

Git is driven via the system `git` CLI spawned as a child process (full compatibility,
no native modules). `contextIsolation` is on and `nodeIntegration` off.

## Develop

```bash
npm install
npm run dev        # launch the Electron app with HMR
npm run test       # vitest — graph layout algorithm
npm run typecheck  # tsc --noEmit
npm run build      # production bundles
```

### Browser demo (no Electron)

`npm run demo` serves the real renderer in a plain browser against captured sample-repo
data via a mock API (`src/renderer/lib/mock.ts`) — handy for UI work without launching
Electron. Open the printed URL at `/demo.html`.

## Requirements

- Node 18+ and a system **git** on `PATH` (CrumbTree shows a friendly setup card if git
  is missing).

## Licence

CrumbTree is **free for any non-commercial use** — personal projects, study, hobby work,
charities, schools and so on — under the
[PolyForm Noncommercial License 1.0.0](LICENSE.md). You can use it, change it and share
it, but you can't sell it or use it for commercial purposes without permission.
