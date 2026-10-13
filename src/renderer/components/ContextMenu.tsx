import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { clampMenuPosition } from '../lib/menu-pos'
import { Icon } from './ui/Icon'

type IconName = Parameters<typeof Icon>[0]['name']

export function ContextMenu() {
  const { menu, closeMenu } = useStore(
    useShallow((s) => ({ menu: s.menu, closeMenu: s.closeMenu }))
  )
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  // Position after mount so we know the menu's real size, then clamp to the viewport.
  useLayoutEffect(() => {
    if (!menu) {
      setPos(null)
      return
    }
    const el = ref.current
    const w = el?.offsetWidth ?? 220
    const h = el?.offsetHeight ?? 200
    setPos(clampMenuPosition(menu.x, menu.y, w, h, window.innerWidth, window.innerHeight))
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu()
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeMenu()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [menu, closeMenu])

  if (!menu) return null

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{
        left: pos?.x ?? menu.x,
        top: pos?.y ?? menu.y,
        visibility: pos ? 'visible' : 'hidden'
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item, i) => {
        if ('type' in item && item.type === 'divider') return <div key={i} className="menu-divider" />
        if ('type' in item && item.type === 'header')
          return (
            <div key={i} className="menu-header">
              {item.label}
            </div>
          )
        const it = item as Extract<typeof item, { onSelect: () => void }>
        return (
          <button
            key={i}
            className={`menu-item ${it.danger ? 'danger' : ''}`}
            disabled={it.disabled}
            onClick={() => {
              closeMenu()
              it.onSelect()
            }}
          >
            <span className="menu-icon">
              {it.icon && <Icon name={it.icon as IconName} size={14} />}
            </span>
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
