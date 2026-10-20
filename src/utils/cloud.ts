import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BondRecord } from '../types/record'
import { isRecord } from './records'

export interface CloudConfig { url: string; key: string }
export const cloudConfigKey = 'bondCloudConfigV1'
export function validateCloudConfig(config: CloudConfig): CloudConfig {
  const url = new URL(config.url.trim())
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('请填写 HTTPS 项目根地址，例如 https://xxx.supabase.co。')
  const key = config.key.trim()
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))
      if (payload.role !== 'anon') throw new Error()
    } catch { throw new Error('只能填写 publishable key 或 anon 公钥，不能使用 secret / service_role 密钥。') }
  }
  return { url:url.origin, key }
}
export function loadCloudConfig(): CloudConfig | null {
  try {
    const saved = localStorage.getItem(cloudConfigKey)
    if (saved) return validateCloudConfig(JSON.parse(saved))
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    return url && key ? validateCloudConfig({ url,key }) : null
  } catch { return null }
}
export function makeCloudClient(config: CloudConfig) {
  return createClient(config.url, config.key, {
    auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true },
    global:{ fetch:async (input,init) => {
      const controller=new AbortController()
      const cancel=()=>controller.abort()
      const signal=init?.signal
      if(signal?.aborted) controller.abort()
      signal?.addEventListener('abort',cancel,{once:true})
      const timer=setTimeout(cancel,20000)
      try { return await fetch(input,{...init,signal:controller.signal}) }
      finally { clearTimeout(timer);signal?.removeEventListener('abort',cancel) }
    } },
  })
}

export async function fetchCloudRecords(client: SupabaseClient, userId: string): Promise<BondRecord[]> {
  const records: BondRecord[] = []
  let lastId = ''
  while (true) {
    let query = client.from('bond_records').select('id,payload').eq('user_id',userId).order('id').limit(250)
    if (lastId) query = query.gt('id',lastId)
    const { data,error } = await query
    if (error) throw error
    if (!data) throw new Error('云端未返回数据，请稍后重试。')
    for (const row of data) {
      if (!isRecord(row.payload) || row.id !== row.payload.id) throw new Error('云端记录格式异常，已停止同步。')
      records.push(row.payload)
    }
    if (data.length < 250) return records
    lastId = data[data.length-1].id
  }
}
export async function pushCloudRecords(client: SupabaseClient, userId: string, records: BondRecord[]) {
  for (let i=0; i<records.length; i+=100) {
    const { error } = await client.from('bond_records').upsert(records.slice(i,i+100).map(r => ({ id:r.id, user_id:userId, payload:r })), { onConflict:'user_id,id', ignoreDuplicates:true })
    if (error) throw error
  }
}
