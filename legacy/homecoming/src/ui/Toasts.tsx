import { useEffect } from 'react'
import { useGame, type Toast } from '../game/store'

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  )
}

function ToastItem({ t }: { t: Toast }) {
  useEffect(() => {
    const id = setTimeout(() => useGame.getState().dismissToast(t.id), t.kind === 'combat' ? 1400 : 2600)
    return () => clearTimeout(id)
  }, [t])
  return <div className={`toast toast--${t.kind}`}>{t.text}</div>
}
