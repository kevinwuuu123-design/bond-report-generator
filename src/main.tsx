import React, { useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import FieldGrid from './components/FieldGrid'
import { emptyFields, parseBondText } from './parser/parseBondText'
import type { BondFields, ParseMeta } from './types/bond'
import { calculateArchiveDates, defaultOverrides, inferBookDateDetailed, type WorkdayOverrides } from './utils/date'
import { generateInternalReport, requiredFieldLabels } from './templates/internalReport'

const sample = `【26莫控MTN006 发行簿记结果】
债券代码：102683240.IB
债券简称：26莫控MTN006
债券期限：3+2年
发行规模：5 亿元
全场倍数：3.68 倍
票面利率：1.63 %
缴款日期：2026年08月21日（周五）`

function loadOverrides(): WorkdayOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem('workdayOverridesV2') || '')
    return { ...defaultOverrides, ...parsed, verifiedYears: parsed.verifiedYears || defaultOverrides.verifiedYears }
  } catch { return defaultOverrides }
}

function App() {
  const [raw, setRaw] = useState(sample)
  const [fields, setFields] = useState<BondFields>({ ...emptyFields })
  const [meta, setMeta] = useState<ParseMeta>({ inferred: new Set(), notes: [], dateConfidence: {} })
  const [overrides, setOverrides] = useState<WorkdayOverrides>(loadOverrides())
  const [copied, setCopied] = useState(false)

  const missing = useMemo(() => Object.entries(requiredFieldLabels)
    .filter(([k]) => !String(fields[k as keyof BondFields] ?? '').trim())
    .map(([,label]) => label), [fields])

  const report = useMemo(() => generateInternalReport(fields), [fields])

  const parse = () => {
    const r = parseBondText(raw, overrides)
    setFields(r.fields); setMeta(r.meta)
  }

  const update = (key: keyof BondFields, value: string) => {
    setFields(prev => {
      const next = { ...prev, [key]: value } as BondFields
      if (key === 'paymentDate' && !next.interestStartDate) next.interestStartDate = value
      if ((key === 'paymentDate' || key === 'interestStartDate' || key === 'market') && next.market) {
        const base = next.interestStartDate || next.paymentDate
        if (base) {
          const r = inferBookDateDetailed(base, next.market, overrides)
          next.bookDate = r.date
          setMeta(m => ({ ...m, dateConfidence: { ...m.dateConfidence, bookDate: r.confidence } }))
        }
      }
      if (key === 'bookDate' || key === 'paymentDate' || key === 'interestStartDate' || key === 'market' || key === 'archiveCountMode') {
        if (next.bookDate) {
          const d = calculateArchiveDates(next.bookDate, overrides, next.archiveCountMode)
          next.archiveSubmitDate = d.submit; next.archiveFinishDate = d.finish
          setMeta(m => ({ ...m, dateConfidence: { ...m.dateConfidence, archiveSubmitDate: d.submitConfidence, archiveFinishDate: d.finishConfidence } }))
        }
      }
      return next
    })
  }

  const recalcCalendar = (calendar: WorkdayOverrides) => {
    setOverrides(calendar)
    if (fields.bookDate) {
      const d = calculateArchiveDates(fields.bookDate, calendar, fields.archiveCountMode)
      setFields(prev => ({ ...prev, archiveSubmitDate: d.submit, archiveFinishDate: d.finish }))
      setMeta(m => ({ ...m, dateConfidence: { ...m.dateConfidence, archiveSubmitDate: d.submitConfidence, archiveFinishDate: d.finishConfidence } }))
    }
  }

  const saveOverrides = () => {
    localStorage.setItem('workdayOverridesV2', JSON.stringify(overrides))
    recalcCalendar(overrides)
    alert('工作日历设置已保存在本浏览器。')
  }

  const copyReport = async () => {
    await navigator.clipboard.writeText(report)
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  return <main>
    <header>
      <div><p className="eyebrow">国泰海通 · 债务融资承做工具</p><h1>债券簿记内部报备生成器 <small>2.0</small></h1></div>
      <span className="privacy">本地浏览器计算 · 不上传项目数据</span>
    </header>

    <section className="panel">
      <div className="section-title"><div><span>STEP 1</span><h2>粘贴簿记结果</h2></div><button className="primary" onClick={parse}>解析簿记结果</button></div>
      <textarea className="raw" value={raw} onChange={e => setRaw(e.target.value)} />
    </section>

    <section className="panel">
      <div className="section-title"><div><span>STEP 2</span><h2>识别结果与缺失项</h2></div><div className={`badge ${missing.length ? 'warn' : 'ok'}`}>{missing.length ? `尚缺 ${missing.length} 项` : '核心要素已齐全'}</div></div>
      {meta.notes.length > 0 && <div className="notes">{meta.notes.map(n => <div key={n}>• {n}</div>)}</div>}
      {missing.length > 0 && <div className="missing"><b>待补充：</b>{missing.join('、')}</div>}
      <p className="hint">主体评级、债项评级、担保、销售方式属于条件项：历史报备并非每笔都写，可按项目实际决定是否填写。</p>
      <FieldGrid fields={fields} meta={meta} onChange={update} />
    </section>

    <section className="panel">
      <div className="section-title"><div><span>STEP 3</span><h2>生成内部报备</h2></div><button className="primary" onClick={copyReport}>{copied ? '已复制' : '复制报备文字'}</button></div>
      <div className="report">{report}</div>
    </section>

    <details className="panel settings">
      <summary>工作日历设置（法定节假日 / 调休补班 / 暂估年度）</summary>
      <p>已内置并标记 2026 年官方工作日日历。对尚未公布官方节假日安排的年度，系统会继续按“周一至周五”给出暂估日期，并在日期旁标黄“暂估”；官方安排公布后补充休息日、补班日并把该年度加入“已核实年度”，系统即可重算。</p>
      <div className="settings-grid three">
        <label>官方日历已核实年度<input value={overrides.verifiedYears.join(',')} onChange={e => setOverrides(o => ({...o, verifiedYears: e.target.value.split(',').map(x=>Number(x.trim())).filter(Boolean)}))} placeholder="2026,2027" /></label>
        <label>非工作日<input value={overrides.holidays.join(',')} onChange={e => setOverrides(o => ({...o, holidays: e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} placeholder="2026-10-01,2026-10-02" /></label>
        <label>调休补班日<input value={overrides.workingWeekends.join(',')} onChange={e => setOverrides(o => ({...o, workingWeekends: e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))} placeholder="2026-10-10" /></label>
      </div>
      <button className="secondary" onClick={saveOverrides}>保存并重算工作日</button>
    </details>

    <footer>所有自动推定字段均可人工覆盖；特殊项目以实际发行安排为准。协会跨节假日项目尤其建议核对实际簿记日。</footer>
  </main>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
