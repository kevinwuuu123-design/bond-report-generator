import type { Market } from '../types/bond'

export function detectBondType(shortName: string, bondCode = '', rawText = ''): string {
  const s = `${shortName} ${bondCode} ${rawText}`.toUpperCase()
  if (s.includes('PPN')) return '定向债务融资工具'
  if (s.includes('MTN')) return '中期票据'
  if (s.includes('SCP')) return '超短期融资券'
  if (/(^|[^A-Z])CP([^A-Z]|$)/.test(s)) return '短期融资券'
  if (s.includes('ABN')) return '资产支持票据'
  if (/私募/.test(rawText) || /非公开发行公司债券/.test(rawText)) {
    return /K\d/i.test(shortName) ? '私募公司债（科创债）' : '私募公司债'
  }
  // 交易所科创债常见简称含 K，且代码为 6 位数字。
  if (/K\d/i.test(shortName) && /^\d{6}$/.test(bondCode)) return '私募公司债（科创债）'
  if (/公开发行公司债券/.test(rawText)) return '公开发行公司债券'
  if (s.includes('ABS')) return '资产支持证券'
  return ''
}

export function detectMarket(shortName: string, bondCode: string, bondType: string, rawText = ''): Market {
  const s = `${shortName} ${bondCode} ${rawText}`.toUpperCase()
  if (['定向债务融资工具', '中期票据', '超短期融资券', '短期融资券', '资产支持票据'].includes(bondType)) return '协会'
  if (s.includes('.IB') && /(MTN|PPN|SCP|CP|ABN)/.test(s)) return '协会'
  if (s.includes('.SH') || s.includes('.SZ') || /^\d{6}$/.test(bondCode) || bondType.includes('公司债')) return '交易所'
  return '其他'
}

export function defaultRateLabel(bondType: string): string {
  if (bondType === '定向债务融资工具') return '票面利率'
  if (['中期票据', '私募公司债', '私募公司债（科创债）', '公开发行公司债券'].includes(bondType)) return '发行利率'
  return '票面利率'
}
