import type { Commit, GraphEdge, GraphRow } from '@shared/types'

/**
 * Assign lanes and colours to a linear list of commits (newest first, as produced
 * by `git log --date-order`) and emit per-row draw instructions for a vertical
 * commit graph in the style of Fork.
 *
 * The algorithm walks top-to-bottom maintaining a set of "active lanes". Each active
 * lane remembers the hash of the commit it is still waiting to draw (a not-yet-seen
 * parent). When a commit is reached:
 *   - lanes waiting for it merge into its node,
 *   - its first parent continues in the node's lane,
 *   - any additional parents open new lanes (branch-out).
 * Lanes that aren't involved pass straight through the row.
 *
 * Pure and deterministic — no DOM, no git. Unit-tested in layout.test.ts.
 */

interface Lane {
  /** Hash of the parent commit this lane is waiting to reach. */
  target: string
  color: number
  /** Child commits whose parent link this lane carries. */
  from: string[]
}

const PALETTE_SIZE = 12

export function computeGraph(commits: Commit[]): GraphRow[] {
  const lanes: (Lane | null)[] = []
  let nextColor = 0
  const rows: GraphRow[] = []

  const firstFreeLane = (): number => {
    const idx = lanes.findIndex((l) => l === null)
    return idx === -1 ? lanes.length : idx
  }

  for (const commit of commits) {
    const edges: GraphEdge[] = []

    // Lanes currently waiting for THIS commit (branches converging here).
    const mergingLanes: number[] = []
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i]?.target === commit.hash) mergingLanes.push(i)
    }

    // Choose the node's lane and colour.
    let nodeLane: number
    let nodeColor: number
    if (mergingLanes.length > 0) {
      nodeLane = mergingLanes[0]
      nodeColor = lanes[nodeLane]!.color
    } else {
      // A branch tip we haven't seen from below — open a fresh lane.
      nodeLane = firstFreeLane()
      nodeColor = nextColor++ % PALETTE_SIZE
      if (nodeLane === lanes.length) lanes.push(null)
    }

    // Pass-through lanes (not merging, not the node lane): straight vertical line.
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === null) continue
      if (i === nodeLane) continue
      if (mergingLanes.includes(i)) continue
      edges.push({ fromLane: i, toLane: i, color: lanes[i]!.color, fromTop: true, toBottom: true, from: lanes[i]!.from })
    }

    // Merging lanes (other than the node lane) draw into the node, then free up.
    for (const l of mergingLanes) {
      if (l === nodeLane) {
        // The continuing line arrives from the top into the node.
        edges.push({ fromLane: l, toLane: nodeLane, color: nodeColor, fromTop: true, toBottom: false, from: lanes[l]!.from })
      } else {
        edges.push({ fromLane: l, toLane: nodeLane, color: lanes[l]!.color, fromTop: true, toBottom: false, from: lanes[l]!.from })
        lanes[l] = null
      }
    }

    // Wire up parents (branch-out below the node).
    const parents = commit.parents
    if (parents.length === 0) {
      // Root commit: the lane ends here.
      lanes[nodeLane] = null
    } else {
      // First parent continues in the node's lane, keeping the node colour.
      lanes[nodeLane] = { target: parents[0], color: nodeColor, from: [commit.hash] }
      edges.push({
        fromLane: nodeLane,
        toLane: nodeLane,
        color: nodeColor,
        fromTop: false,
        toBottom: true,
        from: [commit.hash]
      })

      // Additional parents open their own lanes (a merge commit fans out).
      for (let p = 1; p < parents.length; p++) {
        const parentHash = parents[p]
        // Reuse a lane already waiting for this parent, if one exists.
        const existing = lanes.findIndex((l) => l?.target === parentHash)
        let pLane: number
        let pColor: number
        if (existing !== -1) {
          pLane = existing
          pColor = lanes[existing]!.color
          lanes[existing]!.from = [...lanes[existing]!.from, commit.hash]
        } else {
          pLane = firstFreeLane()
          pColor = nextColor++ % PALETTE_SIZE
          if (pLane === lanes.length) lanes.push(null)
          lanes[pLane] = { target: parentHash, color: pColor, from: [commit.hash] }
        }
        edges.push({
          fromLane: nodeLane,
          toLane: pLane,
          color: pColor,
          fromTop: false,
          toBottom: true,
          from: [commit.hash]
        })
      }
    }

    // Trim trailing empty lanes so laneCount stays tight.
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop()

    rows.push({
      commit,
      lane: nodeLane,
      color: nodeColor,
      edges,
      laneCount: Math.max(lanes.length, nodeLane + 1)
    })
  }

  return rows
}

/**
 * Hashes of every loaded commit reachable from `head` (a full or abbreviated hash)
 * by following parents — i.e. the history of the checked-out branch. Empty when
 * HEAD isn't among the loaded rows.
 */
export function reachableFrom(rows: GraphRow[], head: string | null | undefined): Set<string> {
  const out = new Set<string>()
  if (!head) return out
  const byHash = new Map(rows.map((r) => [r.commit.hash, r.commit]))
  const start = rows.find((r) => r.commit.hash.startsWith(head))
  if (!start) return out
  const stack = [start.commit.hash]
  while (stack.length > 0) {
    const h = stack.pop()!
    if (out.has(h)) continue
    out.add(h)
    for (const p of byHash.get(h)?.parents ?? []) if (byHash.has(p)) stack.push(p)
  }
  return out
}

/** Widest lane index used across all rows — for sizing the graph gutter. */
export function maxLaneCount(rows: GraphRow[]): number {
  let max = 1
  for (const r of rows) if (r.laneCount > max) max = r.laneCount
  return max
}
