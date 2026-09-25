import type { BondFields, ParseMeta } from '../types/bond'

type Props = {
  fields: BondFields
  meta: ParseMeta
  onChange: (key: keyof BondFields, value: string) => void
}

const rows: Array<[keyof BondFields, string]> = [
  ['issuer','发行人全称'], ['bondCode','债券代码'], ['shortName','债券简称'], ['bondType','债券类型'], ['market','市场'],
  ['bookDate','簿记日期'], ['paymentDate','缴款日期'], ['interestStartDate','起息日'], ['issuerRating','主体评级（可选）'], ['bondRating','债项评级表述（可选）'],
  ['guarantee','担保表述（可选）'], ['amount','发行规模'], ['term','债券期限'], ['rateLabel','利率字段表述'], ['coupon','利率'], ['bookMultiple','全场倍数'],
  ['leadRole','牵头/角色表述'], ['coUnderwriters','联席主承销商'], ['salesMethod','销售方式（可选）'], ['ourUnderwritingAndFee','我司承销规模与承销费表述'],
  ['continuingLead','存续期负责人'], ['continuingExecutor','存续期执行人员'], ['archiveSubmitDate','拟提交归档日期'], ['archiveFinishDate','最晚归档日期'],
  ['archiveWording','归档文字口径'], ['archiveCountMode','归档工作日计数口径'], ['aExposurePrefix','A类表述前缀'], ['aExposure','A类敞口/额度'], ['approvalStatus','批文状态完整表述']
]

export default function FieldGrid({ fields, meta, onChange }: Props) {
  return <div className="field-grid">
    {rows.map(([key,label]) => {
      const inferred = meta.inferred.has(key)
      const value = String(fields[key] ?? '')
      const confidence = (key === 'bookDate' || key === 'archiveSubmitDate' || key === 'archiveFinishDate') ? meta.dateConfidence[key] : ''
      return <label className="field" key={key}>
        <span>{label}{inferred && <em>自动推定</em>}{confidence === 'estimated' && <em className="estimate">暂估</em>}{confidence === 'verified' && <em className="verified">日历已核实</em>}</span>
        {key === 'market' ? (
          <select value={value} onChange={e => onChange(key, e.target.value)}>
            <option value="">请选择</option><option value="协会">协会</option><option value="交易所">交易所</option><option value="其他">其他</option>
          </select>
        ) : key === 'archiveWording' ? (
          <select value={value} onChange={e => onChange(key, e.target.value)}>
            <option value="归档">提交归档 / 归档完毕</option><option value="发行底稿报送">申请报送 / 完成发行底稿报送</option>
          </select>
        ) : key === 'archiveCountMode' ? (
          <select value={value} onChange={e => onChange(key, e.target.value)}>
            <option value="次日起算">簿记日次日起算（默认）</option><option value="簿记日计第1日">簿记日计第1个工作日</option>
          </select>
        ) : (
          <input value={value} onChange={e => onChange(key, e.target.value)} placeholder={`请输入${label}`} />
        )}
      </label>
    })}
  </div>
}
