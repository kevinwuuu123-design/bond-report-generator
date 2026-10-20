import { it,expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildRecordWorkbook,fieldLabels } from './excel'
import { createRecord } from './records'
import { emptyFields } from '../parser/parseBondText'
import { defaultOverrides } from './date'

it('round-trips a genuine XLSX with all fields, numeric statistics and safe text',async()=>{
  const r=createRecord({ ...emptyFields,issuer:'=HYPERLINK("test")',bondCode:'001234.IB',shortName:'测试券',amount:'50000万元',coupon:'1.63%',bookMultiple:'3.68倍' },'完整原文','完整报备',{ inferred:new Set(['market']),notes:['需核对'],dateConfidence:{} },defaultOverrides)
  const book=await buildRecordWorkbook([r])
  const buffer=await book.xlsx.writeBuffer()
  const restored=new ExcelJS.Workbook(); await restored.xlsx.load(buffer)
  expect(restored.worksheets.map(s=>s.name)).toEqual(['发行记录','报备原文','统计说明'])
  const sheet=restored.getWorksheet('发行记录')!
  const row=sheet.getRow(1).values as string[]
  const cell=(name:string)=>sheet.getRow(2).getCell(row.indexOf(name))
  expect(cell('债券代码').value).toBe('001234.IB')
  expect(cell('发行人全称').type).toBe(ExcelJS.ValueType.String)
  expect(cell('发行规模（亿元，数值）').value).toBe(5)
  expect(cell('利率（%，数值）').value).toBe(1.63)
  for(const label of Object.values(fieldLabels)) expect(row).toContain(label)
  expect(restored.getWorksheet('报备原文')!.getCell('C2').value).toBe('完整报备')
  expect(restored.getWorksheet('报备原文')!.getCell('D2').value).toBe('完整原文')
  expect(sheet.autoFilter).toBeTruthy();expect(sheet.views[0].state).toBe('frozen')
})

it('refuses to silently truncate original evidence exceeding an Excel cell',async()=>{
  const r=createRecord({...emptyFields},'x'.repeat(32768),'report',{inferred:new Set(),notes:[],dateConfidence:{}},defaultOverrides)
  await expect(buildRecordWorkbook([r])).rejects.toThrow('32767')
})
