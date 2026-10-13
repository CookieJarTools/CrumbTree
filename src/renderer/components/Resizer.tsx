import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'

interface Props {
  sizeKey: string
  axis: 'x' | 'y'
  /** Default size in px when nothing is stored. */
  def: number
  min: number
  max: number
  /** +1 if the resized panel sits *before* the handle, -1 if *after*. */
  dir?: 1 | -1
}

/** A draggable divider that adjusts a persisted layout size. Double-click resets. */
export function Resizer({ sizeKey, axis, def, min, max, dir = 1 }: Props) {
  const { layout, setSize } = useStore(
    useShallow((s) => ({ layout: s.layout, setSize: s.setSize }))
  )

  const start = (e: React.MouseEvent) => {
    e.preventDefault()
    const startPos = axis === 'x' ? e.clientX : e.clientY
    const startSize = layout[sizeKey] ?? def
    document.body.classList.add(axis === 'x' ? 'resizing-x' : 'resizing-y')
    const onMove = (ev: MouseEvent) => {
      const pos = axis === 'x' ? ev.clientX : ev.clientY
      const next = Math.min(max, Math.max(min, startSize + dir * (pos - startPos)))
      setSize(sizeKey, next)
    }
    const onUp = () => {
      document.body.classList.remove('resizing-x', 'resizing-y')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className={`resizer resizer-${axis}`}
      onMouseDown={start}
      onDoubleClick={() => setSize(sizeKey, def)}
      title="Drag to resize · double-click to reset"
    />
  )
}

/** Read a persisted layout size (px). */
export function useSize(key: string, def: number): number {
  return useStore((s) => s.layout[key] ?? def)
}
