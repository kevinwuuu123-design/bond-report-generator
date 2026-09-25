import type { BondFields, ParseMeta } from '../types/bond'
import { defaultRateLabel, detectBondType, detectMarket } from './detect'
import { normalizeDateText, inferBookDateDetailed, calculateArchiveDates, inferIssueYear, hasConfiguredHolidayWithinDays, type WorkdayOverrides } from '../utils/date'

export const emptyFields: BondFields = {
  issuer: '', bondCode: '', shortName: '', bondType: '', market: '', bookDate: '', paymentDate: '', interestStartDate: '',
  issuerRating: '', bondRating: '', guarantee: '', amount: '', term: '', rateLabel: '票面利率', coupon: '', bookMultiple: '',
  leadRole: '', coUnderwriters: '', salesMethod: '', ourUnderwritingAndFee: '', continuingLead: '', continuingExecutor: '',
  archiveSubmitDate: '', archiveFinishDate: '', archiveWording: '归档', archiveCountMode: '次日起算', aExposurePrefix: '我司使用A类', aExposure: '', approvalStatus: ''
}

function get(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) return m[1].trim().replace(/[，,。；;]$/, '')
  }
  return ''
}

function normalizeAmount(v: string) {
  if (!v) return ''
  return /亿元?$/.test(v) ? v.replace(/\s+/g, '') : `${v.replace(/\s+/g, '')}亿元`
}

function normalizePercent(v: string) {
  if (!v) return ''
  return v.replace(/\s+/g, '').replace(/%+$/, '') + '%'
}

function normalizeMultiple(v: string) {
  if (!v) return ''
  return v.replace(/\s+/g, '').replace(/倍+$/, '') + '倍'
}

function parseTitlePair(text: string): { shortName: string, bondCode: string } {
  const m = text.match(/【\s*([^】]+?)\s*】/)
  if (!m) return { shortName: '', bondCode: '' }
  let inner = m[1].replace(/\s*发行簿记结果\s*$/, '').trim()
  const parts = inner.split(/[，,/]/).map(x => x.trim()).filter(Boolean)
  if (parts.length >= 2 && /^\d{6,12}(?:\.[A-Z]+)?$/i.test(parts[1])) {
    return { shortName: parts[0], bondCode: parts[1] }
  }
  return { shortName: inner, bondCode: '' }
}

export function parseBondText(text: string, overrides: WorkdayOverrides): { fields: BondFields, meta: ParseMeta } {
  const fields: BondFields = { ...emptyFields }
  const inferred = new Set<keyof BondFields>()
  const notes: string[] = []
  const dateConfidence: ParseMeta['dateConfidence'] = {}

  const title = parseTitlePair(text)
  fields.issuer = get(text, [/发行人(?:全称)?[：:]\s*([^\n]+)/, /^([^\n，,]{4,60}?(?:集团有限公司|股份有限公司|有限责任公司|有限公司))(?=20\d{2}年度|[，,\s]|$)/m])
  fields.bondCode = get(text, [/债券代码[：:]\s*([^\s\n]+)/, /简称和代码[：:]\s*[^（(]+[（(]([^）)]+)[）)]/]) || title.bondCode
  fields.shortName = get(text, [/债券简称[：:]\s*([^\n]+)/, /简称和代码[：:]\s*([^（(\n]+)/]) || title.shortName

  const issueYear = inferIssueYear(fields.shortName, text)
  fields.term = get(text, [/债券期限\s*[：:]\s*([^\n]+)/, /期限\s*[：:]\s*([^\n]+)/])
  fields.amount = normalizeAmount(get(text, [/发行规模\s*[：:]\s*([\d.]+\s*亿元?)/, /发行规模\s*[：:]\s*([\d.]+)/]))
  fields.bookMultiple = normalizeMultiple(get(text, [/全场倍数\s*[：:]\s*([\d.]+\s*倍?)/]))
  fields.coupon = normalizePercent(get(text, [/(?:票面利率|债券利率|发行利率)\s*[：:]\s*([\d.]+\s*%?)/]))

  const paymentRaw = get(text, [/缴款日期\s*[：:]\s*([^\n（(]+)/, /缴款日\s*[：:]\s*([^\n（(]+)/, /缴款起息\s*[：:]\s*([^\n（(]+)/])
  const interestRaw = get(text, [/起息日期?\s*[：:]\s*([^\n（(]+)/, /缴款起息\s*[：:]\s*([^\n（(]+)/])
  fields.paymentDate = normalizeDateText(paymentRaw, issueYear)
  fields.interestStartDate = normalizeDateText(interestRaw, issueYear)
  fields.bookDate = normalizeDateText(get(text, [/簿记日期?\s*[：:]\s*([^\n（(]+)/]), issueYear)

  fields.issuerRating = get(text, [/主体评级\s*[：:]?\s*([^，,。；;\n]+)/i])
  fields.bondRating = get(text, [/(无债项评级|无债项)(?=[，,。；;\n]|$)/i, /债项评级\s*[：:]?\s*([^，,。；;\n]+)/i])
  fields.guarantee = get(text, [/(无担保)(?=[，,。；;\n]|$)/, /((?:由)?[^，,。；;\n]{2,60}担保)(?=[，,。；;\n]|$)/])
  fields.leadRole = get(text, [/起息日[^，,。；;\n]*[，,]\s*([^。\n]*?(?:牵头[^，,。；;\n]*|簿记管理人|牵头受托))(?=[，,。；;])/])
  fields.coUnderwriters = get(text, [/(?:牵头[^，,。；;\n]*[，,]\s*)?([^。\n]+?)联主(?=[，,。；;]|$)/, /联席主承销商\s*[：:]\s*([^\n]+)/])
  fields.salesMethod = get(text, [/(竞争性销售|包销|余额包销|代销)/])
  fields.ourUnderwritingAndFee = get(text, [/(我司承销(?:规模|份额)[^。\n]*?)(?=。|$)/])
  fields.continuingLead = get(text, [/存续期负责人\s*[：:]?\s*([^，,。；;\n]+)/])
  fields.continuingExecutor = get(text, [/存续期执行人员\s*[：:]?\s*([^，,。；;\n]+)/])
  fields.aExposure = get(text, [/A类(?:敞口)?\s*[：:]?\s*([^，,。；;\n]+)/i])
  fields.approvalStatus = get(text, [/(批文(?:无剩余额度|已使用完毕|已发行完毕|剩余额度[^。\n]*))/])

  fields.bondType = detectBondType(fields.shortName, fields.bondCode, text)
  if (fields.bondType) inferred.add('bondType')
  fields.market = detectMarket(fields.shortName, fields.bondCode, fields.bondType, text)
  if (fields.market) inferred.add('market')
  fields.rateLabel = defaultRateLabel(fields.bondType)
  inferred.add('rateLabel')

  if (!fields.interestStartDate && fields.paymentDate) {
    fields.interestStartDate = fields.paymentDate
    inferred.add('interestStartDate')
    notes.push('起息日按常规规则暂取缴款日，如本期有特殊安排请修改。')
  }

  if (!fields.bookDate) {
    const base = fields.interestStartDate || fields.paymentDate
    if (base && fields.market && fields.market !== '其他') {
      const result = inferBookDateDetailed(base, fields.market, overrides)
      fields.bookDate = result.date
      dateConfidence.bookDate = result.confidence
      inferred.add('bookDate')
      notes.push(fields.market === '协会'
        ? '簿记日按协会常规口径暂按缴款/起息日前1个工作日推定；协会存在特殊安排时请以实际簿记日覆盖。'
        : '簿记日按交易所常规口径暂按缴款/起息日前2个交易日推定；特殊项目请以实际簿记日覆盖。')
      if (fields.market === '协会' && hasConfiguredHolidayWithinDays(base, 7, overrides)) {
        notes.push('缴款/起息日前一周存在法定节假日，协会项目可能出现非标准 T-1 簿记安排，请重点核对实际簿记日。')
      }
      if (result.confidence === 'estimated') {
        notes.push(`${result.unknownYears.join('、')}年度官方节假日日历尚未核实，簿记日仅按周一至周五暂估。`)
      }
    }
  } else {
    dateConfidence.bookDate = overrides.verifiedYears.includes(Number(fields.bookDate.slice(0,4))) ? 'verified' : 'estimated'
  }

  if (fields.bookDate) {
    const dates = calculateArchiveDates(fields.bookDate, overrides, fields.archiveCountMode)
    fields.archiveSubmitDate = dates.submit
    fields.archiveFinishDate = dates.finish
    dateConfidence.archiveSubmitDate = dates.submitConfidence
    dateConfidence.archiveFinishDate = dates.finishConfidence
    inferred.add('archiveSubmitDate')
    inferred.add('archiveFinishDate')
    if (dates.unknownYears.length) {
      notes.push(`${dates.unknownYears.join('、')}年度官方节假日安排尚未纳入，30/45个工作日归档日期为暂估；官方安排公布后补充日历即可自动重算。`)
    }
  }

  return { fields, meta: { inferred, notes: [...new Set(notes)], dateConfidence } }
}
