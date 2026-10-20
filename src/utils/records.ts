import { emptyFields } from '../parser/parseBondText'
import type { BondRecord } from '../types/record'
import type { BondFields, ParseMeta } from '../types/bond'
import type { WorkdayOverrides } from './date'

export const recordStorageKey = (owner: string) => `bondArchivesV1:${owner}`
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical((value as Record<string,unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value)
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isRecord(value: unknown): value is BondRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as BondRecord
  return typeof r.id === 'string' && uuid.test(r.id) &&
    (r.sourceId === undefined || (typeof r.sourceId === 'string' && uuid.test(r.sourceId))) &&
    typeof r.createdAt === 'string' && Number.isFinite(Date.parse(r.createdAt)) &&
    typeof r.raw === 'string' && typeof r.report === 'string' && r.report.length <= 100000 && r.raw.length <= 100000 &&
    !!r.fields && Object.keys(emptyFields).every(k => typeof r.fields[k as keyof BondFields] === 'string' && r.fields[k as keyof BondFields].length <= 100000) &&
    !!r.meta && Array.isArray(r.meta.inferred) && r.meta.inferred.every(k => k in emptyFields) &&
    Array.isArray(r.meta.notes) && r.meta.notes.every(n => typeof n === 'string') &&
    !!r.meta.dateConfidence && typeof r.meta.dateConfidence === 'object' &&
    !!r.calendar && Array.isArray(r.calendar.holidays) && r.calendar.holidays.every(x => typeof x === 'string') &&
    Array.isArray(r.calendar.workingWeekends) && r.calendar.workingWeekends.every(x => typeof x === 'string') &&
    Array.isArray(r.calendar.verifiedYears) && r.calendar.verifiedYears.every(x => typeof x === 'number')
}

export function mergeRecords(...groups: BondRecord[][]): BondRecord[] {
  const byId = new Map<string, BondRecord>()
  for (const group of groups) for (const r of group) {
    const old = byId.get(r.id)
    if (old && canonical(old) !== canonical(r)) throw new Error('发现相同编号但内容不同的记录，已停止合并以保护原记录。')
    byId.set(r.id, r)
  }
  return [...byId.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
}

export function loadRecords(owner: string, storage: Pick<Storage, 'getItem'> = localStorage): BondRecord[] {
  const raw = storage.getItem(recordStorageKey(owner))
  if (!raw) return []
  const data = JSON.parse(raw)
  if (data.version !== 1 || !Array.isArray(data.records) || !data.records.every(isRecord)) {
    throw new Error('本机记录格式异常，已停止写入。请先导出原始备份，勿清除浏览器数据。')
  }
  return mergeRecords(data.records)
}

export function persistRecords(owner: string, records: BondRecord[], storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(recordStorageKey(owner), JSON.stringify({ version: 1, records })) }
  catch { throw new Error('本机存储写入失败（可能空间已满或浏览器禁止存储），本次未完成归档。请先备份已有记录。') }
}

export function createRecord(fields: BondFields, raw: string, report: string, meta: ParseMeta, calendar: WorkdayOverrides, sourceId?: string): BondRecord {
  const record: BondRecord = {
    id: crypto.randomUUID(), createdAt: new Date().toISOString(), fields: { ...fields }, raw, report,
    meta: { inferred: [...meta.inferred], notes: [...meta.notes], dateConfidence: { ...meta.dateConfidence } },
    calendar: structuredClone(calendar), ...(sourceId ? { sourceId } : {}),
  }
  if (!isRecord(record)) throw new Error('记录内容超出保存范围，请缩短原文或字段后重试。')
  return record
}

export interface RecordFilter { query: string; from: string; to: string; market: string }
export function filterRecords(records: BondRecord[], filter: RecordFilter) {
  const q = filter.query.trim().toLocaleLowerCase()
  return records.filter(r => {
    const f = r.fields
    return (!q || [f.issuer, f.bondCode, f.shortName, f.bondType, f.continuingLead, f.continuingExecutor].some(v => v.toLocaleLowerCase().includes(q))) &&
      (!filter.market || f.market === filter.market) && (!filter.from || f.bookDate >= filter.from) && (!filter.to || (!!f.bookDate && f.bookDate <= filter.to))
  })
}

/** Only unambiguous amounts are included; missing/complex values are never treated as zero. */
export function amountInYi(value: string): number | null {
  const match = value.replace(/[\s,，]/g, '').match(/^([0-9]+(?:\.[0-9]+)?)(亿元?|万元?|元)$/)
  if (!match) return null
  return Number(match[1]) / (match[2].startsWith('亿') ? 1 : match[2].startsWith('万') ? 10000 : 100000000)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
