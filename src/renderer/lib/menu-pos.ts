export interface Point {
  x: number
  y: number
}

/**
 * Clamp a context-menu's top-left origin so the whole menu stays inside the viewport.
 * If it would overflow the right/bottom edge, it flips back by its own size; never goes
 * negative. Pure — unit-tested.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  menuW: number,
  menuH: number,
  viewW: number,
  viewH: number,
  pad = 6
): Point {
  let nx = x
  let ny = y
  if (nx + menuW + pad > viewW) nx = Math.max(pad, viewW - menuW - pad)
  if (ny + menuH + pad > viewH) ny = Math.max(pad, viewH - menuH - pad)
  if (nx < pad) nx = pad
  if (ny < pad) ny = pad
  return { x: nx, y: ny }
}
