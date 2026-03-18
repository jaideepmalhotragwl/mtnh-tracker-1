import styles from './Toast.module.css'

export default function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`${styles.toast} ${toast.type === 'error' ? styles.error : ''}`}>
      {toast.msg}
    </div>
  )
}
