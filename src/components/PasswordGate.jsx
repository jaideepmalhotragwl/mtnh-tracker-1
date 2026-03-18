import { useState } from 'react'
import styles from './PasswordGate.module.css'

const CORRECT = import.meta.env.VITE_APP_PASSWORD || 'mtnh2024'

export default function PasswordGate({ onUnlock }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (val === CORRECT) {
      sessionStorage.setItem('mtnh_auth', '1')
      onUnlock()
    } else {
      setErr(true)
      setVal('')
      setTimeout(() => setErr(false), 1500)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.logo}>MT</div>
        <h1 className={styles.title}>MTNH Tracker</h1>
        <p className={styles.sub}>Malhotra Tower Network Hub</p>
        <form onSubmit={submit} className={styles.form}>
          <input
            type="password"
            placeholder="Enter password"
            value={val}
            onChange={e => setVal(e.target.value)}
            className={`${styles.input} ${err ? styles.shake : ''}`}
            autoFocus
          />
          <button type="submit" className={styles.btn}>Enter</button>
        </form>
        {err && <p className={styles.err}>Incorrect password</p>}
      </div>
    </div>
  )
}
