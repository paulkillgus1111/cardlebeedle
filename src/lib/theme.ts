import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'theme'
const subs = new Set<() => void>()

function read(): ThemePref {
  try {
    return (localStorage.getItem(KEY) as ThemePref) || 'system'
  } catch {
    return 'system'
  }
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function applyTheme() {
  const pref = read()
  const dark = pref === 'dark' || (pref === 'system' && !!media?.matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d1117' : '#f4f6f8')
}

media?.addEventListener('change', () => {
  applyTheme()
  subs.forEach((s) => s())
})

export function setTheme(p: ThemePref) {
  try {
    localStorage.setItem(KEY, p)
  } catch {
    /* ignorieren */
  }
  applyTheme()
  subs.forEach((s) => s())
}

export function useTheme() {
  return useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), read)
}
