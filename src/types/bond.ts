export type Market = '协会' | '交易所' | '其他' | ''
export type ArchiveWording = '归档' | '发行底稿报送'
export type ArchiveCountMode = '次日起算' | '簿记日计第1日'
export type DateConfidence = 'verified' | 'estimated' | ''

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
  guarantee: string
  amount: string
  term: string
  rateLabel: string
  coupon: string
  bookMultiple: string
  leadRole: string
  coUnderwriters: string
  salesMethod: string
  ourUnderwritingAndFee: string
  continuingLead: string
  continuingExecutor: string
  archiveSubmitDate: string
  archiveFinishDate: string
  archiveWording: ArchiveWording
  archiveCountMode: ArchiveCountMode
  aExposurePrefix: string
  aExposure: string
  approvalStatus: string
}

export interface ParseMeta {
  inferred: Set<keyof BondFields>
  notes: string[]
  dateConfidence: Partial<Record<'bookDate' | 'archiveSubmitDate' | 'archiveFinishDate', DateConfidence>>
}
