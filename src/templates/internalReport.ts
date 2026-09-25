import type { BondFields } from '../types/bond'
import { formatChineseDate } from '../utils/date'

function clean(v: string) { return (v || '').trim() }

function bondRatingClause(v: string): string {
  const x = clean(v)
  if (!x) return ''
  if (x.startsWith('无债项')) return x
  return `债项评级${x}`
}

function buildCreditClauses(f: BondFields): string[] {
  const result: string[] = []
  if (clean(f.issuerRating)) result.push(`主体评级${clean(f.issuerRating)}`)
  const b = bondRatingClause(f.bondRating)
  if (b) result.push(b)
  if (clean(f.guarantee)) result.push(clean(f.guarantee))
  return result
}

function archiveSentence(f: BondFields): string {
  const submit = formatChineseDate(f.archiveSubmitDate) || '【待计算】'
  const finish = formatChineseDate(f.archiveFinishDate) || '【待计算】'
  if (f.archiveWording === '发行底稿报送') {
    return `底稿拟于${submit}前申请报送，应于${finish}前完成发行底稿报送。`
  }
  return `底稿拟于${submit}前提交归档，应于${finish}前归档完毕。`
}

export function generateInternalReport(f: BondFields): string {
  const issuer = clean(f.issuer) || '【发行人全称】'
  const shortName = clean(f.shortName) || '【债券简称】'
  const type = clean(f.bondType) || '【债券类型】'
  const bookDate = formatChineseDate(f.bookDate) || '【簿记日期】'
  const credit = buildCreditClauses(f)
  const creditText = credit.length ? `${credit.join('，')}，` : ''
  const amount = clean(f.amount) || '【发行规模待补充】'
  const term = clean(f.term) || '【期限待补充】'
  const rateLabel = clean(f.rateLabel) || '票面利率'
  const coupon = clean(f.coupon) || '【利率待补充】'
  const multiple = clean(f.bookMultiple) || '【全场倍数待补充】'
  const interest = formatChineseDate(f.interestStartDate) || '【起息日待补充】'

  const underwritingParts = [clean(f.leadRole) || '【牵头/角色表述待补充】']
  if (clean(f.coUnderwriters)) underwritingParts.push(`${clean(f.coUnderwriters)}联主`)
  if (clean(f.salesMethod)) underwritingParts.push(clean(f.salesMethod))
  const underwriting = underwritingParts.join('，')
  const our = clean(f.ourUnderwritingAndFee) || '【我司承销规模与承销费待补充】'

  const continuing = `存续期负责人${clean(f.continuingLead) || '【待补充】'}，存续期执行人员${clean(f.continuingExecutor) || '【待补充】'}。`
  const archive = archiveSentence(f)
  const exposurePrefix = clean(f.aExposurePrefix) || '我司使用A类'
  const exposure = clean(f.aExposure) || '【待补充】'
  const approval = clean(f.approvalStatus) || '批文状态【待补充】'

  return `${issuer}，${shortName}，${type}，于${bookDate}完成簿记，${creditText}发行规模${amount}，${term}期，${rateLabel}${coupon}，全场倍数${multiple}，起息日${interest}，${underwriting}，${our}。${continuing}${archive}${exposurePrefix}${exposure}，${approval}。`
}

// 评级、债项、担保、销售方式为“条件项”：历史报备口径并非每笔都写，因此不作为硬缺失项。
export const requiredFieldLabels: Partial<Record<keyof BondFields, string>> = {
  issuer: '发行人全称',
  shortName: '债券简称',
  bondType: '债券类型',
  bookDate: '簿记日期',
  amount: '发行规模',
  term: '债券期限',
  coupon: '票面/发行利率',
  bookMultiple: '全场倍数',
  interestStartDate: '起息日',
  leadRole: '牵头/角色表述',
  ourUnderwritingAndFee: '我司承销规模与承销费',
  continuingLead: '存续期负责人',
  continuingExecutor: '存续期执行人员',
  aExposure: 'A类敞口/额度',
  approvalStatus: '批文状态',
}
