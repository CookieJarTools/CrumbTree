// Turn a flat list of files (identified by their POSIX-style path) into a folder
// tree. Pure and unit-tested; used by the changes panel's tree view.

export interface TreeFileNode<T> {
  type: 'file'
  /** Basename shown in the tree. */
  name: string
  path: string
  item: T
}

export interface TreeFolderNode<T> {
  type: 'folder'
  /** Display name — may be a compacted chain, e.g. "Editor/Ui/Drawers". */
  name: string
  /** Full folder path (the deepest segment of a compacted chain). */
  path: string
  children: TreeNode<T>[]
}

export type TreeNode<T> = TreeFileNode<T> | TreeFolderNode<T>

/** Build a folder tree. Folders sort first, then files, both case-insensitively. */
export function buildFileTree<T extends { path: string }>(items: T[]): TreeNode<T>[] {
  const root: TreeFolderNode<T> = { type: 'folder', name: '', path: '', children: [] }
  const folders = new Map<string, TreeFolderNode<T>>([['', root]])

  const getFolder = (dir: string): TreeFolderNode<T> => {
    const existing = folders.get(dir)
    if (existing) return existing
    const cut = dir.lastIndexOf('/')
    const parent = getFolder(cut === -1 ? '' : dir.slice(0, cut))
    const node: TreeFolderNode<T> = {
      type: 'folder',
      name: cut === -1 ? dir : dir.slice(cut + 1),
      path: dir,
      children: []
    }
    parent.children.push(node)
    folders.set(dir, node)
    return node
  }

  for (const item of items) {
    const path = item.path.replace(/\\/g, '/')
    const cut = path.lastIndexOf('/')
    const dir = cut === -1 ? '' : path.slice(0, cut)
    const name = cut === -1 ? path : path.slice(cut + 1)
    getFolder(dir).children.push({ type: 'file', name, path: item.path, item })
  }

  sortFolder(root)
  compact(root)
  return root.children
}

function sortFolder<T>(f: TreeFolderNode<T>): void {
  f.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
  for (const c of f.children) if (c.type === 'folder') sortFolder(c)
}

// Collapse chains of single-child folders: `a` that only contains folder `b`
// becomes one row "a/b" — the way VS Code and Fork show deep, sparse trees.
function compact<T>(f: TreeFolderNode<T>): void {
  for (const c of f.children) if (c.type === 'folder') compact(c)
  f.children = f.children.map((c) => {
    if (c.type !== 'folder') return c
    let node = c
    while (node.children.length === 1 && node.children[0].type === 'folder') {
      const only = node.children[0] as TreeFolderNode<T>
      node = { type: 'folder', name: `${node.name}/${only.name}`, path: only.path, children: only.children }
    }
    return node
  })
}

export interface FlatRow<T> {
  node: TreeNode<T>
  depth: number
}

/** Depth-first list of rows to render; a collapsed folder hides its descendants. */
export function flattenTree<T>(
  nodes: TreeNode<T>[],
  collapsed: Set<string>,
  depth = 0
): FlatRow<T>[] {
  const out: FlatRow<T>[] = []
  for (const n of nodes) {
    out.push({ node: n, depth })
    if (n.type === 'folder' && !collapsed.has(n.path)) {
      out.push(...flattenTree(n.children, collapsed, depth + 1))
    }
  }
  return out
}

/** Every file path under these nodes, in tree order (ignores collapse). */
export function treeFilePaths<T>(nodes: TreeNode<T>[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    if (n.type === 'file') out.push(n.path)
    else out.push(...treeFilePaths(n.children))
  }
  return out
}
