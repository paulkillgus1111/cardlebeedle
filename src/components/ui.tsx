import clsx from 'clsx'
import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Student, Valence } from '../lib/db'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'h-8 px-3 text-sm',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' && 'bg-brand-700 text-white hover:bg-brand-600',
        variant === 'secondary' && 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
        className,
      )}
    />
  )
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-sm text-slate-400">{children}</p>
}

/** Seitliches/unteres Panel für Eingaben (iPad-freundlich). */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 sm:items-center" onClick={onClose}>
      <div
        className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const PALETTE = ['bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800', 'bg-violet-100 text-violet-800', 'bg-emerald-100 text-emerald-800', 'bg-rose-100 text-rose-800', 'bg-lime-100 text-lime-800', 'bg-orange-100 text-orange-800', 'bg-cyan-100 text-cyan-800']
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Avatar({ student, size = 40 }: { student: Pick<Student, 'id' | 'firstName' | 'lastName'>; size?: number }) {
  const initials = (student.firstName[0] ?? '') + (student.lastName[0] ?? '')
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', PALETTE[hash(student.id) % PALETTE.length])}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials.toUpperCase()}
    </span>
  )
}

export function ValenceDot({ v }: { v: Valence }) {
  return <span className={clsx('inline-block size-2.5 shrink-0 rounded-full', v === 'pos' ? 'bg-emerald-500' : v === 'neg' ? 'bg-rose-500' : 'bg-slate-300')} />
}

/** Ring für den Dokumentations-Deckungsgrad (0..1). */
export function CoverageRing({ value, size = 44, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const color = value >= 0.6 ? '#10b981' : value >= 0.3 ? '#f59e0b' : '#f43f5e'
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} strokeDasharray={c} strokeDashoffset={c * (1 - value)} strokeLinecap="round" />
      </svg>
      {children}
    </span>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium', value === o.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  )
}
