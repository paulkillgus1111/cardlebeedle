import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import { db, getMeta, setMeta, SYNCED_TABLES, type Attachment, type Base, type SyncedTable } from './db'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

type Row = { id: string; collection: string; data: Record<string, unknown>; deleted: boolean; updated_at: string; synced_at: string }
type WithAtt = Base & { attachments?: Attachment[] }

/** Tabellen mit Anhängen, deren Blobs in den Storage hochgeladen werden. */
const WITH_ATTACHMENTS: SyncedTable[] = ['observations', 'lessons']
const PAGE = 500
const OVERLAP_MS = 30_000

const ts = (s?: string) => (s ? Date.parse(s) || 0 : 0)

function stripForRemote(row: WithAtt) {
  // Gelöschte Datensätze: nur das Nötigste hochladen (keine Inhalte in der Cloud behalten)
  if (row.deleted) return { id: row.id, updatedAt: row.updatedAt, deleted: 1 }
  const { dirty: _dirty, ...rest } = row
  void _dirty
  if (rest.attachments) return { ...rest, attachments: rest.attachments.map(({ blob: _b, ...a }) => (void _b, a)) }
  return rest
}

async function uploadAttachments(userId: string, table: SyncedTable, row: WithAtt) {
  if (row.deleted || !row.attachments?.length) return row
  const paths = new Map<string, string>()
  for (const a of row.attachments) {
    if (a.remotePath || !a.blob) continue
    const path = `${userId}/${row.id}/${a.id}`
    const { error } = await supabase.storage.from('attachments').upload(path, a.blob, { contentType: a.mime, upsert: true })
    if (error) throw error
    paths.set(a.id, path)
  }
  if (!paths.size) return row
  // Nur remotePath am AKTUELLEN Datensatz nachtragen – Änderungen während des Uploads bleiben erhalten
  const t = db.table(table)
  await db.transaction('rw', t, async () => {
    const cur = (await t.get(row.id)) as WithAtt | undefined
    if (!cur) return
    await t.put({ ...cur, attachments: cur.attachments?.map((a) => (paths.has(a.id) ? { ...a, remotePath: paths.get(a.id) } : a)) })
  })
  return { ...row, attachments: row.attachments.map((a) => (paths.has(a.id) ? { ...a, remotePath: paths.get(a.id) } : a)) }
}

/** Storage-Dateien gelöschter Datensätze entfernen. */
async function removeRemoteFiles(userId: string, row: WithAtt, previous?: WithAtt) {
  const keep = new Set(row.deleted ? [] : (row.attachments ?? []).map((a) => a.remotePath))
  const gone = (previous?.attachments ?? []).map((a) => a.remotePath).filter((p): p is string => !!p && !keep.has(p) && p.startsWith(`${userId}/`))
  if (gone.length) await supabase.storage.from('attachments').remove(gone)
}

export interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
}

let running: Promise<SyncResult> | null = null

export function sync(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null))
  return running
}

async function doSync(): Promise<SyncResult> {
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) throw new Error('Nicht angemeldet')

  // Sicherheitsnetz: die geöffnete lokale Datenbank muss zu diesem Konto gehören
  const owner = await getMeta<string | null>('ownerUserId', null)
  if (owner && owner !== user.id) throw new Error('Lokale Daten gehören zu einem anderen Konto.')
  if (!owner) await setMeta('ownerUserId', user.id)

  let pushed = 0
  let pulled = 0
  const errors: string[] = []

  // 1) Push – Fehler pro Tabelle sammeln, damit ein Problem nicht alles blockiert
  for (const name of SYNCED_TABLES) {
    try {
      const table = db.table(name)
      const dirty = (await table.where('dirty').equals(1).toArray()) as WithAtt[]
      if (!dirty.length) continue
      const prepared: WithAtt[] = []
      for (const row of dirty) {
        try {
          prepared.push(WITH_ATTACHMENTS.includes(name) ? await uploadAttachments(user.id, name, row) : row)
        } catch (e) {
          errors.push(`${name}: Anhang konnte nicht hochgeladen werden (${(e as Error).message})`)
        }
      }
      if (!prepared.length) continue
      // Für Dateilöschungen: alte Version vom Server holen
      if (WITH_ATTACHMENTS.includes(name)) {
        const { data: prev } = await supabase.from('records').select('id, data').eq('collection', name).in('id', prepared.map((r) => r.id))
        for (const r of prepared) {
          const p = prev?.find((x) => x.id === r.id)?.data as WithAtt | undefined
          if (p) await removeRemoteFiles(user.id, r, p).catch(() => undefined)
        }
      }
      for (let i = 0; i < prepared.length; i += PAGE) {
        const chunk = prepared.slice(i, i + PAGE)
        const { error } = await supabase.from('records').upsert(
          chunk.map((r) => ({ id: r.id, user_id: user.id, collection: name, data: stripForRemote(r), deleted: !!r.deleted, updated_at: r.updatedAt })),
          { onConflict: 'user_id,collection,id' },
        )
        if (error) throw error
      }
      // dirty nur zurücksetzen, wenn seitdem nicht erneut geändert
      await db.transaction('rw', table, async () => {
        for (const r of prepared) {
          const cur = (await table.get(r.id)) as Base | undefined
          if (cur && cur.updatedAt === r.updatedAt) await table.put({ ...cur, dirty: 0 })
        }
      })
      pushed += prepared.length
    } catch (e) {
      errors.push(`${name}: ${(e as Error).message}`)
    }
  }

  // 2) Pull – Keyset (synced_at, id) mit Überlappung; last-write-wins ist idempotent
  const cursorKey = `lastPull:${user.id}`
  const saved = await getMeta<string>(cursorKey, '1970-01-01T00:00:00Z')
  let cursor = new Date(Math.max(0, ts(saved) - OVERLAP_MS)).toISOString()
  let lastId = '00000000-0000-0000-0000-000000000000'
  let newest = saved
  try {
    for (;;) {
      const { data, error } = await supabase
        .from('records')
        .select('id, collection, data, deleted, updated_at, synced_at')
        .or(`synced_at.gt."${cursor}",and(synced_at.eq."${cursor}",id.gt.${lastId})`)
        .order('synced_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(PAGE)
      if (error) throw error
      const rows = (data ?? []) as Row[]
      for (const r of rows) {
        if (!(SYNCED_TABLES as readonly string[]).includes(r.collection)) continue
        const table = db.table(r.collection)
        const local = (await table.get(r.id)) as WithAtt | undefined
        // Last-write-wins; bei Gleichstand gewinnt lokal
        if (local && ts(local.updatedAt) >= ts(r.updated_at)) continue
        if (r.deleted) {
          if (local) await table.put({ ...local, deleted: 1, dirty: 0, updatedAt: r.updated_at, attachments: undefined })
          pulled++
          continue
        }
        const incoming = { ...(r.data as unknown as WithAtt), deleted: 0, dirty: 0 } as WithAtt
        if (incoming.attachments && local?.attachments) {
          incoming.attachments = incoming.attachments.map((a) => ({ ...a, blob: local.attachments?.find((l) => l.id === a.id)?.blob }))
        }
        await table.put(incoming)
        pulled++
      }
      if (rows.length) {
        cursor = rows[rows.length - 1].synced_at
        lastId = rows[rows.length - 1].id
        if (ts(cursor) > ts(newest)) newest = cursor
      }
      if (rows.length < PAGE) break
    }
    await setMeta(cursorKey, newest)
  } catch (e) {
    errors.push(`Abruf: ${(e as Error).message}`)
  }
  await setMeta('lastSync', new Date().toISOString())
  await setMeta('lastSyncErrors', errors)
  if (errors.length && !pushed && !pulled) throw new Error(errors[0])
  return { pushed, pulled, errors }
}

/** Liefert eine URL für einen Anhang; lädt ihn bei Bedarf einmal herunter und speichert ihn lokal (offline verfügbar). */
export async function attachmentUrl(a: Attachment, owner?: { table: SyncedTable; id: string }): Promise<string | null> {
  if (a.blob) return URL.createObjectURL(a.blob)
  if (!a.remotePath) return null
  const { data, error } = await supabase.storage.from('attachments').download(a.remotePath)
  if (error || !data) return null
  if (owner) {
    const t = db.table(owner.table)
    await db.transaction('rw', t, async () => {
      const cur = (await t.get(owner.id)) as WithAtt | undefined
      if (cur?.attachments) await t.put({ ...cur, attachments: cur.attachments.map((x) => (x.id === a.id ? { ...x, blob: data } : x)) })
    })
  }
  return URL.createObjectURL(data)
}
