import clsx from 'clsx'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useSyncExternalStore } from 'react'

export type ToastTone = 'info' | 'success' | 'error'
type Toast = { id: number; text: string; undo?: () => void; tone: ToastTone }
let toasts: Toast[] = []
const timers = new Map<number, ReturnType<typeof setTimeout>>()
const subs = new Set<() => void>()
const emit = () => subs.forEach((s) => s())

const dismiss = (id: number) => {
  clearTimeout(timers.get(id))
  timers.delete(id)
  toasts = toasts.filter((x) => x.id !== id)
  emit()
}

/** Kurze Rückmeldung. `undo` zeigt „Rückgängig“, `tone` färbt (Standard: neutral). */
export function toast(text: string, undo?: () => void, tone: ToastTone = 'info') {
  const t: Toast = { id: Date.now() + Math.random(), text, undo, tone }
  const dropped = toasts.slice(0, -1)
  dropped.forEach((x) => (clearTimeout(timers.get(x.id)), timers.delete(x.id)))
  toasts = [...toasts.slice(-1), t]
  emit()
  timers.set(
    t.id,
    setTimeout(() => dismiss(t.id), undo ? 4000 : tone === 'error' ? 3500 : 2500),
  )
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => toasts,
  )
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:top-[max(1rem,env(safe-area-inset-top))] md:bottom-auto print:hidden"
      role="status"
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex max-w-md animate-pop-in items-center gap-3 rounded-2xl bg-slate-900 py-2.5 pr-2.5 pl-4 text-sm text-white shadow-[var(--shadow-pop)] ring-1 ring-black/5 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-200"
          onClick={() => !t.undo && dismiss(t.id)}
        >
          {t.tone === 'success' && <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />}
          {t.tone === 'error' && <AlertCircle size={17} className="shrink-0 text-rose-400" />}
          <span className={clsx('min-w-0 flex-1 py-1', !t.undo && 'pr-1.5')}>{t.text}</span>
          {t.undo && (
            <button
              className="shrink-0 rounded-xl px-3 py-1.5 font-semibold text-brand-300 hover:bg-white/10"
              onClick={() => {
                t.undo?.()
                dismiss(t.id)
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
