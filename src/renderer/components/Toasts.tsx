import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store/store'
import { Icon } from './ui/Icon'

export function Toasts() {
  const { toasts, dismissToast } = useStore(
    useShallow((s) => ({ toasts: s.toasts, dismissToast: s.dismissToast }))
  )
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <Icon name={t.kind === 'error' ? 'warning' : t.kind === 'success' ? 'check' : 'dot'} size={15} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  )
}
