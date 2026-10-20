import type { BondFields, ParseMeta } from './bond'
import type { WorkdayOverrides } from '../utils/date'

/** Archives are immutable. Editing one always creates a new archive. */
export interface BondRecord {
  id: string
  sourceId?: string
  createdAt: string
  fields: BondFields
  raw: string
  report: string
  meta: Omit<ParseMeta, 'inferred'> & { inferred: (keyof BondFields)[] }
  calendar: WorkdayOverrides
}
