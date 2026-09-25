import type { BondFields, ParseMeta } from '../types/bond'

type Props = {
  fields: BondFields
  meta: ParseMeta
  onChange: (key: keyof BondFields, value: string) => void
  requiredMissing: Set<keyof BondFields>
  reviewMissing: Set<keyof BondFields>
  personnelHistory: { leads: string[]; executors: string[] }
}

type SimpleField = { key: keyof BondFields; label: string; placeholder?: string; optional?: boolean; type?: 'date' }

function FieldShell({ fieldKey, label, inferred, confidence, missing, review, children }:{fieldKey:keyof BondFields,label:string,inferred:boolean,confidence?:string,missing:boolean,review:boolean,children:React.ReactNode}) {
  return <label id={`field-${String(fieldKey)}`} className={`field ${missing ? 'field-missing' : ''} ${review ? 'field-review' : ''}`}>
    <div className="field-label-row"><span>{label}</span><div className="field-tags">{inferred && <em>自动推定</em>}{confidence === 'estimated' && <em className="estimate">暂估</em>}{confidence === 'verified' && <em className="verified">日历已核实</em>}{missing && <em className="required">待补</em>}{review && !missing && <em className="review">待确认</em>}</div></div>
    {children}
  </label>
}

function SimpleInput({ item, fields, meta, onChange, requiredMissing, reviewMissing }:{item:SimpleField,fields:BondFields,meta:ParseMeta,onChange:Props['onChange'],requiredMissing:Set<keyof BondFields>,reviewMissing:Set<keyof BondFields>}) {
  const key = item.key; const value = String(fields[key] ?? ''); const inferred = meta.inferred.has(key)
  const confidence = (key === 'bookDate' || key === 'archiveSubmitDate' || key === 'archiveFinishDate') ? meta.dateConfidence[key] : ''
  return <FieldShell fieldKey={key} label={item.label} inferred={inferred} confidence={confidence} missing={requiredMissing.has(key)} review={reviewMissing.has(key)}>
    <input type={item.type || 'text'} value={value} onChange={e => onChange(key,e.target.value)} placeholder={item.placeholder || `请输入${item.label}`} />
  </FieldShell>
}

export default function FieldGrid({ fields, meta, onChange, requiredMissing, reviewMissing, personnelHistory }: Props) {
  const base: SimpleField[] = [
    {key:'issuer',label:'发行人全称'}, {key:'bondCode',label:'债券代码'}, {key:'shortName',label:'债券简称'}, {key:'bondType',label:'债券类型'},
    {key:'bookDate',label:'簿记日期',type:'date'}, {key:'paymentDate',label:'缴款日期',type:'date'}, {key:'interestStartDate',label:'起息日',type:'date'},
    {key:'amount',label:'发行规模'}, {key:'term',label:'债券期限'}, {key:'coupon',label:'利率'}, {key:'bookMultiple',label:'全场倍数'},
  ]
  return <div className="form-sections">
    <section className="form-card">
      <div className="form-card-title"><span className="section-index">01</span><div><h3>发行基本要素</h3><p>从簿记结果自动识别，必要时可直接覆盖。</p></div></div>
      <div className="field-grid">
        {base.slice(0,4).map(item => <SimpleInput key={String(item.key)} {...{item,fields,meta,onChange,requiredMissing,reviewMissing}} />)}
        <FieldShell fieldKey="market" label="市场" inferred={meta.inferred.has('market')} missing={requiredMissing.has('market')} review={reviewMissing.has('market')}>
          <select value={fields.market} onChange={e => onChange('market',e.target.value)}><option value="">请选择</option><option value="协会">协会</option><option value="交易所">交易所</option><option value="其他">其他</option></select>
        </FieldShell>
        {base.slice(4,7).map(item => <SimpleInput key={String(item.key)} {...{item,fields,meta,onChange,requiredMissing,reviewMissing}} />)}
        {base.slice(7).map(item => <SimpleInput key={String(item.key)} {...{item,fields,meta,onChange,requiredMissing,reviewMissing}} />)}
        <FieldShell fieldKey="rateLabel" label="利率字段表述" inferred={meta.inferred.has('rateLabel')} missing={false} review={false}>
          <select value={fields.rateLabel} onChange={e=>onChange('rateLabel',e.target.value)}><option value="发行利率">发行利率</option><option value="票面利率">票面利率</option><option value="债券利率">债券利率</option></select>
        </FieldShell>
      </div>
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="section-index">02</span><div><h3>评级与增信</h3><p>未提供的要素会提示确认；担保采用条件式填写。</p></div></div>
      <div className="field-grid">
        <SimpleInput item={{key:'issuerRating',label:'主体评级（可选）',placeholder:'如 AAA（联合、中诚信）'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
        <SimpleInput item={{key:'bondRating',label:'债项评级（可选）',placeholder:'如 无债项评级 / AAA'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
        <FieldShell fieldKey="guaranteeMode" label="担保情况" inferred={false} missing={requiredMissing.has('guaranteeMode')} review={reviewMissing.has('guaranteeMode')}>
          <div className="segmented">
            <button type="button" className={fields.guaranteeMode==='无担保'?'active':''} onClick={()=>onChange('guaranteeMode','无担保')}>无担保</button>
            <button type="button" className={fields.guaranteeMode==='有担保'?'active':''} onClick={()=>onChange('guaranteeMode','有担保')}>有担保</button>
          </div>
        </FieldShell>
        {fields.guaranteeMode === '有担保' && <SimpleInput item={{key:'guarantorName',label:'担保人名称',placeholder:'如 中国投融资担保股份有限公司'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />}
        {fields.guaranteeMode === '无担保' && <div className="info-tile"><b>输出表述</b><span>无担保</span></div>}
      </div>
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="section-index">03</span><div><h3>承销与销售</h3><p>把“机构”和“角色”拆开，避免只写“我司”造成句子生硬。</p></div></div>
      <div className="field-grid">
        <SimpleInput item={{key:'leadInstitution',label:'牵头主承销商',placeholder:'如 我司 / 长江证券'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
        <FieldShell fieldKey="leadRoleType" label="牵头角色" inferred={false} missing={false} review={false}>
          <select value={fields.leadRoleType} onChange={e=>onChange('leadRoleType',e.target.value)}><option value="牵头">牵头</option><option value="牵头、簿记管理人">牵头、簿记管理人</option><option value="牵头且负责存续期管理">牵头且负责存续期管理</option><option value="牵头受托">牵头受托</option><option value="其他">其他（机构栏直接写完整表述）</option></select>
        </FieldShell>
        <SimpleInput item={{key:'coUnderwriters',label:'联席主承销商（可选）',placeholder:'多家以顿号或逗号分隔'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
        <SimpleInput item={{key:'salesMethod',label:'销售方式（可选）',placeholder:'如 竞争性销售'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
      </div>

      <div className="sub-panel">
        <div className="sub-panel-head"><div><b>我司承销规模与承销费</b><span>选择常用口径，再补数字；也支持自定义。</span></div></div>
        <div className="choice-cards">
          {[
            ['待定','规模与承销费待定'],['份额及费用','承销份额 + 承销费'],['规模及费用','承销规模 + 承销费'],['年度费用','规模 + 年度承销费'],['其他','其他表述']
          ].map(([v,label])=><button type="button" key={v} className={fields.underwritingMode===v?'active':''} onClick={()=>onChange('underwritingMode',v)}>{label}</button>)}
        </div>
        <div className="field-grid compact-grid">
          {fields.underwritingMode === '份额及费用' && <>
            <SimpleInput item={{key:'ourUnderwritingShare',label:'我司承销份额',placeholder:'如 20%'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
            <SimpleInput item={{key:'ourFee',label:'我司承销费',placeholder:'如 96万元'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
          </>}
          {fields.underwritingMode === '规模及费用' && <>
            <SimpleInput item={{key:'ourUnderwritingScale',label:'我司承销规模',placeholder:'如 0.90亿元'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
            <SimpleInput item={{key:'ourFee',label:'我司承销费',placeholder:'如 96万元'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
          </>}
          {fields.underwritingMode === '年度费用' && <>
            <SimpleInput item={{key:'ourUnderwritingScale',label:'我司承销规模',placeholder:'如 0.90亿元'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
            <SimpleInput item={{key:'feeYear',label:'承销费年度',placeholder:'如 2026'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
            <SimpleInput item={{key:'ourFee',label:'我司年度承销费',placeholder:'如 96万元'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
          </>}
          {fields.underwritingMode === '其他' && <SimpleInput item={{key:'ourUnderwritingAndFee',label:'自定义完整表述',placeholder:'如 我司承销规模与承销费待定'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />}
        </div>
      </div>
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="section-index">04</span><div><h3>存续与归档</h3><p>人员会在复制报备时自动记住，下次可直接从历史记录选择。</p></div></div>
      <div className="field-grid">
        <FieldShell fieldKey="continuingLead" label="存续期负责人" inferred={false} missing={requiredMissing.has('continuingLead')} review={false}>
          <input list="lead-history" value={fields.continuingLead} onChange={e=>onChange('continuingLead',e.target.value)} placeholder="输入或选择历史负责人"/><datalist id="lead-history">{personnelHistory.leads.map(x=><option key={x} value={x}/>)}</datalist>
        </FieldShell>
        <FieldShell fieldKey="continuingExecutor" label="存续期执行人员" inferred={false} missing={requiredMissing.has('continuingExecutor')} review={false}>
          <input list="executor-history" value={fields.continuingExecutor} onChange={e=>onChange('continuingExecutor',e.target.value)} placeholder="输入或选择历史执行人员"/><datalist id="executor-history">{personnelHistory.executors.map(x=><option key={x} value={x}/>)}</datalist>
        </FieldShell>
        <SimpleInput item={{key:'archiveSubmitDate',label:'拟提交归档日期',type:'date'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
        <SimpleInput item={{key:'archiveFinishDate',label:'最晚归档日期',type:'date'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
        <FieldShell fieldKey="archiveWording" label="归档文字口径" inferred={false} missing={false} review={false}><select value={fields.archiveWording} onChange={e=>onChange('archiveWording',e.target.value)}><option value="归档">提交归档 / 归档完毕</option><option value="发行底稿报送">申请报送 / 完成发行底稿报送</option></select></FieldShell>
        <FieldShell fieldKey="archiveCountMode" label="归档工作日计数口径" inferred={false} missing={false} review={false}><select value={fields.archiveCountMode} onChange={e=>onChange('archiveCountMode',e.target.value)}><option value="次日起算">簿记日次日起算（默认）</option><option value="簿记日计第1日">簿记日计第1个工作日</option></select></FieldShell>
      </div>
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="section-index">05</span><div><h3>敞口与批文</h3><p>未使用 A 类时自动隐藏额度输入，生成结果不再写额度。</p></div></div>
      <div className="field-grid">
        <FieldShell fieldKey="aExposureUsage" label="A类敞口" inferred={false} missing={requiredMissing.has('aExposureUsage')} review={false}>
          <div className="segmented"><button type="button" className={fields.aExposureUsage==='使用'?'active':''} onClick={()=>onChange('aExposureUsage','使用')}>使用</button><button type="button" className={fields.aExposureUsage==='未使用'?'active':''} onClick={()=>onChange('aExposureUsage','未使用')}>未使用</button></div>
        </FieldShell>
        {fields.aExposureUsage === '使用' && <SimpleInput item={{key:'aExposure',label:'A类敞口额度',placeholder:'如 7000万元 / 1亿元'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />}
        {fields.aExposureUsage === '未使用' && <div className="info-tile"><b>输出表述</b><span>我司未使用A类敞口</span></div>}
        <SimpleInput item={{key:'approvalStatus',label:'批文状态完整表述',placeholder:'如 批文无剩余额度 / 批文剩余额度4.4亿元，批文到期时间2027年3月20日'}} {...{fields,meta,onChange,requiredMissing,reviewMissing}} />
      </div>
    </section>
  </div>
}
