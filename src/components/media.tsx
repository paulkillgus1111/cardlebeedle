import { Eraser, Mic, Square, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { attachmentUrl } from '../lib/sync'
import type { Attachment } from '../lib/db'
import { Button } from './ui'

/** Einfaches Zeichenfeld für Apple Pencil / Finger (druckempfindlich). */
export function SketchPad({ onDone, onCancel }: { onDone: (blob: Blob) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<{ x: number; y: number; p: number }[][]>([])
  const drawing = useRef(false)

  const redraw = () => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#0f172a'
    for (const s of strokes.current) {
      for (let i = 1; i < s.length; i++) {
        ctx.lineWidth = 1.5 + s[i].p * 4
        ctx.beginPath()
        ctx.moveTo(s[i - 1].x, s[i - 1].y)
        ctx.lineTo(s[i].x, s[i].y)
        ctx.stroke()
      }
    }
  }

  useEffect(() => {
    const c = ref.current!
    const ratio = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * ratio
    c.height = rect.height * ratio
    c.getContext('2d')!.scale(ratio, ratio)
    redraw()
  }, [])

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={ref}
        className="h-72 w-full touch-none rounded-xl border border-slate-200 bg-white"
        onPointerDown={(e) => {
          drawing.current = true
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          strokes.current.push([point(e)])
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          strokes.current[strokes.current.length - 1].push(point(e))
          redraw()
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => (strokes.current.pop(), redraw())}>
          <Undo2 size={16} /> Zurück
        </Button>
        <Button variant="secondary" size="sm" onClick={() => ((strokes.current = []), redraw())}>
          <Eraser size={16} /> Leeren
        </Button>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button size="sm" onClick={() => ref.current!.toBlob((b) => b && onDone(b), 'image/png')}>
          Übernehmen
        </Button>
      </div>
    </div>
  )
}

/** Sprachmemo aufnehmen (Safari: audio/mp4, sonst webm). */
export function VoiceRecorder({ onDone }: { onDone: (blob: Blob, mime: string) => void }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [rec])

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
    const r = new MediaRecorder(stream, { mimeType: mime })
    const chunks: Blob[] = []
    r.ondataavailable = (e) => chunks.push(e.data)
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      onDone(new Blob(chunks, { type: mime }), mime)
    }
    r.start()
    setSecs(0)
    setRec(r)
  }
  const stop = () => {
    rec?.stop()
    setRec(null)
  }
  return rec ? (
    <Button variant="danger" size="sm" onClick={stop}>
      <Square size={14} /> Stopp {secs}s
    </Button>
  ) : (
    <Button variant="secondary" size="sm" onClick={start}>
      <Mic size={16} /> Memo
    </Button>
  )
}

/** Web-Speech-Diktat (Safari/Chrome), hängt erkannten Text an. */
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void
  onend: () => void
}
export function useDictation(onText: (t: string) => void) {
  const [active, setActive] = useState(false)
  const ref = useRef<SpeechRecognitionLike | null>(null)
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition
  const toggle = () => {
    if (!Ctor) return
    if (active) {
      ref.current?.stop()
      return
    }
    const r = new Ctor()
    r.lang = 'de-DE'
    r.interimResults = false
    r.continuous = true
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      onText(last[0].transcript)
    }
    r.onend = () => setActive(false)
    ref.current = r
    r.start()
    setActive(true)
  }
  return { supported: !!Ctor, active, toggle }
}

export function AttachmentView({ a, className }: { a: Attachment; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    attachmentUrl(a).then((x) => setUrl((u = x)))
    return () => {
      if (u?.startsWith('blob:')) URL.revokeObjectURL(u)
    }
  }, [a])
  if (!url) return <div className={className ?? 'h-24 w-24 rounded-lg bg-slate-100'} />
  if (a.type === 'audio') return <audio controls src={url} className="w-full max-w-xs" />
  return <img src={url} alt="" className={className ?? 'h-24 w-24 rounded-lg object-cover ring-1 ring-slate-200'} onClick={() => window.open(url, '_blank')} />
}

/** Fotos verkleinern, bevor sie gespeichert werden. */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', 0.82))
}
