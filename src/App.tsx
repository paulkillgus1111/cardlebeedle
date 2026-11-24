import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Toaster } from './components/toast'
import { ensureSeed } from './lib/seed'
import Cockpit from './pages/Cockpit'
import Einstellungen from './pages/Einstellungen'
import Gespraeche from './pages/Gespraeche'
import Kinder from './pages/Kinder'
import Klassenblick from './pages/Klassenblick'
import Unterricht from './pages/Unterricht'
import Zeugnis from './pages/Zeugnis'

export default function App() {
  useEffect(() => {
    ensureSeed()
    // Browser bitten, die lokalen Daten nicht zu löschen
    navigator.storage?.persist?.()
  }, [])
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
