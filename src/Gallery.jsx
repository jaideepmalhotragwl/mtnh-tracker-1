import { useMemo, useState } from 'react'
import { useAllPhotos } from './usePhotos'
import { useApp } from './store'
import { normSiteId } from './useProjects'

// Every file, grouped by stage. A photo from the desktop form and one
// posted in chat sit side by side here — the caption says which door it
// came through, and that is the only difference between them.

export default function Gallery({ sites }) {
  const { photos, loading } = useAllPhotos()
  const { activeStages } = useApp()
  const [site, setSite]   = useState('')
  const [stage, setStage] = useState('')

  const nameOf = useMemo(
    () => Object.fromEntries(sites.map(s => [normSiteId(s.site_id), s.site_name])),
    [sites]
  )

  const shown = useMemo(() => {
    let p = photos
    if (site)  p = p.filter(x => (x.site_id || '').includes(normSiteId(site)))
    if (stage) p = p.filter(x => x.stage === stage)
    return p
  }, [photos, site, stage])

  const groups = useMemo(() => {
    const g = new Map()
    for (const p of shown) {
      if (!g.has(p.stage)) g.set(p.stage, [])
      g.get(p.stage).push(p)
    }
    return [...g.entries()]
  }, [shown])

  const labelOf = key => activeStages.find(s => s.key === key)?.label || key

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <div style={{ width: 200 }}>
          <input placeholder="Site ID" className="mono" value={site}
                 onChange={e => setSite(e.target.value.toUpperCase())} />
        </div>
        <div style={{ width: 200 }}>
          <select value={stage} onChange={e => setStage(e.target.value)}>
            <option value="">All stages</option>
            {activeStages.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <span className="sm mut right">{shown.length} files</span>
      </div>

      {loading && <div className="mut sm">Loading…</div>}

      {!loading && shown.length === 0 && (
        <div className="panel center mut">
          No files yet. Upload from a site form or post them in the Team Room —
          either way they land here.
        </div>
      )}

      {groups.map(([key, items]) => (
        <div key={key} style={{ marginBottom: 22 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <h3>{labelOf(key)}</h3>
            <span className="sm mut">{items.length}</span>
          </div>
          <div className="gal">
            {items.map(p => (
              <figure key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {/\.pdf($|\?)/i.test(p.url)
                    ? <div style={{ height: 118, display: 'grid', placeItems: 'center', background: 'var(--line)', color: 'var(--muted)', fontSize: 12 }}>PDF</div>
                    : <img src={p.url} alt="" loading="lazy" />}
                </a>
                <figcaption>
                  <div className="mono">{p.site_id || '—'}</div>
                  {p.site_id && nameOf[p.site_id] && (
                    <div className="trunc">{nameOf[p.site_id]}</div>
                  )}
                  <div>
                    {p.posted_by} · {p.source === 'room' ? 'Team Room' : 'site form'}
                  </div>
                  <div className="fnt">{new Date(p.created_at).toLocaleDateString('en-IN')}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
