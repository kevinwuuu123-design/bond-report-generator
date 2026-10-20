import { describe,it,expect } from 'vitest'
import { amountInYi,createRecord,filterRecords,isRecord,loadRecords,mergeRecords,persistRecords,recordStorageKey } from './records'
import { emptyFields } from '../parser/parseBondText'
import { defaultOverrides } from './date'

const make = () => createRecord({ ...emptyFields,issuer:'测试发行人',shortName:'测试MTN',bondCode:'001234.IB',market:'协会',bookDate:'2026-08-20',amount:'5亿元' },'原文','报备', { inferred:new Set(['market']),notes:[],dateConfidence:{ bookDate:'verified' } },defaultOverrides)
describe('immutable archives and local persistence',()=>{
  it('captures fields, metadata and calendar without sharing mutable references',()=>{
    const fields={ ...emptyFields }, calendar=structuredClone(defaultOverrides)
    const r=createRecord(fields,'原文','报备',{ inferred:new Set(),notes:[],dateConfidence:{} },calendar)
    fields.issuer='changed'; calendar.holidays.push('2099-01-01')
    expect(r.fields.issuer).toBe('');expect(r.calendar.holidays).not.toContain('2099-01-01');expect(isRecord(r)).toBe(true)
  })
  it('persists and restores the complete snapshot, with isolated account keys',()=>{
    const r=make(), values=new Map<string,string>()
    const storage={ getItem:(k:string)=>values.get(k) || null,setItem:(k:string,v:string)=>{values.set(k,v)} }
    persistRecords('accountA',[r],storage)
    expect(loadRecords('accountA',storage)).toEqual([r]);expect(loadRecords('accountB',storage)).toEqual([])
    expect(recordStorageKey('local')).not.toBe(recordStorageKey('accountA'))
  })
  it('deduplicates JSONB key reordering but rejects conflicting payloads',()=>{
    const r=make()
    const reordered=Object.fromEntries(Object.entries(r).reverse()) as typeof r
    expect(mergeRecords([r],[reordered])).toHaveLength(1)
    expect(()=>mergeRecords([r],[{ ...r,report:'changed' }])).toThrow('内容不同')
  })
  it('rejects corrupt backups and reports full storage without reporting success',()=>{
    expect(()=>loadRecords('local',{ getItem:()=>'{bad' })).toThrow()
    expect(()=>loadRecords('local',{ getItem:()=>JSON.stringify({ version:1,records:[{}] }) })).toThrow()
    expect(()=>persistRecords('local',[make()],{ setItem:()=>{throw new Error('quota')} })).toThrow('未完成归档')
    expect(isRecord({ ...make(),fields:{} })).toBe(false)
  })
  it('filters text, market and inclusive booking dates',()=>{
    const a=make(), b={ ...make(),fields:{...emptyFields,issuer:'另一家',shortName:'公司债',market:'交易所' as const,bookDate:'2026-08-21'} }
    expect(filterRecords([a,b],{ query:'001234',market:'协会',from:'2026-08-20',to:'2026-08-20' })).toEqual([a])
    expect(filterRecords([a,b],{ query:'另一',market:'',from:'',to:'' })).toEqual([b])
  })
  it('converts only explicit monetary units, leaving ambiguous values unavailable',()=>{
    expect(amountInYi('5亿元')).toBe(5);expect(amountInYi('50,000万元')).toBe(5);expect(amountInYi('100000000元')).toBe(1)
    for(const input of ['', '5', '不超过5亿元','5+2亿元','待定']) expect(amountInYi(input)).toBeNull()
    expect(amountInYi('0亿元')).toBe(0)
  })
})
