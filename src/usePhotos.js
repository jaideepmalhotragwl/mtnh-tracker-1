import { useCallback, useEffect, useState } from 'react'
import { supabase, errLine, PHOTO_BUCKET } from './supabase'
import { compressImage } from './compress'
import { normSiteId } from './useProjects'

// ─────────────────────────────────────────────────────────────────
// ONE STORE, TWO DOORS  (R4)
//
// A photo uploaded from the site form and a photo posted in chat both
// land in site_photos. Nothing distinguishes them except a `source`
// label, so the gallery shows both and nobody uploads twice.
//
// Note what is NOT here: no code to tick the stage. A trigger in the
// database does that on insert, which is the only way the form and the
// chat can never disagree. See mtnh_setup.sql section 12.
// ─────────────────────────────────────────────────────────────────

export function uploadPath(siteId, stage, fileName) {
  const safe = (fileName || 'file').replace(/[^\w.\-]+/g, '_')
  const stamp = Date.now()
  return `${normSiteId(siteId) || 'unassigned'}/${stage}/${stamp}_${safe}`
}

export async function uploadOne({ file, siteId, stage, postedBy, source = 'form', caption = null, messageId = null }) {
  const { file: out, originalBytes, storedBytes } = await compressImage(file)

  const path = uploadPath(siteId, stage, out.name)
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, out, {
    cacheControl: '31536000',
    upsert: false,
    contentType: out.type || 'application/octet-stream'
  })
  if (up.error) throw new Error(errLine(up.error))

  const { data: pub } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)

  const row = {
    site_id: normSiteId(siteId) || null,
    stage,
    url: pub.publicUrl,
    caption,
    posted_by: postedBy || 'unknown',
    source,
    message_id: messageId,
    original_bytes: originalBytes,
    stored_bytes: storedBytes
  }

  const ins = await supabase.from('site_photos').insert(row).select().single()
  if (ins.error) throw new Error(errLine(ins.error))

  return { ...ins.data, originalBytes, storedBytes }
}

// A QR code or a bank receipt is not site evidence, so it goes to storage
// without a site_photos row. Keeps the gallery to actual site work.
export async function uploadRaw(file, folder = 'misc') {
  const { file: out } = await compressImage(file)
  const path = `${folder}/${Date.now()}_${(out.name || 'file').replace(/[^\w.\-]+/g, '_')}`
  const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, out, {
    cacheControl: '31536000', upsert: false,
    contentType: out.type || 'application/octet-stream'
  })
  if (up.error) throw new Error(errLine(up.error))
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadMany(files, meta, onProgress) {
  const out = []
  for (let i = 0; i < files.length; i++) {
    out.push(await uploadOne({ ...meta, file: files[i] }))
    onProgress?.(i + 1, files.length)
  }
  return out
}

// Every file for one site, newest first.
export function useSitePhotos(siteId) {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!siteId) { setPhotos([]); return }
    setLoading(true)
    const { data } = await supabase
      .from('site_photos')
      .select('*')
      .eq('site_id', normSiteId(siteId))
      .order('created_at', { ascending: false })
    setPhotos(data || [])
    setLoading(false)
  }, [siteId])

  useEffect(() => { load() }, [load])

  return { photos, loading, reload: load }
}

// The whole gallery, with a live feed so a photo posted in chat appears
// on the desktop without a refresh.
export function useAllPhotos() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('site_photos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(600)
    setPhotos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const ch = supabase.channel('photos-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'site_photos' },
          p => setPhotos(prev => [p.new, ...prev]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return { photos, loading, reload: load }
}

export async function removePhoto(photo) {
  const { error } = await supabase.from('site_photos').delete().eq('id', photo.id)
  if (error) throw new Error(errLine(error))
  // The file itself is left in storage on purpose — a deleted row should
  // not destroy evidence that may be needed later.
}
