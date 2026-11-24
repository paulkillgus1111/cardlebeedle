import clsx from 'clsx'
import { X, type LucideIcon } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Student, Valence } from '../lib/db'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' && 'h-9 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-[var(--shadow-glow)] ring-1 ring-brand-700/40 ring-inset hover:from-brand-400 hover:to-brand-600 !text-[#fff]',
        variant === 'secondary' && 'bg-white text-slate-800 shadow-[var(--shadow-card)] ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300',
        variant === 'soft' && 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        variant === 'danger' && 'bg-rose-600 !text-[#fff] shadow-sm hover:bg-rose-500',
        className,
      )}
    />
  )
}

export function Card({ title, icon: Icon, action, children, className, padded = true }: { title?: ReactNode; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={clsx('min-w-0 rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200/80', padded && 'p-5', className)}>
      {(title || action) && (
        <header className={clsx('mb-4 flex items-center justify-between gap-3', !padded && 'px-5 pt-5')}>
          <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
            {Icon && (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Icon size={15} strokeWidth={2.2} />
              </span>
            )}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ title, subtitle, eyebrow, actions, back }: { title: ReactNode; subtitle?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="space-y-2">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-[13px] font-medium text-slate-500">{eyebrow}</p>}
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-slate-900 md:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'brand' | 'green' | 'amber' | 'rose' | 'violet' | 'sky'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        { slate: 'bg-slate-100 text-slate-600', brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800', rose: 'bg-rose-50 text-rose-800', violet: 'bg-violet-50 text-violet-700', sky: 'bg-sky-50 text-sky-800' }[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Empty({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      {Icon && (
        <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Icon size={20} />
        </span>
      )}
      <p className="max-w-sm text-sm text-slate-400">{children}</p>
    </div>
  )
}

/** Panel für Eingaben: auf dem Handy von unten, sonst zentriert. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={clsx(
          'flex max-h-[92dvh] w-full animate-sheet-in flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[var(--shadow-pop)] ring-1 ring-slate-200/60 sm:rounded-3xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
          <h3 className="min-w-0 truncate text-[17px] font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Schließen">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">{children}</div>
      </div>
    </div>
  )
}

const GRADIENTS = [
  'from-sky-400 to-indigo-500',
  'from-amber-400 to-orange-500',
  'from-violet-400 to-fuchsia-500',
  'from-emerald-400 to-teal-500',
  'from-rose-400 to-pink-500',
  'from-lime-400 to-green-500',
  'from-cyan-400 to-sky-500',
  'from-orange-400 to-red-500',
]
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function Avatar({ student, size = 40 }: { student: Pick<Student, 'id' | 'firstName' | 'lastName'>; size?: number }) {
  const initials = (student.firstName[0] ?? '') + (student.lastName[0] ?? '')
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold !text-[#fff] shadow-sm ring-2 ring-white', GRADIENTS[hash(student.id) % GRADIENTS.length])}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
      aria-hidden
    >
      {initials.toUpperCase()}
    </span>
  )
}

export function ValenceDot({ v }: { v: Valence }) {
  return <span className={clsx('inline-block size-2 shrink-0 rounded-full', v === 'pos' ? 'bg-emerald-500' : v === 'neg' ? 'bg-rose-500' : 'bg-slate-300')} />
}

/** Ring für den Dokumentations-Deckungsgrad (0..1). */
export function CoverageRing({ value, size = 44, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 2.5
  const c = 2 * Math.PI * r
  const color = value >= 0.6 ? '#10b981' : value >= 0.3 ? '#f59e0b' : '#f43f5e'
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Dokumentation ${Math.round(value * 100)} %`}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-slate-200)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray={c} strokeDashoffset={c * (1 - value)} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      {children}
    </span>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200/50 ring-inset">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={clsx(
            'shrink-0 rounded-[9px] font-medium whitespace-nowrap transition',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]',
            value === o.value ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/70' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const inputCls =
  'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 shadow-[var(--shadow-card)] ring-1 ring-slate-200 outline-none transition ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: 'green' | 'rose' }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
      <p className={clsx('text-2xl font-semibold tracking-tight tabular-nums', tone === 'green' && 'text-emerald-600', tone === 'rose' && 'text-rose-600')}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
