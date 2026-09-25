import type { BondFields } from '../types/bond'
import { formatChineseDate } from '../utils/date'

function clean(v: string) { return (v || '').trim() }

function bondRatingClause(v: string): string {
  const x = clean(v)
  if (!x) return ''
  if (x.startsWith('无债项')) return x
  return `债项评级${x}`
}

function guaranteeClause(f: BondFields): string {
  if (f.guaranteeMode === '无担保') return '无担保'
  if (f.guaranteeMode === '有担保') {
    return clean(f.guarantorName) ? `由${clean(f.guarantorName)}担保` : '【担保人名称待补充】'
  }
  return ''
}

function buildCreditClauses(f: BondFields): string[] {
  const result: string[] = []
  if (clean(f.issuerRating)) result.push(`主体评级${clean(f.issuerRating)}`)
  const b = bondRatingClause(f.bondRating)
  if (b) result.push(b)
  const g = guaranteeClause(f)
  if (g) result.push(g)
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

export function leadRoleText(f: BondFields): string {
  const institution = clean(f.leadInstitution)
  const role = clean(f.leadRoleType) || '牵头'
  if (!institution) return '【牵头主承销商待补充】'
  if (role === '其他') return institution
  if (institution.endsWith(role) || institution.includes(role)) return institution
  if (role === '牵头且负责存续期管理') return `${institution}牵头且负责存续期管理`
  if (role === '牵头、簿记管理人') return `${institution}牵头、簿记管理人`
  if (role === '牵头受托') return `${institution}牵头受托`
  return `${institution}牵头`
}

export function underwritingText(f: BondFields): string {
  switch (f.underwritingMode) {
    case '待定': return '我司承销规模与承销费待定'
    case '份额及费用': {
      const share = clean(f.ourUnderwritingShare) || '【份额待补充】'
      const fee = clean(f.ourFee) || '【承销费待补充】'
      return `我司承销份额为${share}，我司承销费为${fee}`
    }
    case '规模及费用': {
      const scale = clean(f.ourUnderwritingScale) || '【承销规模待补充】'
      const fee = clean(f.ourFee) || '【承销费待补充】'
      return `我司承销规模${scale}，我司承销费${fee}`
    }
    case '年度费用': {
      const scale = clean(f.ourUnderwritingScale) || '【承销规模待补充】'
      const year = clean(f.feeYear) || '【年度待补充】'
      const fee = clean(f.ourFee) || '【承销费待补充】'
      return `我司承销规模${scale}，我司${year}年度承销费${fee}（未扣除团费）`
    }
    case '其他': return clean(f.ourUnderwritingAndFee) || '【我司承销规模与承销费表述待补充】'
    default: return '【我司承销规模与承销费待补充】'
  }
}

function exposureText(f: BondFields): string {
  if (f.aExposureUsage === '未使用') return '我司未使用A类敞口'
  if (f.aExposureUsage === '使用') return `我司使用A类敞口${clean(f.aExposure) || '【额度待补充】'}`
  return '【A类敞口使用情况待补充】'
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

  const underwritingParts = [leadRoleText(f)]
  if (clean(f.coUnderwriters)) underwritingParts.push(`${clean(f.coUnderwriters)}联主`)
  if (clean(f.salesMethod)) underwritingParts.push(clean(f.salesMethod))
  const underwriting = underwritingParts.join('，')
  const our = underwritingText(f)

  const continuing = `存续期负责人${clean(f.continuingLead) || '【待补充】'}，存续期执行人员${clean(f.continuingExecutor) || '【待补充】'}。`
  const archive = archiveSentence(f)
  const exposure = exposureText(f)
  const approval = clean(f.approvalStatus) || '批文状态【待补充】'

  return `${issuer}，${shortName}，${type}，于${bookDate}完成簿记，${creditText}发行规模${amount}，${term}期，${rateLabel}${coupon}，全场倍数${multiple}，起息日${interest}，${underwriting}，${our}。${continuing}${archive}${exposure}，${approval}。`
}

export const requiredFieldLabels: Partial<Record<keyof BondFields, string>> = {
  issuer: '发行人全称', shortName: '债券简称', bondType: '债券类型', bookDate: '簿记日期', amount: '发行规模', term: '债券期限',
  coupon: '票面/发行利率', bookMultiple: '全场倍数', interestStartDate: '起息日', leadInstitution: '牵头主承销商', underwritingMode: '我司承销规模与承销费口径',
  continuingLead: '存续期负责人', continuingExecutor: '存续期执行人员', aExposureUsage: 'A类敞口使用情况', approvalStatus: '批文状态',
}

export const reviewFieldLabels: Partial<Record<keyof BondFields, string>> = {
  issuerRating: '主体评级', bondRating: '债项评级', guaranteeMode: '担保情况', coUnderwriters: '联席主承销商', salesMethod: '销售方式', paymentDate: '缴款日期',
}

export function conditionalMissingFields(f: BondFields): Array<{ key: keyof BondFields, label: string }> {
  const out: Array<{ key: keyof BondFields, label: string }> = []
  if (f.guaranteeMode === '有担保' && !clean(f.guarantorName)) out.push({ key: 'guarantorName', label: '担保人名称' })
  if (f.aExposureUsage === '使用' && !clean(f.aExposure)) out.push({ key: 'aExposure', label: 'A类敞口额度' })
  if (f.underwritingMode === '份额及费用') {
    if (!clean(f.ourUnderwritingShare)) out.push({ key: 'ourUnderwritingShare', label: '我司承销份额' })
    if (!clean(f.ourFee)) out.push({ key: 'ourFee', label: '我司承销费' })
  }
  if (f.underwritingMode === '规模及费用') {
    if (!clean(f.ourUnderwritingScale)) out.push({ key: 'ourUnderwritingScale', label: '我司承销规模' })
    if (!clean(f.ourFee)) out.push({ key: 'ourFee', label: '我司承销费' })
  }
  if (f.underwritingMode === '年度费用') {
    if (!clean(f.ourUnderwritingScale)) out.push({ key: 'ourUnderwritingScale', label: '我司承销规模' })
    if (!clean(f.feeYear)) out.push({ key: 'feeYear', label: '承销费年度' })
    if (!clean(f.ourFee)) out.push({ key: 'ourFee', label: '我司年度承销费' })
  }
  if (f.underwritingMode === '其他' && !clean(f.ourUnderwritingAndFee)) out.push({ key: 'ourUnderwritingAndFee', label: '我司承销规模与承销费自定义表述' })
  return out
}
