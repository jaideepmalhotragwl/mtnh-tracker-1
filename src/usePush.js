import { useCallback, useEffect, useState } from 'react'
import { supabase, errLine } from './supabase'

// ─────────────────────────────────────────────────────────────────
// PHONE NOTIFICATIONS — THE PHONE'S SIDE
//
// A phone says yes once. After that, whoever picked their name on that
// phone gets buzzed for their tasks, mentions and payments, with the app
// closed. The public half of the key lives here; the private half is in
// the database where the browser can't read it.
//
// iPhone is stricter than Android: notifications only work once the app
// has been added to the home screen and opened from there. In Safari
// itself they never will, so the button says that instead of failing.
// ─────────────────────────────────────────────────────────────────

const PUBLIC_KEY =
  'BFshtkukmllLdsOhtaTxhozrmLNBygePlYew77PcvNCm5eq9MkqvlRrXTYZx_KTpBpidL6ZMn3q_aewyJ4KD6vo'

function keyBytes(b64url) {
  const p = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4)
  return Uint8Array.from(atob(p), c => c.charCodeAt(0))
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

function device() {
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua))   return 'iPad'
  if (/android/i.test(ua)) return 'Android'
  if (/mac/i.test(ua))    return 'Mac'
  if (/windows/i.test(ua)) return 'Windows'
  return 'Browser'
}

// The service worker, if there is one. Never waits for ever: on a dev
// machine or an old browser there is none, and .ready would never come.
async function worker() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) return reg
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise(r => setTimeout(() => r(null), 4000))
  ])
}

async function save(sub, me) {
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_name: me,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    device: device(),
    last_seen_at: new Date().toISOString()
  }, { onConflict: 'endpoint' })

  if (error) {
    if (/push_subscriptions/.test(error.message || '') || error.code === '42P01') {
      throw new Error('Phone notifications aren\'t set up yet — run mtnh_push.sql in Supabase.')
    }
    throw new Error(errLine(error))
  }
}

// state:
//   unsupported   this browser can't do it at all
//   install-first iPhone in Safari — add to home screen first
//   blocked       the person said no; only the phone's settings can undo it
//   off           can be turned on
//   on            this phone buzzes for `me`
export function usePush(me) {
  const [state, setState] = useState('off')
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    // An iPhone in Safari can never do it, whatever it claims — only the
    // home-screen app can. Say so first, before anything else is tried.
    if (isIos() && !isInstalled()) { setState('install-first'); return }

    const supported = 'serviceWorker' in navigator &&
      typeof window.PushManager !== 'undefined' &&
      typeof window.Notification !== 'undefined'
    if (!supported) { setState('unsupported'); return }
    if (Notification.permission === 'denied') { setState('blocked'); return }

    const reg = await worker()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub && Notification.permission === 'granted') {
      setState('on')
      // Every time the app opens: re-tie this phone to whoever is picked
      // in the top right. If the phone changed hands, the buzzing follows.
      if (me) save(sub, me).catch(() => {})
    } else {
      setState('off')
    }
  }, [me])

  useEffect(() => { check() }, [check])

  async function turnOn() {
    if (!me) throw new Error('Pick your name in the top right first.')
    setBusy(true)
    try {
      const reg = await worker()
      if (!reg) throw new Error('Open the installed app (from the home screen) and try again.')

      const answer = await Notification.requestPermission()
      if (answer !== 'granted') {
        setState(answer === 'denied' ? 'blocked' : 'off')
        throw new Error('Notifications weren\'t allowed.')
      }

      const sub = await reg.pushManager.getSubscription() ||
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(PUBLIC_KEY)
        })

      await save(sub, me)
      setState('on')

      // Proof it works, right now, from the phone itself — rather than
      // waiting for the next task to find out.
      reg.showNotification('MTNH notifications are on', {
        body: `${me}, you'll be told here about your tasks, mentions and payments.`,
        icon: '/icon-192.png',
        badge: '/badge-96.png',
        tag: 'mtnh-on'
      })
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const reg = await worker()
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  return { state, busy, turnOn, turnOff, recheck: check }
}
