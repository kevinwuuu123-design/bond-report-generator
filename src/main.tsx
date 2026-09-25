import React, { useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import FieldGrid from './components/FieldGrid'
import { emptyFields, parseBondText } from './parser/parseBondText'
import type { BondFields, ParseMeta } from './types/bond'
import { calculateArchiveDates, defaultOverrides, inferBookDateDetailed, type WorkdayOverrides } from './utils/date'
import { conditionalMissingFields, generateInternalReport, requiredFieldLabels, reviewFieldLabels } from './templates/internalReport'

const sample = `【26莫控MTN006 发行簿记结果】
债券代码：102683240.IB
债券简称：26莫控MTN006
债券期限：3+2年
发行规模：5 亿元
全场倍数：3.68 倍
票面利率：1.63 %
缴款日期：2026年08月21日（周五）`

type PersonnelHistory = { leads: string[]; executors: string[] }

function loadOverrides(): WorkdayOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem('workdayOverridesV2') || '')
    return { ...defaultOverrides, ...parsed, verifiedYears: parsed.verifiedYears || defaultOverrides.verifiedYears }
  } catch { return defaultOverrides }
}
function loadPersonnel(): PersonnelHistory {
  try { return { leads: [], executors: [], ...JSON.parse(localStorage.getItem('personnelHistory') || '{}') } }
  catch { return { leads: [], executors: [] } }
}
function addUnique(list: string[], value: string) {
  const v = value.trim(); if (!v) return list
  return [v, ...list.filter(x => x !== v)].slice(0, 12)
}

function App() {
  const [raw, setRaw] = useState(sample)
  const [fields, setFields] = useState<BondFields>({ ...emptyFields })
  const [meta, setMeta] = useState<ParseMeta>({ inferred: new Set(), notes: [], dateConfidence: {} })
  const [overrides, setOverrides] = useState<WorkdayOverrides>(loadOverrides())
  const [personnel, setPersonnel] = useState<PersonnelHistory>(loadPersonnel())
  const [copied, setCopied] = useState(false)
  const [parsedOnce, setParsedOnce] = useState(false)

  const conditionalMissing = useMemo(() => conditionalMissingFields(fields), [fields])
  const requiredMissingItems = useMemo(() => {
    const base = Object.entries(requiredFieldLabels)
      .filter(([k]) => !String(fields[k as keyof BondFields] ?? '').trim())
      .map(([k,label]) => ({ key: k as keyof BondFields, label: label as string }))
    return [...base, ...conditionalMissing]
  }, [fields, conditionalMissing])
  const requiredMissing = useMemo(() => new Set(requiredMissingItems.map(x=>x.key)), [requiredMissingItems])
  const reviewMissingItems = useMemo(() => Object.entries(reviewFieldLabels)
    .filter(([k]) => !String(fields[k as keyof BondFields] ?? '').trim())
    .map(([k,label]) => ({ key: k as keyof BondFields, label: label as string })), [fields])
  const reviewMissing = useMemo(() => new Set(reviewMissingItems.map(x=>x.key)), [reviewMissingItems])
  const report = useMemo(() => generateInternalReport(fields), [fields])

  const coreKeys: (keyof BondFields)[] = ['issuer','bondCode','shortName','bondType','market','bookDate','paymentDate','interestStartDate','amount','term','coupon','bookMultiple','issuerRating','bondRating','guaranteeMode','leadInstitution','coUnderwriters','salesMethod','underwritingMode','continuingLead','continuingExecutor','aExposureUsage','approvalStatus']
  const filledCount = coreKeys.filter(k => String(fields[k] ?? '').trim()).length
  const recognitionRate = Math.round((filledCount / coreKeys.length) * 100)
  const autoCount = meta.inferred.size
  const hasEstimated = Object.values(meta.dateConfidence).some(v => v === 'estimated')

  const parse = () => {
    const r = parseBondText(raw, overrides)
    setFields(r.fields); setMeta(r.meta); setParsedOnce(true)
  }

  const update = (key: keyof BondFields, value: string) => {
    setFields(prev => {
      const next = { ...prev, [key]: value } as BondFields
      if (key === 'paymentDate' && !next.interestStartDate) next.interestStartDate = value
      if (key === 'guaranteeMode' && value === '无担保') next.guarantorName = ''
      if (key === 'aExposureUsage' && value === '未使用') next.aExposure = ''
      if (key === 'underwritingMode') {
        if (value !== '其他') next.ourUnderwritingAndFee = ''
      }
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
  const saveOverrides = () => { localStorage.setItem('workdayOverridesV2', JSON.stringify(overrides)); recalcCalendar(overrides) }

  const rememberPersonnel = () => {
    const next = { leads: addUnique(personnel.leads, fields.continuingLead), executors: addUnique(personnel.executors, fields.continuingExecutor) }
    setPersonnel(next); localStorage.setItem('personnelHistory', JSON.stringify(next))
  }

  const copyReport = async () => {
    await navigator.clipboard.writeText(report); rememberPersonnel(); setCopied(true); setTimeout(() => setCopied(false), 1600)
  }
  const reset = () => { setRaw(''); setFields({ ...emptyFields }); setMeta({ inferred:new Set(), notes:[], dateConfidence:{} }); setParsedOnce(false) }
  const jumpTo = (key: keyof BondFields) => document.getElementById(`field-${String(key)}`)?.scrollIntoView({behavior:'smooth', block:'center'})

  return <div className="app-shell">
    <div className="topbar">
      <div className="brand"><div className="brand-mark">GT</div><div><b>债融承做工作台</b><span>BOOKBUILDING OPERATIONS</span></div></div>
      <div className="topbar-actions"><span className="privacy-dot"><i></i>本地计算</span><button className="ghost-btn" onClick={reset}>新建一笔</button></div>
    </div>

    <main>
      <section className="hero">
        <div><p className="eyebrow">内部报备 · 发行后管理</p><h1>债券簿记内部报备生成器 <small>v2.1</small></h1><p className="hero-copy">粘贴簿记结果，自动识别核心要素、推算关键日期，并按固定内部口径生成报备文本。</p></div>
        <div className="status-chip"><span className={hasEstimated?'amber':'green'}></span>{hasEstimated?'存在暂估日期':'工作日日历已核验'}</div>
      </section>

      <section className="kpi-grid">
        <div className="kpi"><span>要素识别率</span><strong>{parsedOnce ? `${recognitionRate}%` : '—'}</strong><div className="progress"><i style={{width:`${parsedOnce?recognitionRate:0}%`}} /></div></div>
        <div className={`kpi ${requiredMissingItems.length?'alert':''}`}><span>必须补充</span><strong>{parsedOnce ? requiredMissingItems.length : '—'}</strong><small>影响成稿完整性</small></div>
        <div className="kpi"><span>待确认项</span><strong>{parsedOnce ? reviewMissingItems.length : '—'}</strong><small>条件项 / 可选项</small></div>
        <div className="kpi"><span>自动推定</span><strong>{parsedOnce ? autoCount : '—'}</strong><small>类型、市场、日期等</small></div>
      </section>

      <section className="source-grid">
        <div className="dashboard-card source-card">
          <div className="card-head"><div><span className="step-pill">01</span><h2>粘贴簿记结果</h2></div><div className="source-actions"><button className="text-btn" onClick={()=>setRaw(sample)}>载入示例</button><button className="primary" onClick={parse}>解析要素</button></div></div>
          <textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="将簿记同事发送的发行结果原文粘贴到这里…" />
        </div>
        <div className="dashboard-card insight-card">
          <div className="card-head"><div><span className="step-pill muted">AI</span><h2>识别提示</h2></div></div>
          {!parsedOnce ? <div className="empty-state"><div className="empty-icon">↗</div><b>等待解析</b><p>粘贴原文并点击“解析要素”，这里会展示自动推定与风险提示。</p></div> : <>
            {meta.notes.length ? <div className="insight-list">{meta.notes.map(n=><div key={n}><span>i</span><p>{n}</p></div>)}</div> : <div className="empty-state small"><b>未发现额外提示</b><p>已识别内容可在下方直接覆盖。</p></div>}
          </>}
        </div>
      </section>

      <section className="workbench">
        <div className="form-column">
          <div className="section-header"><div><span className="step-pill">02</span><div><h2>补全与确认要素</h2><p>缺失字段会高亮；条件项会单独提示确认。</p></div></div></div>
          <FieldGrid fields={fields} meta={meta} onChange={update} requiredMissing={requiredMissing} reviewMissing={reviewMissing} personnelHistory={personnel} />
        </div>

        <aside className="side-column">
          <div className="dashboard-card sticky-card">
            <div className="side-title"><div><span className="step-pill warn">!</span><h3>待补充清单</h3></div><b>{requiredMissingItems.length}</b></div>
            {!parsedOnce ? <p className="muted-copy">解析后自动展示。</p> : requiredMissingItems.length === 0 ? <div className="complete-state"><span>✓</span><b>必填要素已齐全</b><p>可继续核对条件项并复制报备。</p></div> : <div className="todo-list">{requiredMissingItems.map(x=><button key={`${String(x.key)}-${x.label}`} onClick={()=>jumpTo(x.key)}><span></span>{x.label}<i>→</i></button>)}</div>}
            {parsedOnce && reviewMissingItems.length > 0 && <><div className="side-subtitle">待确认（条件项）</div><div className="review-list">{reviewMissingItems.map(x=><button key={String(x.key)} onClick={()=>jumpTo(x.key)}>{x.label}</button>)}</div></>}
          </div>

          <div className="dashboard-card preview-card">
            <div className="card-head preview-head"><div><span className="step-pill">03</span><h2>实时成稿</h2></div><button className="primary compact" onClick={copyReport}>{copied?'已复制 ✓':'复制报备'}</button></div>
            <div className="report-preview">{report}</div>
            <div className="preview-note">复制报备时会自动记住本次“存续期负责人 / 执行人员”，供下次直接选择。</div>
          </div>
        </aside>
      </section>

      <details className="dashboard-card settings">
        <summary><div><span className="step-pill muted">⚙</span><b>工作日历设置</b><span>法定节假日 / 调休补班 / 暂估年度</span></div><i>展开</i></summary>
        <div className="settings-body"><p>2026 年已内置官方工作日日历。尚未公布官方节假日安排的年度，系统按周一至周五暂估，并显著标记“暂估”；官方安排公布后补充日历即可自动重算。</p>
          <div className="settings-grid"><label>官方日历已核实年度<input value={overrides.verifiedYears.join(',')} onChange={e=>setOverrides(o=>({...o,verifiedYears:e.target.value.split(',').map(x=>Number(x.trim())).filter(Boolean)}))}/></label><label>非工作日<input value={overrides.holidays.join(',')} onChange={e=>setOverrides(o=>({...o,holidays:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}/></label><label>调休补班日<input value={overrides.workingWeekends.join(',')} onChange={e=>setOverrides(o=>({...o,workingWeekends:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}))}/></label></div>
          <button className="secondary" onClick={saveOverrides}>保存并重算工作日</button>
        </div>
      </details>

      <footer>所有自动推定字段均可人工覆盖 · 特殊项目以实际发行安排为准</footer>
    </main>
  </div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
