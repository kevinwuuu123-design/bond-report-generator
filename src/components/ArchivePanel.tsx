import { useEffect, useMemo, useRef, useState } from 'react'
import type { BondRecord } from '../types/record'
import type { useArchiveStore } from '../hooks/useArchiveStore'
import { downloadBlob, filterRecords, isRecord, amountInYi, type RecordFilter } from '../utils/records'
import { exportRecords, fieldLabels } from '../utils/excel'
import type { BondFields } from '../types/bond'

type Store = ReturnType<typeof useArchiveStore>
const displayTime = (value: string) => new Date(value).toLocaleString('zh-CN',{ timeZone:'Asia/Shanghai', hour12:false })

function RecordDetail({ record,onClose,onEdit,onExport }: { record:BondRecord; onClose:()=>void; onEdit:(record:BondRecord)=>void; onExport:()=>void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const el=ref.current; el?.showModal(); return () => el?.close() },[])
  return <dialog ref={ref} className="record-dialog" onCancel={onClose} aria-labelledby="record-title">
    <div className="dialog-header"><div><p className="eyebrow">已完成 · 归档快照</p><h2 id="record-title">{record.fields.shortName}</h2><p>{displayTime(record.createdAt)}（北京时间）</p></div><button className="secondary" onClick={onClose} aria-label="关闭详情">关闭</button></div>
    <div className="archive-actions"><button className="primary" onClick={onExport}>导出本笔 Excel</button><button className="secondary" onClick={()=>onEdit(record)}>继续编辑并另存</button></div>
    <p className="muted-copy record-id">记录编号：{record.id}{record.sourceId && <> · 来源：{record.sourceId}</>}</p>
    <div className="detail-grid">{(Object.keys(fieldLabels) as (keyof BondFields)[]).map(k=><div key={k}><span>{fieldLabels[k]}</span><b>{record.fields[k] || '未填写'}</b></div>)}</div>
    <h3>已归档报备文本</h3><div className="report-preview">{record.report}</div>
    <details className="detail-source"><summary>簿记结果原文及推定依据</summary><pre>{record.raw}</pre><p>{record.meta.notes.join('\n') || '无额外识别提示'}</p><p>自动推定字段：{record.meta.inferred.map(k=>fieldLabels[k]).join('、') || '无'}</p><p>日期状态：{Object.entries(record.meta.dateConfidence).map(([k,v])=>`${fieldLabels[k as keyof BondFields]}：${v === 'verified' ? '已核实' : v === 'estimated' ? '暂估' : '未标记'}`).join('；') || '未标记'}</p></details>
    <p className="muted-copy">历史快照保持原样。继续编辑完成后会生成新记录，可通过来源编号追溯。</p>
  </dialog>
}

export default function ArchivePanel({ store,onEdit }: { store:Store; onEdit:(record:BondRecord)=>void }) {
  const [filter,setFilter] = useState<RecordFilter>({ query:'',from:'',to:'',market:'' })
  const [selected,setSelected] = useState<Set<string>>(new Set())
  const [detail,setDetail] = useState<BondRecord | null>(null)
  const [page,setPage] = useState(1)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const filtered = useMemo(()=>filterRecords(store.records,filter),[store.records,filter])
  const selectedRecords = filtered.filter(r=>selected.has(r.id))
  const pageCount = Math.max(1,Math.ceil(filtered.length/20))
  const visible = filtered.slice((Math.min(page,pageCount)-1)*20,Math.min(page,pageCount)*20)
  const amounts = filtered.map(r=>amountInYi(r.fields.amount))
  useEffect(()=>{ setSelected(new Set()); setPage(1) },[filter,store.owner])
  useEffect(()=>{ setDetail(null) },[store.owner])
  const runExport = async (records:BondRecord[]) => {
    setBusy(true); setMessage('')
    try { await exportRecords(records); setMessage(`已导出 ${records.length} 笔记录。`) }
    catch (e) { setMessage(e instanceof Error ? e.message : '导出失败，请重试。') }
    finally { setBusy(false) }
  }
  const backup = () => downloadBlob(new Blob([JSON.stringify({ version:1,records:store.records },null,2)],{ type:'application/json' }),`报备记录备份_${new Date().toISOString().slice(0,10)}.json`)
  const restore = async (file?:File) => {
    if (!file) return
    setBusy(true)
    try {
      if (file.size>20*1024*1024) throw new Error('备份文件超过20MB，请拆分后导入。')
      const data = JSON.parse(await file.text())
      if (data.version !== 1 || !Array.isArray(data.records) || !data.records.every(isRecord)) throw new Error('备份格式不正确，未导入任何记录。')
      store.importRecords(data.records); setMessage(`已合并备份中的 ${data.records.length} 笔记录，相同编号自动去重。`)
      void store.sync()
    } catch (e) { setMessage(e instanceof Error ? e.message : '导入失败。') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value='' }
  }
  return <section id="archives" className="dashboard-card archive-panel">
    <div className="card-head"><div><span className="step-pill">04</span><h2>已完成记录</h2><span className="count-badge">{store.records.length}</span></div><div className="archive-actions">
      <button className="secondary" disabled={busy || !store.records.length} onClick={backup}>备份 JSON</button>
      <button className="secondary" disabled={busy || !store.ready} onClick={()=>inputRef.current?.click()}>导入备份</button>
      <button className="primary" disabled={busy || !filtered.length} onClick={()=>void runExport(filtered)}>{busy?'处理中…':'导出筛选结果 Excel'}</button>
      <input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={e=>void restore(e.target.files?.[0])} />
    </div></div>
    <p className="muted-copy">完成归档后自动留存。点击记录可查看当时的完整要素及成稿。{store.session?'当前显示本账号记录。':'当前为本机记录，连接云端后可导入账号。'}</p>
    <div className="archive-filters">
      <label>搜索<input placeholder="债券简称 / 代码 / 发行人 / 人员" value={filter.query} onChange={e=>setFilter({...filter,query:e.target.value})}/></label>
      <label>簿记日期从<input type="date" value={filter.from} onChange={e=>setFilter({...filter,from:e.target.value})}/></label>
      <label>至<input type="date" value={filter.to} onChange={e=>setFilter({...filter,to:e.target.value})}/></label>
      <label>市场<select value={filter.market} onChange={e=>setFilter({...filter,market:e.target.value})}><option value="">全部市场</option><option>协会</option><option>交易所</option><option>其他</option></select></label>
    </div>
    <div className="archive-summary"><span>筛选结果 <b>{filtered.length}</b> 笔 · 可换算规模 <b>{amounts.reduce<number>((s,v)=>s+(v??0),0).toLocaleString('zh-CN',{ maximumFractionDigits:4 })}</b> 亿元{amounts.some(v=>v===null) && `（${amounts.filter(v=>v===null).length}笔未纳入金额）`}</span><span>独立快照按笔计数，同一债券的多个版本请核对去重。</span></div>
    {!!filtered.length && <div className="archive-selection"><label><input type="checkbox" checked={selectedRecords.length===filtered.length} onChange={e=>setSelected(e.target.checked?new Set(filtered.map(r=>r.id)):new Set())}/>全选筛选结果</label><button className="text-btn" disabled={busy || !selectedRecords.length} onClick={()=>void runExport(selectedRecords)}>导出已选 {selectedRecords.length} 笔</button></div>}
    {!filtered.length ? <div className="empty-state small"><b>{store.records.length?'没有匹配记录':'还没有完成记录'}</b><p>{store.records.length?'调整搜索条件后重试。':'补齐要素后点击“完成并归档”，记录会出现在这里。'}</p></div> : <div className="record-list">{visible.map(r=><article className="record-row" key={r.id}>
      <input type="checkbox" aria-label={`选择${r.fields.shortName}`} checked={selected.has(r.id)} onChange={e=>setSelected(prev=>{ const next=new Set(prev); if(e.target.checked)next.add(r.id);else next.delete(r.id);return next })}/>
      <button className="record-open" onClick={()=>setDetail(r)}><b>{r.fields.shortName}<span>{r.fields.market}</span>{r.sourceId && <em>续编</em>}</b><span>{r.fields.issuer} · {r.fields.bondCode || '未填写代码'}</span><small>簿记 {r.fields.bookDate} · {r.fields.amount} · {r.fields.coupon} · 归档 {displayTime(r.createdAt)}</small></button>
      <div className="record-row-actions"><span className={`sync-pill ${store.session && store.pending && !store.lastSynced?'pending':''}`}>{store.session?'账号记录':'仅本机'}</span><button className="secondary" disabled={busy} onClick={()=>void runExport([r])}>Excel</button></div>
    </article>)}</div>}
    {pageCount>1 && <div className="pagination"><button className="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{Math.min(page,pageCount)} / {pageCount}</span><button className="secondary" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>下一页</button></div>}
    {message && <p className="action-message" role="status">{message}</p>}
    {detail && <RecordDetail record={detail} onClose={()=>setDetail(null)} onExport={()=>void runExport([detail])} onEdit={record=>{ onEdit(record); setDetail(null) }}/>}
  </section>
}
