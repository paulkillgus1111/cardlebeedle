import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Toaster } from './components/toast'
import { rememberAccount } from './lib/auth'
import { openUserDb } from './lib/db'
import { ensureSeed } from './lib/seed'
import { supabase } from './lib/sync'
import AuthScreen, { SetNewPassword, Splash } from './pages/Auth'
import Cockpit from './pages/Cockpit'
import Einstellungen from './pages/Einstellungen'
import Gespraeche from './pages/Gespraeche'
import Kinder from './pages/Kinder'
import Klassenblick from './pages/Klassenblick'
import Unterricht from './pages/Unterricht'
import Zeugnis from './pages/Zeugnis'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)
  const [readyFor, setReadyFor] = useState<string | null>(null)
  const [dbError, setDbError] = useState('')

  useEffect(() => {
    // Browser bitten, die lokalen Daten nicht zu löschen
    navigator.storage?.persist?.()
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let alive = true
    if (session?.user.email) rememberAccount(session.user.email)
    openUserDb(userId)
      .then(() => ensureSeed())
      .then(() => alive && setReadyFor(userId))
      .catch((e) => alive && setDbError((e as Error).message))
    return () => {
      alive = false
    }
  }, [userId, session?.user.email])

  if (session === undefined) return <Splash />
  if (recovery && session) return <SetNewPassword onDone={() => setRecovery(false)} />
  if (!session) return <AuthScreen />
  if (dbError) return <div className="p-8 text-rose-600">Lokale Datenbank konnte nicht geöffnet werden: {dbError}</div>
  if (readyFor !== userId) return <Splash />
  return <Main key={userId} />
}

function Main() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Cockpit />} />
          <Route path="unterricht" element={<Unterricht />} />
          <Route path="unterricht/:id" element={<Unterricht />} />
          <Route path="kinder" element={<Kinder />} />
          <Route path="kinder/:id" element={<Kinder />} />
          <Route path="klasse" element={<Klassenblick />} />
          <Route path="gespraeche" element={<Gespraeche />} />
          <Route path="gespraeche/:id" element={<Gespraeche />} />
          <Route path="gespraeche/:id/:studentId" element={<Gespraeche />} />
          <Route path="zeugnis" element={<Zeugnis />} />
          <Route path="einstellungen" element={<Einstellungen />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}
