import type { BondFields } from '../types/bond'
import type { BondRecord } from '../types/record'
import { amountInYi, downloadBlob } from './records'

export const fieldLabels: Record<keyof BondFields, string> = {
  issuer:'发行人全称', bondCode:'债券代码', shortName:'债券简称', bondType:'债券类型', market:'市场',
  bookDate:'簿记日期', paymentDate:'缴款日期', interestStartDate:'起息日', issuerRating:'主体评级', bondRating:'债项评级',
  guaranteeMode:'担保情况', guarantorName:'担保人名称', amount:'发行规模（原文）', term:'债券期限', rateLabel:'利率表述', coupon:'利率（原文）',
  bookMultiple:'全场倍数（原文）', leadInstitution:'牵头主承销商', leadRoleType:'牵头角色', coUnderwriters:'联席主承销商', salesMethod:'销售方式',
  underwritingMode:'承销及费用口径', ourUnderwritingShare:'我司承销份额', ourUnderwritingScale:'我司承销规模', ourFee:'我司承销费', feeYear:'承销费年度',
  ourUnderwritingAndFee:'承销及费用自定义表述', continuingLead:'存续期负责人', continuingExecutor:'存续期执行人员',
  archiveSubmitDate:'归档申请截止日', archiveFinishDate:'归档完成截止日', archiveWording:'归档表述', archiveCountMode:'归档起算口径',
  aExposureUsage:'A类敞口使用情况', aExposure:'A类敞口额度', approvalStatus:'批文状态',
}
function numeric(value: string, suffix: string) {
  const cleaned = value.trim().replace(suffix, '').trim()
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null
}
export async function buildRecordWorkbook(records: BondRecord[]) {
  if (!records.length) throw new Error('没有可导出的记录。')
  const { default: ExcelJS } = await import('exceljs')
  const book = new ExcelJS.Workbook()
  book.creator = '债融承做工作台'; book.created = new Date()
  const sheet = book.addWorksheet('发行记录', { views: [{ state:'frozen', ySplit:1, xSplit:3 }] })
  const keys = Object.keys(fieldLabels) as (keyof BondFields)[]
  sheet.columns = [
    { header:'记录编号', key:'id', width:38 }, { header:'归档时间（北京时间）', key:'createdAt', width:24 },
    ...keys.map(key => ({ header:fieldLabels[key], key, width:key === 'issuer' ? 38 : 22 })),
    { header:'发行规模（亿元，数值）', key:'amountYi', width:24 },
    { header:'利率（%，数值）', key:'couponValue', width:22 }, { header:'全场倍数（数值）', key:'multipleValue', width:22 },
    { header:'来源记录编号', key:'sourceId', width:38 },
  ]
  for (const r of records) {
    const row = sheet.addRow({ ...r.fields, id:r.id, createdAt:new Date(r.createdAt).toLocaleString('sv-SE', { timeZone:'Asia/Shanghai' }),
      amountYi:amountInYi(r.fields.amount), couponValue:numeric(r.fields.coupon, '%'), multipleValue:numeric(r.fields.bookMultiple, '倍'), sourceId:r.sourceId || '' })
    row.height = 34
  }
  sheet.getColumn('amountYi').numFmt = '0.0000'
  sheet.getColumn('couponValue').numFmt = '0.0000'
  sheet.getColumn('multipleValue').numFmt = '0.0000'
  sheet.autoFilter = { from:{ row:1, column:1 }, to:{ row:records.length+1, column:sheet.columnCount } }
  const text = book.addWorksheet('报备原文', { views:[{ state:'frozen', ySplit:1 }] })
  text.columns = [{ header:'记录编号', key:'id', width:38 }, { header:'债券简称', key:'name', width:24 },
    { header:'已归档报备文本', key:'report', width:100 }, { header:'簿记结果原文', key:'raw', width:90 },
    { header:'自动推定字段', key:'inferred', width:40 }, { header:'识别提示及日期核验状态', key:'notes', width:60 }]
  for (const r of records) {
    // Excel limits cell strings to 32767 characters. Fail explicitly rather than silently truncating evidence.
    if ([r.report, r.raw].some(v => v.length > 32767)) throw new Error('某条记录原文超过 Excel 单元格的 32767 字符限制，请使用 JSON 备份保存完整原文。')
    text.addRow({ id:r.id, name:r.fields.shortName, report:r.report, raw:r.raw,
      inferred:r.meta.inferred.map(k => fieldLabels[k]).join('、'), notes:[...r.meta.notes, JSON.stringify(r.meta.dateConfidence)].join('\n') }).height = 150
  }
  const info = book.addWorksheet('统计说明')
  const amounts = records.map(r => amountInYi(r.fields.amount))
  info.columns = [{ header:'项目', key:'name', width:32 }, { header:'内容', key:'value', width:100 }]
  info.addRows([
    { name:'导出记录数', value:records.length },
    { name:'可换算发行规模的记录数', value:amounts.filter(v => v !== null).length },
    { name:'发行规模合计（亿元）', value:amounts.reduce<number>((sum,v) => sum+(v ?? 0),0) },
    { name:'金额统计口径', value:'仅换算明确的亿元、万元、元金额；无法识别的值留空，不视为零。原始填写值完整保留。' },
    { name:'版本统计提示', value:'每次完成归档生成独立快照，继续编辑会另存新记录。统计同一债券时请按债券代码或来源记录编号核对版本，避免重复计算。' },
    { name:'文本与数值', value:'债券代码、日期和原始字段按文本保留；末尾三列提供可识别的数值，利率以百分数单位显示（1.63代表1.63%）。' },
  ])
  for (const s of book.worksheets) {
    s.eachRow((row, index) => row.eachCell({ includeEmpty:true }, cell => {
      if (typeof cell.value === 'string' && cell.value.length>32767) throw new Error('某个字段超过 Excel 单元格的 32767 字符限制，请使用 JSON 备份保存完整内容。')
      cell.font = { name:'微软雅黑', size:11, color:{ argb:index === 1 ? 'FFFFFFFF' : 'FF19202A' }, bold:index === 1 }
      cell.alignment = { vertical:'top', wrapText:true }
      if (index === 1 || index % 2 === 0) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:index === 1 ? 'FF183B63' : 'FFF0F5FA' } }
    }))
    s.getRow(1).height = 32
  }
  return book
}

export async function exportRecords(records: BondRecord[]) {
  const book = await buildRecordWorkbook(records)
  const buffer = await book.xlsx.writeBuffer()
  downloadBlob(new Blob([new Uint8Array(buffer)], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `发行记录_${records.length}笔_${new Date().toISOString().slice(0,10)}.xlsx`)
}
