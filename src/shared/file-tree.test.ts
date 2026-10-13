import { describe, expect, it } from 'vitest'
import { buildFileTree, flattenTree, treeFilePaths, type TreeNode } from './file-tree'

const f = (path: string) => ({ path })

// Compact shape for assertions: "name" for files, "name/" + [children] for folders.
function shape(nodes: TreeNode<{ path: string }>[]): unknown[] {
  return nodes.map((n) => (n.type === 'file' ? n.name : { [n.name + '/']: shape(n.children) }))
}

describe('buildFileTree', () => {
  it('nests files under their folders (and compacts the single-child chain)', () => {
    const tree = buildFileTree([f('Runtime/Gpu/GpuHelpers.cs'), f('Runtime/Gpu/Shader.cs'), f('README.md')])
    // Runtime holds only Gpu, so the chain compacts to "Runtime/Gpu".
    expect(shape(tree)).toEqual([{ 'Runtime/Gpu/': ['GpuHelpers.cs', 'Shader.cs'] }, 'README.md'])
  })

  it('sorts folders before files, case-insensitively', () => {
    const tree = buildFileTree([f('zeta.txt'), f('Alpha/one.txt'), f('beta/two.txt'), f('apple.txt')])
    expect(shape(tree)).toEqual([
      { 'Alpha/': ['one.txt'] },
      { 'beta/': ['two.txt'] },
      'apple.txt',
      'zeta.txt'
    ])
  })

  it('compacts single-child folder chains', () => {
    const tree = buildFileTree([f('Editor/Ui/Drawers/BiomeDrawer.cs')])
    expect(shape(tree)).toEqual([{ 'Editor/Ui/Drawers/': ['BiomeDrawer.cs'] }])
  })

  it('does not compact a folder that also holds files', () => {
    const tree = buildFileTree([f('Editor/Ui/a.cs'), f('Editor/b.cs')])
    expect(shape(tree)).toEqual([{ 'Editor/': [{ 'Ui/': ['a.cs'] }, 'b.cs'] }])
  })

  it('normalises backslashes', () => {
    const tree = buildFileTree([{ path: 'Src\\Game\\Ctx.cpp' }])
    expect(shape(tree)).toEqual([{ 'Src/Game/': ['Ctx.cpp'] }])
    // the original path is preserved on the leaf
    const leaf = (tree[0] as { children: TreeNode<{ path: string }>[] }).children[0]
    expect(leaf.type === 'file' && leaf.path).toBe('Src\\Game\\Ctx.cpp')
  })
})

describe('flattenTree', () => {
  const tree = buildFileTree([f('a/b/one.txt'), f('a/two.txt'), f('root.txt')])

  it('lists rows depth-first with depth markers', () => {
    const rows = flattenTree(tree, new Set()).map((r) => `${r.depth}:${r.node.name}`)
    expect(rows).toEqual(['0:a', '1:b', '2:one.txt', '1:two.txt', '0:root.txt'])
  })

  it('hides descendants of a collapsed folder', () => {
    const rows = flattenTree(tree, new Set(['a/b'])).map((r) => r.node.name)
    expect(rows).toEqual(['a', 'b', 'two.txt', 'root.txt'])
  })
})

describe('treeFilePaths', () => {
  it('returns every file path in tree order', () => {
    const tree = buildFileTree([f('a/b/one.txt'), f('a/two.txt'), f('root.txt')])
    expect(treeFilePaths(tree)).toEqual(['a/b/one.txt', 'a/two.txt', 'root.txt'])
  })
})
