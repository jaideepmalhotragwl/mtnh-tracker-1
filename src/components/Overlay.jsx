import styles from './Overlay.module.css'

export default function Overlay({ children, onClose }) {
  return (
    <div className={styles.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  )
}
