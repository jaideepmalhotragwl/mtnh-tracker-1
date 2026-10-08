import { useEffect } from 'react'

// Escape closes any modal. Consistent everywhere, because a form that
// traps you until you find the right button is a form people stop using.
export function useEscape(onClose) {
  useEffect(() => {
    function key(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])
}
