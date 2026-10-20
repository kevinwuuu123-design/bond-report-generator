import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { BondRecord } from '../types/record'
import { fetchCloudRecords, loadCloudConfig, makeCloudClient, pushCloudRecords, validateCloudConfig, cloudConfigKey, type CloudConfig } from '../utils/cloud'
import { loadRecords, mergeRecords, persistRecords } from '../utils/records'

export function useArchiveStore() {
  const [config,setConfig] = useState(loadCloudConfig)
  const client = useMemo(() => config ? makeCloudClient(config) : null, [config])
  const [session,setSession] = useState<Session | null>(null)
  const [authReady,setAuthReady] = useState(!client)
  const [records,setRecords] = useState<BondRecord[]>([])
  const [loadedOwner,setLoadedOwner] = useState('')
  const [error,setError] = useState('')
  const [syncing,setSyncing] = useState(false)
  const [syncedIds,setSyncedIds] = useState<Set<string>>(new Set())
  const [lastSynced,setLastSynced] = useState('')
  const owner = session && config ? `${new URL(config.url).host}:${session.user.id}` : 'local'
  const activeOwner = useRef(owner); activeOwner.current = owner
  const authClient = useRef(client); authClient.current = client
  const syncLock = useRef<string | null>(null)

  useEffect(() => {
    setSession(null); setAuthReady(!client)
    if (!client) return
    client.auth.startAutoRefresh()
    let live = true
    const { data:{ subscription } } = client.auth.onAuthStateChange((_event,next) => { if (live) { setSession(next); setAuthReady(true) } })
    void client.auth.getSession().then(({ data,error }) => { if (live) { setSession(data.session); setAuthReady(true); if (error) setError(error.message) } }).catch(e => { if (live) { setError(String(e)); setAuthReady(true) } })
    return () => { live=false; subscription.unsubscribe(); client.auth.stopAutoRefresh() }
  }, [client])

  useEffect(() => {
    setRecords([]); setLoadedOwner(''); setSyncedIds(new Set()); setLastSynced(''); setError(''); setSyncing(false)
    if (!authReady) return
    try { setRecords(loadRecords(owner)); setLoadedOwner(owner) }
    catch (e) { setError(e instanceof Error ? e.message : '本机记录无法读取。') }
  }, [owner,authReady])

  const save = useCallback((record: BondRecord) => {
    if (!authReady || loadedOwner !== owner) throw new Error('正在读取记录，请稍后重试。')
    const next = mergeRecords(loadRecords(owner), [record])
    persistRecords(owner,next); setRecords(next)
  }, [owner,authReady,loadedOwner])

  const sync = useCallback(async () => {
    if (!client || !session || loadedOwner !== owner || syncLock.current === owner) return
    syncLock.current=owner; setSyncing(true); setError('')
    const current = () => activeOwner.current === owner && authClient.current === client
    try {
      const remote = await fetchCloudRecords(client,session.user.id)
      if (!current()) return
      const local = loadRecords(owner)
      mergeRecords(remote,local) // Verify immutable IDs before any upload.
      const ids = new Set(remote.map(r => r.id))
      const pending = local.filter(r => !ids.has(r.id))
      if (pending.length) await pushCloudRecords(client,session.user.id,pending)
      if (!current()) return
      pending.forEach(r => ids.add(r.id))
      // Re-read: a user may have archived another record while the network was in flight.
      const next = mergeRecords(remote,loadRecords(owner))
      persistRecords(owner,next); setRecords(next); setSyncedIds(ids); setLastSynced(new Date().toISOString())
    } catch (e) {
      if (current()) setError(`同步失败，本机已保存的记录仍保留。${e instanceof Error ? e.message : String((e as { message?:string }).message || e)}`)
    } finally {
      if (syncLock.current === owner) syncLock.current=null
      if (current()) setSyncing(false)
    }
  }, [client,session,owner,loadedOwner])

  useEffect(() => {
    if (!client || !session || loadedOwner !== owner) return
    void sync()
    const refresh = () => { if (document.visibilityState === 'visible') void sync() }
    const timer = window.setInterval(refresh,30000)
    window.addEventListener('online',refresh); window.addEventListener('focus',refresh)
    return () => { clearInterval(timer); window.removeEventListener('online',refresh); window.removeEventListener('focus',refresh) }
  }, [sync,client,session,loadedOwner,owner])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === `bondArchivesV1:${owner}`) {
        try { setRecords(loadRecords(owner)) } catch (e) { setError(String(e)) }
      }
    }
    window.addEventListener('storage',onStorage)
    return () => window.removeEventListener('storage',onStorage)
  }, [owner])

  const configure = (value: CloudConfig) => {
    const valid = validateCloudConfig(value)
    localStorage.setItem(cloudConfigKey,JSON.stringify(valid)); setConfig(valid)
  }
  const importRecords = (incoming: BondRecord[]) => {
    if (loadedOwner !== owner || !authReady) throw new Error('记录尚未读取完成。')
    const next = mergeRecords(loadRecords(owner),incoming)
    persistRecords(owner,next); setRecords(next)
    return incoming.length
  }
  const importLocal = () => importRecords(loadRecords('local'))
  const pending = session ? records.filter(r => !syncedIds.has(r.id)).length : 0
  return { config,client,session,authReady,owner,records:loadedOwner === owner ? records : [],ready:authReady && loadedOwner === owner,
    error,setError,syncing,sync,save,configure,importLocal,importRecords,pending,lastSynced }
}
