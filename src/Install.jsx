import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────
// "PUT THIS ON YOUR HOME SCREEN"
//
// Nobody on a seven-person team is going to find Add to Home Screen on
// their own, and the portal is far better as an app: full screen, its
// own icon, no address bar eating a tenth of the phone.
//
// Android fires an event we can turn into a one-tap install. iPhone
// doesn't, so there it has to be instructions — shown only on iOS
// Safari, where they're actually true.
//
// Asked once. Dismissed is dismissed.
// ─────────────────────────────────────────────────────────────────

const HIDE = 'mtnh_install_hidden'

function standalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true
}

function iosSafari() {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua)
           || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return ios && webkit
}

export default function Install() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    let hidden = false
    try { hidden = localStorage.getItem(HIDE) === '1' } catch { /* private window */ }
    if (hidden || standalone()) return

    // Android / desktop Chrome
    function grab(e) {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', grab)

    // iPhone — no event to wait for, so offer it after a moment rather
    // than the instant the portal opens.
    let t
    if (iosSafari()) t = setTimeout(() => setShow(true), 2500)

    return () => { window.removeEventListener('beforeinstallprompt', grab); clearTimeout(t) }
  }, [])

  function dismiss() {
    try { localStorage.setItem(HIDE, '1') } catch { /* private window */ }
    setShow(false)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice.catch(() => {})
    dismiss()
  }

  if (!show) return null

  return (
    <div className="installbar">
      <img src="/icon-192.png" alt="" width="34" height="34" style={{ borderRadius: 8, flex: 'none' }} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="b sm">Put MTNH on your home screen</div>
        <div className="xs mut">
          {prompt
            ? 'Opens full screen, like an app.'
            : 'Tap Share, then "Add to Home Screen".'}
        </div>
      </div>
      {prompt && <button className="pri tiny" onClick={install}>Install</button>}
      <button className="ghost tiny" onClick={dismiss}>Not now</button>
    </div>
  )
}
