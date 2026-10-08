import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
import { AppProvider } from './store'
import { ToastProvider } from './Toast'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ToastProvider>
  </React.StrictMode>
)

// Lets the portal install to a phone's home screen and open without
// signal. Registered after load so it never slows the first paint, and
// only over https — on localhost it is skipped during development.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No offline shell. The portal works exactly as before.
    })
  })
}
