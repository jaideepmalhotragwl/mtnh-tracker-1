import { useState } from 'react'

const CORRECT = import.meta.env.VITE_APP_PASSWORD || 'mtnh2024'

export default function PasswordGate({ onUnlock }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (val === CORRECT) { sessionStorage.setItem('mtnh_auth', '1'); onUnlock() }
    else { setErr(true); setVal(''); setTimeout(() => setErr(false), 1500) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f3' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 340, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: '.5px', margin: '0 auto 16px' }}>MT</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>MTNH Tracker</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>Malhotra Tower Network Hub</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            placeholder="Enter password"
            value={val}
            onChange={e => setVal(e.target.value)}
            autoFocus
            style={{
              height: 40, border: `1px solid ${err ? 'var(--red)' : '#e5e7eb'}`, borderRadius: 9,
              padding: '0 14px', fontSize: 14, outline: 'none', textAlign: 'center', letterSpacing: 4,
              animation: err ? 'shake .4s ease' : 'none',
            }}
          />
          <button type="submit" style={{ height: 40, background: '#111', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 500 }}>Enter</button>
        </form>
        {err && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>Incorrect password</p>}
        <style>{`@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`}</style>
      </div>
    </div>
  )
}
