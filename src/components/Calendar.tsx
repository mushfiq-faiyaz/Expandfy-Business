import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  daysInMonth,
  extractDateOnly,
  formatMonthDay,
  isDateMismatch,
  monthYearLabel,
  parseISODate,
  toISODate,
  weekdayIndexFirstOfMonth,
} from '../dateUtils'
import { CalendarCell } from './CalendarCell'
import type { BadgeDescriptor } from './DayCellBadges'
import type { CalendarEntry } from '../types'
import { getNetworkNow, getNetworkTodayIso } from '../networkTime'
import type { SelectionGroup } from '../App'
import { GROUP_COLORS } from '../App'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

const GRID_GAP_PX = 2
const WEEKDAY_GRID_GAP_PX = 2
const BLOCK_GAP_PX = 4

type Props = {
  year: number
  monthIndex: number
  salesByDate: Record<string, number>
  buyByDate: Record<string, number>
  expenseByDate: Record<string, number>
  selectedDate: string
  statusMessage: string
  formatMoney: (n: number) => string
  onMonthChange: (year: number, monthIndex: number) => void
  onSelectDate: (iso: string) => void
  onDoubleTapDate: (iso: string) => void
  onAddEntry?: () => void
  entries?: CalendarEntry[]
  todayDate?: Date
  todayDateIso?: string
  // Selection mode props
  selectMode?: boolean
  selectionGroups?: SelectionGroup[]
  activeGroupIndex?: number
  onCellTapInSelectMode?: (iso: string) => void
  onNewGroup?: () => void
}

export function Calendar({
  year,
  monthIndex,
  salesByDate,
  buyByDate,
  expenseByDate,
  selectedDate,
  statusMessage,
  formatMoney,
  onMonthChange,
  onSelectDate,
  onDoubleTapDate,
  entries,
  todayDate,
  todayDateIso: propTodayDateIso,
  selectMode = false,
  selectionGroups = [],
  activeGroupIndex = 0,
  onCellTapInSelectMode,
  onNewGroup,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const weekdayRowRef = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<{ iso: string; ts: number } | null>(null)
  const [cellPx, setCellPx] = useState(48)
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 768px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const firstDow = weekdayIndexFirstOfMonth(year, monthIndex)
  const dim = daysInMonth(year, monthIndex)
  const neededRows = Math.ceil((firstDow + dim) / 7)
  const desktopTotalSlots = neededRows * 7
  const today = todayDate ?? getNetworkNow()
  const todayDateIso = propTodayDateIso ?? getNetworkTodayIso()
  const todayIso =
    today.getFullYear() === year && today.getMonth() === monthIndex
      ? todayDateIso
      : null

  const totalCells = 42
  const prevMonthDate = new Date(year, monthIndex, 0)
  const prevYear = prevMonthDate.getFullYear()
  const prevMonthIndex = prevMonthDate.getMonth()
  const prevDim = daysInMonth(prevYear, prevMonthIndex)

  type CalendarCell = {
    iso: string
    day: number
    inCurrentMonth: boolean
  }

  const cells: CalendarCell[] = []
  for (let i = 0; i < firstDow; i++) {
    const day = prevDim - firstDow + i + 1
    const iso = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ iso, day, inCurrentMonth: false })
  }
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ iso, day: d, inCurrentMonth: true })
  }
  while (cells.length < totalCells) {
    const nextDate = parseISODate(cells[cells.length - 1].iso)
    nextDate.setDate(nextDate.getDate() + 1)
    cells.push({
      iso: toISODate(nextDate),
      day: nextDate.getDate(),
      inCurrentMonth: false,
    })
  }

  const rowCount = 6

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = (): void => {
      const W = host.clientWidth
      const H = host.clientHeight
      const weekdayH = Math.max(
        20,
        weekdayRowRef.current?.getBoundingClientRect().height ?? 22,
      )
      const reservedFooterH = 34
      const reservedAboveGrid = weekdayH + BLOCK_GAP_PX
      const maxCellW = (W - 6 * GRID_GAP_PX) / 7
      const maxCellH = (H - reservedAboveGrid - reservedFooterH - (rowCount - 1) * GRID_GAP_PX) / rowCount
      const s = Math.floor(Math.min(maxCellW, maxCellH))
      setCellPx(Number.isFinite(s) ? Math.max(26, s) : 48)
    }

    const ro = new ResizeObserver(measure)
    ro.observe(host)
    const weekdayEl = weekdayRowRef.current
    if (weekdayEl) ro.observe(weekdayEl)
    measure()
    return () => ro.disconnect()
  }, [rowCount, year, monthIndex])

  const colTemplate = `repeat(7, ${cellPx}px)`
  const rowTemplate = `repeat(${rowCount}, ${cellPx}px)`
  const badgesByDate = useMemo(() => {
    if (!entries || entries.length === 0) return {} as Record<string, BadgeDescriptor[]>

    // Collect raw data keyed by date
    const backdatedLines: Record<string, Set<string>> = {}
    const editedLines: Record<string, Set<string>> = {}

    for (const entry of entries) {
      const targetIso = entry.targetDate || entry.date
      if (!targetIso) continue
      const key = extractDateOnly(targetIso)

      // — backdated check —
      if (entry.createdAt && isDateMismatch(targetIso, entry.createdAt)) {
        if (!backdatedLines[key]) backdatedLines[key] = new Set()
        const createdFmt = formatMonthDay(entry.createdAt)
        const targetFmt = formatMonthDay(targetIso)
        backdatedLines[key].add(`Logged on ${createdFmt} for ${targetFmt}`)
      }

      // — edited check —
      const hasBeenEdited = Boolean(
        (entry.editHistory && entry.editHistory.length > 0) || entry.updatedAt,
      )
      if (hasBeenEdited) {
        if (!editedLines[key]) editedLines[key] = new Set()
        const timestamps: string[] = []
        if (entry.editHistory && entry.editHistory.length > 0) {
          for (const h of entry.editHistory) {
            if (h.editedAt) timestamps.push(h.editedAt)
          }
        } else if (entry.updatedAt) {
          timestamps.push(entry.updatedAt)
        }
        if (timestamps.length === 0) {
          editedLines[key].add('Value edited')
        } else {
          for (const ts of timestamps) {
            editedLines[key].add(`Value edited on ${formatMonthDay(ts)}`)
          }
        }
      }
    }

    const out: Record<string, BadgeDescriptor[]> = {}
    const allKeys = new Set([...Object.keys(backdatedLines), ...Object.keys(editedLines)])

    for (const k of allKeys) {
      const list: BadgeDescriptor[] = []
      if (editedLines[k] && editedLines[k].size > 0) {
        list.push({
          type: 'edited',
          lines: Array.from(editedLines[k]),
        })
      }
      if (backdatedLines[k] && backdatedLines[k].size > 0) {
        list.push({
          type: 'backdated',
          lines: Array.from(backdatedLines[k]),
        })
      }
      out[k] = list
    }

    return out
  }, [entries])

  const selectionMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (let i = 0; i < selectionGroups.length; i++) {
      for (const iso of selectionGroups[i].dates) {
        map[iso] = i
      }
    }
    return map
  }, [selectionGroups])

  const blockWidth = 7 * cellPx + 6 * WEEKDAY_GRID_GAP_PX

  const hasSelectedDateEntries =
    (salesByDate[selectedDate] ?? 0) > 0 ||
    (buyByDate[selectedDate] ?? 0) > 0 ||
    (expenseByDate[selectedDate] ?? 0) > 0
  const isEmptyDay = !hasSelectedDateEntries && selectedDate <= todayDateIso

  function shiftMonth(delta: number): void {
    const d = new Date(year, monthIndex + delta, 1)
    onMonthChange(d.getFullYear(), d.getMonth())
  }

  const handleCellTap = useCallback(
    (iso: string, now: number): void => {
      if (selectMode) {
        onCellTapInSelectMode?.(iso)
        return
      }
      const prev = lastTapRef.current
      // Double-tap opens quick entry for today or any past date (not future)
      const isFuture = iso > todayDateIso
      if (!isFuture && prev && prev.iso === iso && now - prev.ts <= 300) {
        lastTapRef.current = null
        onDoubleTapDate(iso)
        return
      }
      lastTapRef.current = { iso, ts: now }
      onSelectDate(iso)
    },
    [selectMode, todayDateIso, onDoubleTapDate, onSelectDate, onCellTapInSelectMode],
  )

  const canAddNewGroup = selectionGroups.length < 4
  const activeColor = GROUP_COLORS[activeGroupIndex] ?? GROUP_COLORS[0]

  return (
    <div className="calendar">
      <div className="calendar__nav">
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="calendar__header-center">
          <span className="calendar__month">{monthYearLabel(year, monthIndex)}</span>
        </div>

        {/* New Group pill — only shown when select mode is active */}
        {selectMode && (
          <button
            type="button"
            className={`calendar-newgroup-pill${!canAddNewGroup ? ' calendar-newgroup-pill--disabled' : ''}`}
            onClick={canAddNewGroup ? onNewGroup : undefined}
            aria-label="Start new selection group"
            title={canAddNewGroup ? `New group (${GROUP_COLORS[selectionGroups.length]?.label ?? ''})` : 'Maximum 4 groups reached'}
            style={{ '--pill-color': activeColor.border } as React.CSSProperties}
          >
            <Plus size={12} strokeWidth={2.5} />
            <span>New Group</span>
          </button>
        )}

        <button
          type="button"
          className="calendar__nav-btn"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div ref={hostRef} className="calendar__gridHost">
        <div
          ref={weekdayRowRef}
          className="calendar__weekdays calendar__weekdays--square"
          style={{
            width: isDesktop ? '100%' : blockWidth,
            gridTemplateColumns: isDesktop ? 'repeat(7, minmax(0, 1fr))' : colTemplate,
            gap: isDesktop ? 4 : WEEKDAY_GRID_GAP_PX,
          }}
        >
          {WEEKDAYS.map((w) => (
            <span key={w} className="calendar__weekday">
              {w}
            </span>
          ))}
        </div>
        <div
          className="calendar__grid calendar__grid--square"
          style={{
            width: isDesktop ? '100%' : blockWidth,
            gridTemplateColumns: isDesktop ? 'repeat(7, minmax(0, 1fr))' : colTemplate,
            gridTemplateRows: isDesktop ? `repeat(${neededRows}, minmax(112px, 1fr))` : rowTemplate,
            gap: isDesktop ? 4 : GRID_GAP_PX,
          }}
        >
          {(isDesktop ? cells.slice(0, desktopTotalSlots) : cells).map((cell, cellIndex) => {
            const { iso, day, inCurrentMonth } = cell
            const isHiddenDesktop = isDesktop && (cellIndex < firstDow || cellIndex >= firstDow + dim)
            const isToday = todayIso === iso
            const isSelected = !selectMode && selectedDate === iso

            const daySales = salesByDate[iso] ?? 0
            const dayBuy = buyByDate[iso] ?? 0
            const dayExpense = expenseByDate[iso] ?? 0
            const dayProfit = daySales - dayBuy - dayExpense

            const profitStatus =
              dayProfit > 0 ? 'positive' : dayProfit < 0 ? 'negative' : 'zero'
            const profitSign = dayProfit > 0 ? '+' : ''

            const salesFormatted = formatMoney(daySales)
            const buyFormatted = formatMoney(dayBuy)
            const expenseFormatted = formatMoney(dayExpense)
            const profitFormatted = formatMoney(dayProfit)

            const selectionGroupIndex = selectionMap[iso] ?? undefined

            return (
              <CalendarCell
                key={iso}
                iso={iso}
                day={day}
                inCurrentMonth={inCurrentMonth}
                isToday={isToday}
                isSelected={isSelected}
                badges={badgesByDate[iso] ?? []}
                onTap={handleCellTap}
                selectionGroupIndex={selectionGroupIndex}
                isDesktop={isDesktop}
                isHiddenDesktop={isHiddenDesktop}
                salesFormatted={salesFormatted}
                buyFormatted={buyFormatted}
                expenseFormatted={expenseFormatted}
                profitFormatted={profitFormatted}
                profitSign={profitSign}
                profitStatus={profitStatus}
              />
            )
          })}
        </div>
        <div className="calendar__footer" style={{ width: isDesktop ? '100%' : blockWidth }}>
          {!selectMode && isEmptyDay ? (
            <p className="calendar__empty-text">
              No entries for this day.
            </p>
          ) : !selectMode && statusMessage ? (
            <p className="calendar__status">
              {statusMessage}
            </p>
          ) : selectMode ? (
            <p className="calendar__status calendar__status--select-hint">
              {selectionGroups.reduce((sum, g) => sum + g.dates.size, 0) === 0
                ? 'Tap dates to select them'
                : `${selectionGroups.reduce((sum, g) => sum + g.dates.size, 0)} date${selectionGroups.reduce((sum, g) => sum + g.dates.size, 0) !== 1 ? 's' : ''} selected — tap ⓘ to view`}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
