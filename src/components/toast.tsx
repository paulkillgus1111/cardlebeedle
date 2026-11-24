import { useSyncExternalStore } from 'react'

type Toast = { id: number; text: string; undo?: () => void }
let toasts: Toast[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())

export function toast(text: string, undo?: () => void) {
  const t = { id: Date.now() + Math.random(), text, undo }
  toasts = [...toasts.slice(-1), t]
  emit()
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, 2800)
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => toasts,
  )
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 md:bottom-6">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {t.text}
          {t.undo && (
            <button
              className="font-semibold text-brand-100"
              onClick={() => {
                t.undo?.()
                toasts = toasts.filter((x) => x.id !== t.id)
                emit()
              }}
            >
              Rückgängig
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
