export type Market = '协会' | '交易所' | '其他' | ''
export type ArchiveWording = '归档' | '发行底稿报送'
export type ArchiveCountMode = '次日起算' | '簿记日计第1日'
export type DateConfidence = 'verified' | 'estimated' | ''
export type GuaranteeMode = '' | '无担保' | '有担保'
export type AExposureUsage = '' | '使用' | '未使用'
export type UnderwritingMode = '' | '待定' | '份额及费用' | '规模及费用' | '年度费用' | '其他'

export interface BondFields {
  issuer: string
  bondCode: string
  shortName: string
  bondType: string
  market: Market
  bookDate: string
  paymentDate: string
  interestStartDate: string
  issuerRating: string
  bondRating: string
  guaranteeMode: GuaranteeMode
  guarantorName: string
  amount: string
  term: string
  rateLabel: string
  coupon: string
  bookMultiple: string
  leadInstitution: string
  leadRoleType: string
  coUnderwriters: string
  salesMethod: string
  underwritingMode: UnderwritingMode
  ourUnderwritingShare: string
  ourUnderwritingScale: string
  ourFee: string
  feeYear: string
  ourUnderwritingAndFee: string
  continuingLead: string
  continuingExecutor: string
  archiveSubmitDate: string
  archiveFinishDate: string
  archiveWording: ArchiveWording
  archiveCountMode: ArchiveCountMode
  aExposureUsage: AExposureUsage
  aExposure: string
  approvalStatus: string
}

export interface ParseMeta {
  inferred: Set<keyof BondFields>
  notes: string[]
  dateConfidence: Partial<Record<'bookDate' | 'archiveSubmitDate' | 'archiveFinishDate', DateConfidence>>
}
