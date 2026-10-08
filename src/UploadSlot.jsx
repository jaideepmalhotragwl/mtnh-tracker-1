import { useState } from 'react'
import { uploadMany } from './usePhotos'
import { kb } from './compress'
import { useApp } from './store'
import { useToast } from './Toast'

// ─────────────────────────────────────────────────────────────────
// AN UPLOAD SLOT  (R3, R5)
//
// One component, used by every stage that produces evidence. Which
// stages those are comes from the photo_stages table, so adding a slot
// is a row in Settings, not a code change.
//
// What this does NOT do is tick the stage. The database does that when
// the row lands in site_photos — which is why an upload from the Team
// Room has exactly the same effect as one from here.
// ─────────────────────────────────────────────────────────────────

export default function UploadSlot({ stage, siteId, photos, onDone, isNew }) {
  const [busy, setBusy] = useState('')
  const [justDid, setJustDid] = useState(null)
  const { me } = useApp()
  const toast = useToast()

  const mine = photos.filter(p => p.stage === stage.key)
  const isPdf = stage.file_kind === 'pdf'

  async function pick(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return

    if (!siteId) { toast('Give the site an ID first, then upload.', 'bad'); return }
    if (!me)     { toast('Pick your name in the top right first.', 'bad'); return }

    setBusy(`0 of ${files.length}`)
    try {
      const out = await uploadMany(
        files,
        { siteId, stage: stage.key, postedBy: me, source: 'form' },
        (n, t) => setBusy(`${n} of ${t}`)
      )
      const saved = out.reduce((a, p) => a + (p.originalBytes - p.storedBytes), 0)
      setJustDid({ n: out.length, saved })
      onDone?.()
    } catch (err) {
      toast(err.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className={`slot ${mine.length ? 'has' : ''}`}>
      <div className="slot-h">
        <span className="lbl">{stage.label}</span>
        {isNew && <span className="badge-new">NEW</span>}
        <span className="right sm mut">
          {mine.length ? `${mine.length} file${mine.length > 1 ? 's' : ''}` : isPdf ? 'PDF' : 'photos'}
        </span>
      </div>

      <input
        type="file"
        multiple={!isPdf}
        accept={isPdf ? '.pdf,application/pdf' : 'image/*'}
        onChange={pick}
        disabled={!!busy}
      />

      {busy && <div className="sm mut" style={{ marginTop: 6 }}>Uploading {busy}…</div>}

      {mine.length > 0 && (
        <div className="thumbs">
          {mine.slice(0, 8).map(p => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={`${p.posted_by} · ${p.source === 'room' ? 'from Team Room' : 'from this form'}`}>
              {isPdf
                ? <span className="thumb pdf">PDF</span>
                : <img className="thumb" src={p.url} alt="" loading="lazy" />}
            </a>
          ))}
          {mine.length > 8 && <span className="thumb pdf">+{mine.length - 8}</span>}
        </div>
      )}

      {justDid && (
        <div className="adv">
          ✓ {justDid.n} file{justDid.n > 1 ? 's' : ''} uploaded — stage marked done, card moved
          {justDid.saved > 0 && <span className="mut"> · {kb(justDid.saved)} of upload saved</span>}
        </div>
      )}

      {!justDid && mine.length > 0 && mine.some(p => p.source === 'room') && (
        <div className="sm mut" style={{ marginTop: 6 }}>
          Includes files posted in the Team Room.
        </div>
      )}
    </div>
  )
}
