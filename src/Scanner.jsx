import { useEffect, useRef, useState } from 'react'
import { useEscape } from './useEscape'

// ─────────────────────────────────────────────────────────────────
// BARCODE / QR SCANNER
//
// Uses the browser's own BarcodeDetector, which Chrome on Android has
// and Safari does not. Where it isn't available the camera isn't opened
// at all and the box says so, because a camera that looks like it is
// scanning and never finds anything is worse than no camera.
//
// Typing the serial by hand always works and is right there.
// ─────────────────────────────────────────────────────────────────

const FORMATS = ['qr_code', 'code_128', 'code_39', 'ean_13', 'data_matrix', 'itf']

export function scannerAvailable() {
  return typeof window !== 'undefined'
    && 'BarcodeDetector' in window
    && !!navigator.mediaDevices?.getUserMedia
}

export default function Scanner({ onRead, onClose }) {
  useEscape(onClose)
  const video = useRef(null)
  const [err, setErr] = useState('')
  const [last, setLast] = useState('')

  useEffect(() => {
    let stream, timer, detector, dead = false

    async function start() {
      if (!scannerAvailable()) {
        setErr("This browser can't scan. Chrome on Android can; type the serial instead.")
        return
      }
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats()
        detector = new window.BarcodeDetector({
          formats: FORMATS.filter(f => supported.includes(f))
        })

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        if (dead) { stream.getTracks().forEach(t => t.stop()); return }
        if (video.current) {
          video.current.srcObject = stream
          await video.current.play()
        }

        timer = setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return
          try {
            const found = await detector.detect(video.current)
            if (found.length) {
              const value = String(found[0].rawValue || '').trim()
              if (value && value !== last) {
                setLast(value)
                if (navigator.vibrate) navigator.vibrate(40)
                onRead(value)
              }
            }
          } catch { /* a bad frame is not worth reporting */ }
        }, 350)
      } catch (e) {
        setErr(
          e.name === 'NotAllowedError'
            ? 'Camera permission was refused. Allow it in the browser, or type the serial.'
            : `Camera did not open: ${e.message}`
        )
      }
    }

    start()
    return () => {
      dead = true
      clearInterval(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [onRead, last])

  return (
    <div className="scrim" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal narrow">
        <div className="modal-h">
          <h2>Scan</h2>
          <button className="ghost right" onClick={onClose}>Close</button>
        </div>
        <div className="modal-b">
          {err
            ? <div className="note warnN" style={{ margin: 0 }}>{err}</div>
            : <>
                <video ref={video} playsInline muted
                       style={{ width: '100%', borderRadius: 8, background: '#000', aspectRatio: '4/3', objectFit: 'cover' }} />
                <div className="sm mut" style={{ marginTop: 8 }}>
                  Hold the label steady in the frame. Each read fills the next
                  empty serial box.
                </div>
                {last && (
                  <div className="note okN" style={{ marginTop: 8 }}>
                    Last read: <b className="mono">{last}</b>
                  </div>
                )}
              </>}
        </div>
        <div className="modal-f">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
