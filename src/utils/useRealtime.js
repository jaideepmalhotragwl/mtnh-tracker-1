import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function useRealtime(onEvent) {
  const channelRef = useRef(null)

  useEffect(() => {
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, onEvent)
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onEvent])
}
