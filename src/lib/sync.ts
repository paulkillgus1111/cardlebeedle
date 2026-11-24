import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL } from '../config'
import { db, getMeta, setMeta, SYNCED_TABLES, type Attachment, type Base, type SyncedTable } from './db'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

type Row = { id: string; collection: string; data: Record<string, unknown>; deleted: boolean; updated_at: string; synced_at: string }

/** Tabellen mit Anhängen, deren Blobs in den Storage hochgeladen werden. */
const WITH_ATTACHMENTS: SyncedTable[] = ['observations', 'lessons']

function stripForRemote(row: Base & { attachments?: Attachment[] }) {
  // Blobs gehen in den Storage, nicht in die JSON-Spalte.
  const { dirty: _dirty, ...rest } = row
  void _dirty
  if (rest.attachments) {
    return { ...rest, attachments: rest.attachments.map(({ blob: _b, ...a }) => (void _b, a)) }
  }
  return rest
}

async function uploadAttachments(userId: string, row: Base & { attachments?: Attachment[] }) {
  if (!row.attachments?.length) return row
  let changed = false
  const attachments = await Promise.all(
    row.attachments.map(async (a) => {
      if (a.remotePath || !a.blob) return a
      const path = `${userId}/${row.id}/${a.id}`
      const { error } = await supabase.storage.from('attachments').upload(path, a.blob, { contentType: a.mime, upsert: true })
      if (error) throw error
      changed = true
      return { ...a, remotePath: path }
    }),
  )
  return changed ? { ...row, attachments } : row
}

export interface SyncResult {
  pushed: number
  pulled: number
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
  let pushed = 0
  let pulled = 0

  // 1) Push: alle lokal geänderten Datensätze
  for (const name of SYNCED_TABLES) {
    const table = db.table(name)
    const dirty = (await table.where('dirty').equals(1).toArray()) as (Base & { attachments?: Attachment[] })[]
    if (!dirty.length) continue
    const prepared: (Base & { attachments?: Attachment[] })[] = []
    for (let row of dirty) {
      if (WITH_ATTACHMENTS.includes(name)) {
        row = await uploadAttachments(user.id, row)
        await table.put({ ...row }) // remotePath lokal merken
      }
      prepared.push(row)
    }
    const payload = prepared.map((r) => ({
      id: r.id,
      user_id: user.id,
      collection: name,
      data: stripForRemote(r),
      deleted: !!r.deleted,
      updated_at: r.updatedAt,
    }))
    const { error } = await supabase.from('records').upsert(payload, { onConflict: 'user_id,collection,id' })
    if (error) throw error
    // Nur zurücksetzen, wenn seitdem nicht erneut geändert wurde
    await db.transaction('rw', table, async () => {
      for (const r of prepared) {
        const cur = (await table.get(r.id)) as Base | undefined
        if (cur && cur.updatedAt === r.updatedAt) await table.put({ ...cur, dirty: 0 })
      }
    })
    pushed += prepared.length
  }

  // 2) Pull: alles, was seit dem letzten Pull auf dem Server geschrieben wurde
  const since = await getMeta<string>('lastPull', '1970-01-01T00:00:00Z')
  let cursor = since
  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('id, collection, data, deleted, updated_at, synced_at')
      .gt('synced_at', cursor)
      .order('synced_at', { ascending: true })
      .limit(500)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    for (const r of rows) {
      if (!(SYNCED_TABLES as readonly string[]).includes(r.collection)) continue
      const table = db.table(r.collection)
      const local = (await table.get(r.id)) as (Base & { attachments?: Attachment[] }) | undefined
      // Last-write-wins anhand updatedAt; lokale ungesyncte Änderungen gewinnen bei Gleichstand
      if (local && local.updatedAt >= r.updated_at) continue
      const incoming = { ...(r.data as unknown as Base), deleted: r.deleted ? 1 : 0, dirty: 0 } as Base & { attachments?: Attachment[] }
      // lokale Blobs behalten, falls vorhanden
      if (incoming.attachments && local?.attachments) {
        incoming.attachments = incoming.attachments.map((a) => ({ ...a, blob: local.attachments?.find((l) => l.id === a.id)?.blob }))
      }
      await table.put(incoming)
      pulled++
    }
    if (rows.length) cursor = rows[rows.length - 1].synced_at
    if (rows.length < 500) break
  }
  await setMeta('lastPull', cursor)
  await setMeta('lastSync', new Date().toISOString())
  return { pushed, pulled }
}

/** Lädt einen Anhang bei Bedarf aus dem Storage nach. */
export async function attachmentUrl(a: Attachment): Promise<string | null> {
  if (a.blob) return URL.createObjectURL(a.blob)
  if (!a.remotePath) return null
  const { data } = await supabase.storage.from('attachments').createSignedUrl(a.remotePath, 3600)
  return data?.signedUrl ?? null
}
