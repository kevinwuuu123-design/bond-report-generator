import type { ArchiveCountMode, DateConfidence, Market } from '../types/bond'

export interface WorkdayOverrides {
  holidays: string[]
  workingWeekends: string[]
  verifiedYears: number[]
}

// 2026 年默认工作日例外依据国务院办公厅《关于2026年部分节假日安排的通知》。
// 未在 verifiedYears 中的年度，系统仍可按“周一至周五”暂估，但会显著标记为“暂估”。
export const defaultOverrides: WorkdayOverrides = {
  holidays: [
    '2026-01-01','2026-01-02','2026-01-03',
    '2026-02-15','2026-02-16','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23',
    '2026-04-04','2026-04-05','2026-04-06',
    '2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05',
    '2026-06-19','2026-06-20','2026-06-21',
    '2026-09-25','2026-09-26','2026-09-27',
    '2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07',
  ],
  workingWeekends: [
    '2026-01-04','2026-02-14','2026-02-28','2026-05-09','2026-09-20','2026-10-10',
  ],
  verifiedYears: [2026],
}

export function inferIssueYear(shortName: string, rawText = ''): number | undefined {
  const full = rawText.match(/(20\d{2})年度/)
  if (full) return Number(full[1])
  const m = shortName.trim().match(/^(\d{2})/)
  if (m) return 2000 + Number(m[1])
  return undefined
}

export function normalizeDateText(input: string, defaultYear?: number): string {
  if (!input) return ''
  const full = input.match(/(20\d{2})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})日?/)
  if (full) {
    const [, y, mo, d] = full
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const md = input.match(/(\d{1,2})月(\d{1,2})日?/)
  if (md && defaultYear) {
    return `${defaultYear}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`
  }
  return ''
}

function toDate(dateText: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null
  const [y, m, d] = dateText.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function formatChineseDate(dateText: string): string {
  const d = toDate(dateText)
  if (!d) return dateText
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function isBusinessDay(date: Date, overrides: WorkdayOverrides): boolean {
  const key = dateKey(date)
  if (overrides.workingWeekends.includes(key)) return true
  if (overrides.holidays.includes(key)) return false
  const day = date.getDay()
  return day !== 0 && day !== 6
}

export interface ShiftResult {
  date: string
  confidence: DateConfidence
  unknownYears: number[]
}

export function shiftBusinessDaysDetailed(dateText: string, delta: number, overrides: WorkdayOverrides): ShiftResult {
  const d = toDate(dateText)
  if (!d) return { date: dateText, confidence: '', unknownYears: [] }
  const unknown = new Set<number>()
  const noteYear = (date: Date) => {
    if (!overrides.verifiedYears.includes(date.getFullYear())) unknown.add(date.getFullYear())
  }
  noteYear(d)
  if (delta === 0) return { date: dateText, confidence: unknown.size ? 'estimated' : 'verified', unknownYears: [...unknown] }
  let remaining = Math.abs(delta)
  const step = delta > 0 ? 1 : -1
  while (remaining > 0) {
    d.setDate(d.getDate() + step)
    noteYear(d)
    if (isBusinessDay(d, overrides)) remaining -= 1
  }
  return {
    date: dateKey(d),
    confidence: unknown.size ? 'estimated' : 'verified',
    unknownYears: [...unknown].sort(),
  }
}

export function shiftBusinessDays(dateText: string, delta: number, overrides: WorkdayOverrides): string {
  return shiftBusinessDaysDetailed(dateText, delta, overrides).date
}


export function hasConfiguredHolidayWithinDays(dateText: string, lookbackDays: number, overrides: WorkdayOverrides): boolean {
  const d = toDate(dateText)
  if (!d) return false
  for (let i = 1; i <= lookbackDays; i += 1) {
    const x = new Date(d)
    x.setDate(x.getDate() - i)
    if (overrides.holidays.includes(dateKey(x))) return true
  }
  return false
}

export function inferBookDateDetailed(baseDate: string, market: Market, overrides: WorkdayOverrides): ShiftResult {
  if (!baseDate) return { date: '', confidence: '', unknownYears: [] }
  if (market === '协会') return shiftBusinessDaysDetailed(baseDate, -1, overrides)
  if (market === '交易所') return shiftBusinessDaysDetailed(baseDate, -2, overrides)
  return { date: '', confidence: '', unknownYears: [] }
}

export function inferBookDate(baseDate: string, market: Market, overrides: WorkdayOverrides): string {
  return inferBookDateDetailed(baseDate, market, overrides).date
}

export function calculateArchiveDates(bookDate: string, overrides: WorkdayOverrides, countMode: ArchiveCountMode = '次日起算') {
  if (!bookDate) return {
    submit: '', finish: '', submitConfidence: '' as DateConfidence, finishConfidence: '' as DateConfidence, unknownYears: [] as number[],
  }
  const submitDelta = countMode === '簿记日计第1日' ? 29 : 30
  const finishDelta = countMode === '簿记日计第1日' ? 44 : 45
  const submit = shiftBusinessDaysDetailed(bookDate, submitDelta, overrides)
  const finish = shiftBusinessDaysDetailed(bookDate, finishDelta, overrides)
  return {
    submit: submit.date,
    finish: finish.date,
    submitConfidence: submit.confidence,
    finishConfidence: finish.confidence,
    unknownYears: [...new Set([...submit.unknownYears, ...finish.unknownYears])].sort(),
  }
}
