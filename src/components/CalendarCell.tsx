import React, { memo } from 'react'
import { DayCellBadges, type BadgeDescriptor } from './DayCellBadges'
import { GROUP_COLORS } from '../App'

export interface CalendarCellProps {
  iso: string
  day: number
  inCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  /** Pre-computed badge descriptors (empty array = no badges) */
  badges: BadgeDescriptor[]
  onTap: (iso: string, timestamp: number) => void
  /** If defined, this cell belongs to the specified selection group (0-3) */
  selectionGroupIndex?: number
  isDesktop?: boolean
  isHiddenDesktop?: boolean
  salesFormatted: string
  buyFormatted: string
  expenseFormatted: string
  profitFormatted: string
  profitSign: string
  profitStatus: 'positive' | 'negative' | 'zero'
}

export const CalendarCell = memo(function CalendarCell({
  iso,
  day,
  inCurrentMonth,
  isToday,
  isSelected,
  badges,
  onTap,
  selectionGroupIndex,
  isDesktop = false,
  isHiddenDesktop = false,
  salesFormatted,
  buyFormatted,
  expenseFormatted,
  profitFormatted,
  profitSign,
  profitStatus,
}: CalendarCellProps) {
  if (isDesktop && isHiddenDesktop) {
    return <div className="calendar__cell calendar__cell--desktop-hidden" aria-hidden="true" />
  }

  const isInSelection = selectionGroupIndex !== undefined
  const groupColor = isInSelection ? GROUP_COLORS[selectionGroupIndex] : undefined

  const selectionStyle: React.CSSProperties | undefined = groupColor
    ? {
        '--sel-border': groupColor.border,
        '--sel-fill': groupColor.fill,
        '--sel-glow': groupColor.glow,
      } as React.CSSProperties
    : undefined

  const profitClass =
    profitStatus === 'positive'
      ? 'calendar__cell-line--profit-positive'
      : profitStatus === 'negative'
        ? 'calendar__cell-line--profit-negative'
        : 'calendar__cell-line--profit-zero'

  return (
    <button
      type="button"
      className={[
        'calendar__cell',
        !inCurrentMonth && 'calendar__cell--otherMonth',
        isToday && 'calendar__cell--today',
        isSelected && 'calendar__cell--selected',
        badges.length > 0 && 'calendar__cell--has-badges',
        isInSelection && 'calendar__cell--sel',
      ]
        .filter(Boolean)
        .join(' ')}
      style={selectionStyle}
      onClick={(e) => onTap(iso, e.timeStamp)}
    >
      {/* Badge row — top-right, does not affect content layout */}
      <DayCellBadges badges={badges} />
      <span className="calendar__day-num">{day}</span>
      {inCurrentMonth && (
        <div className="calendar__cell-lines calendar__desktop-lines">
          <div className="calendar__cell-line calendar__cell-line--sales calendar__desktop-line">
            Sales: {salesFormatted}
          </div>
          <div className="calendar__cell-line calendar__cell-line--buy calendar__desktop-line">
            Buy: {buyFormatted}
          </div>
          <div className="calendar__cell-line calendar__cell-line--expense calendar__desktop-line">
            Expense: {expenseFormatted}
          </div>
          <div className={`calendar__cell-line ${profitClass} calendar__desktop-line`}>
            Profit: {profitSign}{profitFormatted}
          </div>
        </div>
      )}
    </button>
  )
})
