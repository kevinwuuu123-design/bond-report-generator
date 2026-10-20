import { it,expect,vi } from 'vitest'
import { fetchCloudRecords,pushCloudRecords,validateCloudConfig } from './cloud'
import { createRecord } from './records'
import { emptyFields } from '../parser/parseBondText'
import { defaultOverrides } from './date'
import type { SupabaseClient } from '@supabase/supabase-js'

it('refuses privileged secrets and invalid project URLs',()=>{
  expect(validateCloudConfig({url:'https://test.supabase.co',key:'sb_publishable_test'}).url).toBe('https://test.supabase.co')
  for(const key of ['sb_secret_test','not-a-key',`x.${btoa(JSON.stringify({role:'service_role'}))}.x`]) expect(()=>validateCloudConfig({url:'https://test.supabase.co',key})).toThrow()
  expect(()=>validateCloudConfig({url:'http://test.supabase.co',key:'sb_publishable_test'})).toThrow()
})
it('paginates beyond the default server row limit using a stable cursor',async()=>{
  const records=Array.from({length:1101},()=>createRecord({...emptyFields},'raw','report',{inferred:new Set(),notes:[],dateConfidence:{}},defaultOverrides)).sort((a,b)=>a.id.localeCompare(b.id))
  let after=''
  const query={ select:vi.fn(()=>query),eq:vi.fn(()=>query),order:vi.fn(()=>query),limit:vi.fn(()=>query),gt:vi.fn((_key,value)=>{after=value;return query}),
    then:(resolve:(v:unknown)=>void)=>resolve({data:records.filter(r=>r.id>after).slice(0,250).map(r=>({id:r.id,payload:r})),error:null}) }
  const client={from:vi.fn(()=>query)} as unknown as SupabaseClient
  expect(await fetchCloudRecords(client,'userA')).toHaveLength(1101)
  expect(query.eq).toHaveBeenCalledWith('user_id','userA');expect(query.gt).toHaveBeenCalledTimes(4)
})
it('chunks uploads, never overwrites archives, and surfaces network errors',async()=>{
  const records=Array.from({length:201},()=>createRecord({...emptyFields},'raw','report',{inferred:new Set(),notes:[],dateConfidence:{}},defaultOverrides))
  const upsert=vi.fn().mockResolvedValue({error:null})
  const client={from:()=>({upsert})} as unknown as SupabaseClient
  await pushCloudRecords(client,'userA',records)
  expect(upsert).toHaveBeenCalledTimes(3)
  expect(upsert.mock.calls[0][0][0].user_id).toBe('userA')
  expect(upsert.mock.calls[0][1]).toEqual({onConflict:'user_id,id',ignoreDuplicates:true})
  upsert.mockResolvedValue({error:new Error('network down')})
  await expect(pushCloudRecords(client,'userA',records)).rejects.toThrow('network down')
})
