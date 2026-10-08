import { createContext, useContext, useState, useCallback } from 'react'

// A Supabase error is an object. Showing "[object Object]" is how the
// 401 key problem stayed hidden for a day, so a toast always prints the
// real text and leaves an error up until it is dismissed.

const Ctx = createContext(() => {})
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((text, kind = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setItems(x => [...x, { id, text: String(text), kind }])
    if (kind !== 'bad') {
      setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 3200)
    }
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map(i => (
          <div key={i.id} className={`toast ${i.kind}`}
               onClick={() => setItems(x => x.filter(j => j.id !== i.id))}>
            {i.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
