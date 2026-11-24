import clsx from 'clsx'
import { CloudOff, Eraser, Mic, Square, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Attachment, SyncedTable } from '../lib/db'
import { attachmentUrl } from '../lib/sync'
import { toast } from './toast'
import { Button } from './ui'

type Pt = { x: number; y: number; p: number }

/** Einfaches Zeichenfeld für Apple Pencil / Finger (druckempfindlich). */
export function SketchPad({ onDone, onCancel }: { onDone: (blob: Blob) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<Pt[][]>([])
  const drawing = useRef<number | null>(null)
  const [count, setCount] = useState(0)

  const ctx2d = () => ref.current?.getContext('2d') ?? null

  const segment = (ctx: CanvasRenderingContext2D, a: Pt, b: Pt) => {
    ctx.lineWidth = 1.5 + b.p * 4
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  const dot = (ctx: CanvasRenderingContext2D, a: Pt) => {
    ctx.beginPath()
    ctx.arc(a.x, a.y, (1.5 + a.p * 4) / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  const redraw = () => {
    const c = ref.current
    const ctx = ctx2d()
    if (!c || !ctx) return
    const ratio = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.fillStyle = '#0f172a'
    for (const s of strokes.current) {
      if (s.length === 1) dot(ctx, s[0])
      for (let i = 1; i < s.length; i++) segment(ctx, s[i - 1], s[i])
    }
  }

  useEffect(() => {
    const c = ref.current
    if (!c) return
    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const rect = c.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width * ratio))
      const h = Math.max(1, Math.round(rect.height * ratio))
      if (c.width !== w || c.height !== h) {
        c.width = w
        c.height = h
      }
      redraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(c)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const point = (e: { clientX: number; clientY: number; pressure: number; pointerType?: string }): Pt => {
    const r = ref.current!.getBoundingClientRect()
    // Maus/Finger liefern oft 0 oder 0.5 – dann mittlere Strichstärke
    const p = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5
    return { x: e.clientX - r.left, y: e.clientY - r.top, p }
  }

  const end = (e: React.PointerEvent) => {
    if (drawing.current !== e.pointerId) return
    drawing.current = null
    setCount(strokes.current.length)
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={ref}
        className="h-[min(60dvh,28rem)] w-full touch-none rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-slate-200"
        onPointerDown={(e) => {
          if (drawing.current !== null) return
          drawing.current = e.pointerId
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          const p = point(e)
          strokes.current.push([p])
          const ctx = ctx2d()
          if (ctx) dot(ctx, p)
        }}
        onPointerMove={(e) => {
          if (drawing.current !== e.pointerId) return
          const s = strokes.current[strokes.current.length - 1]
          const ctx = ctx2d()
          const native = e.nativeEvent as PointerEvent
          const evs = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
          const pts = (evs.length ? evs : [native]).map(point)
          for (const p of pts) {
            const prev = s[s.length - 1]
            s.push(p)
            if (ctx) segment(ctx, prev, p)
          }
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!count}
          onClick={() => {
            strokes.current.pop()
            setCount(strokes.current.length)
            redraw()
          }}
        >
          <Undo2 size={16} /> Zurück
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!count}
          onClick={() => {
            strokes.current = []
            setCount(0)
            redraw()
          }}
        >
          <Eraser size={16} /> Leeren
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button size="sm" disabled={!count} onClick={() => ref.current?.toBlob((b) => (b ? onDone(b) : toast('Skizze konnte nicht gespeichert werden', undefined, 'error')), 'image/png')}>
          Übernehmen
        </Button>
      </div>
    </div>
  )
}

const canRecord = () => typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** Sprachmemo aufnehmen (Safari: audio/mp4, sonst webm). */
export function VoiceRecorder({ onDone, onRecordingChange }: { onDone: (blob: Blob, mime: string) => void; onRecordingChange?: (recording: boolean) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [secs, setSecs] = useState(0)
  const [starting, setStarting] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const unmounted = useRef(false)
  const cbs = useRef({ onDone, onRecordingChange })
  cbs.current = { onDone, onRecordingChange }

  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [rec])

  useEffect(() => {
    unmounted.current = false
    return () => {
      unmounted.current = true
      const r = recRef.current
      if (r && r.state !== 'inactive') {
        r.onstop = null
        try {
          r.stop()
        } catch {
          /* egal */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      cbs.current.onRecordingChange?.(false)
    }
  }, [])

  if (!canRecord()) return null

  const start = async () => {
    if (starting || recRef.current) return
    setStarting(true)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      setStarting(false)
      const name = (e as DOMException)?.name
      toast(name === 'NotAllowedError' || name === 'SecurityError' ? 'Mikrofon nicht erlaubt' : 'Mikrofon nicht verfügbar', undefined, 'error')
      return
    }
    if (unmounted.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    try {
      const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      const type = mime || r.mimeType || 'audio/webm'
      const chunks: Blob[] = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        recRef.current = null
        if (chunks.length) cbs.current.onDone(new Blob(chunks, { type }), type)
        cbs.current.onRecordingChange?.(false)
      }
      r.start()
      streamRef.current = stream
      recRef.current = r
      setSecs(0)
      setRec(r)
      cbs.current.onRecordingChange?.(true)
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      toast('Aufnahme nicht möglich', undefined, 'error')
    } finally {
      setStarting(false)
    }
  }
  const stop = () => {
    const r = recRef.current
    if (r && r.state !== 'inactive') r.stop()
    setRec(null)
  }
  return rec ? (
    <Button variant="danger" size="sm" onClick={stop}>
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
        <Square size={10} className="relative fill-current" />
      </span>
      Stopp <span className="tabular-nums">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
    </Button>
  ) : (
    <Button variant="secondary" size="sm" onClick={start} disabled={starting}>
      <Mic size={16} /> Memo
    </Button>
  )
}

/** Web-Speech-Diktat (Safari/Chrome), hängt erkannten Text an. */
type SpeechResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
export function useDictation(onText: (t: string) => void) {
  const [active, setActive] = useState(false)
  const ref = useRef<SpeechRecognitionLike | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition

  useEffect(
    () => () => {
      const r = ref.current
      if (!r) return
      r.onresult = r.onerror = r.onend = null
      try {
        r.abort()
      } catch {
        /* egal */
      }
      ref.current = null
    },
    [],
  )

  const toggle = () => {
    if (!Ctor) return
    if (active && ref.current) {
      ref.current.stop()
      return
    }
    let r: SpeechRecognitionLike
    try {
      r = new Ctor()
      r.lang = 'de-DE'
      r.interimResults = false
      r.continuous = true
      r.onresult = (e) => {
        const parts: string[] = []
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) parts.push(res[0].transcript.trim())
        }
        const t = parts.filter(Boolean).join(' ')
        if (t) onTextRef.current(t)
      }
      r.onerror = (e) => {
        if (e.error === 'aborted' || e.error === 'no-speech') return
        toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Mikrofon nicht erlaubt' : e.error === 'network' ? 'Diktat braucht Internet' : 'Diktat abgebrochen', undefined, 'error')
      }
      r.onend = () => {
        if (ref.current === r) ref.current = null
        setActive(false)
      }
      ref.current = r
      r.start()
      setActive(true)
    } catch {
      ref.current = null
      setActive(false)
      toast('Diktat konnte nicht starten', undefined, 'error')
    }
  }
  return { supported: !!Ctor, active, toggle }
}

export function AttachmentView({ a, className, owner }: { a: Attachment; className?: string; owner?: { table: SyncedTable; id: string } }) {
  const [state, setState] = useState<{ url: string | null; done: boolean }>({ url: null, done: false })
  const hasBlob = !!a.blob
  useEffect(() => {
    let cancelled = false
    let u: string | null = null
    setState({ url: null, done: false })
    attachmentUrl(a, owner)
      .then((x) => {
        if (cancelled) {
          if (x?.startsWith('blob:')) URL.revokeObjectURL(x)
          return
        }
        u = x
        setState({ url: x, done: true })
      })
      .catch(() => !cancelled && setState({ url: null, done: true }))
    return () => {
      cancelled = true
      if (u?.startsWith('blob:')) URL.revokeObjectURL(u)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, a.remotePath, hasBlob, owner?.table, owner?.id])

  const { url, done } = state
  if (!url) {
    if (a.type === 'audio')
      return (
        <div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-full bg-slate-100 px-4 text-xs text-slate-400">
          {done ? (
            <>
              <CloudOff size={14} /> Memo offline nicht verfügbar
            </>
          ) : (
            <span className="h-2 w-full animate-pulse rounded-full bg-slate-200" />
          )}
        </div>
      )
    return (
      <div className={clsx(className ?? 'h-24 w-24 rounded-lg', 'flex items-center justify-center bg-slate-100 text-slate-400', !done && 'animate-pulse')} title={done ? 'offline nicht verfügbar' : undefined}>
        {done && (
          <span className="flex flex-col items-center gap-1 px-1 text-center text-[10px] leading-tight">
            <CloudOff size={16} />
            offline nicht verfügbar
          </span>
        )}
      </div>
    )
  }
  if (a.type === 'audio') return <audio controls src={url} className="w-full max-w-xs" />
  return (
    <img
      src={url}
      alt={a.type === 'sketch' ? 'Skizze' : 'Foto'}
      className={className ?? 'h-24 w-24 cursor-zoom-in rounded-lg object-cover ring-1 ring-slate-200'}
      onClick={() => window.open(url, '_blank')}
    />
  )
}

/** Fotos verkleinern, bevor sie gespeichert werden. */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.82))
}
