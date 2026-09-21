import { Clock } from 'lucide-react'
import { ExpendfyLogo } from './ExpendfyLogo'
import { BrandWordmark } from './BrandWordmark'
import { useNetworkTime } from '../networkTime'

type Props = {
  selectedDateLabel: string
  isToday: boolean
  todayShortDate?: string
  daySales: number
  dayBuy: number
  dayExpense: number
  monthlySales: number
  monthlyBuy: number
  monthlyExpense: number
  yearlySales: number
  yearlyBuy: number
  yearlyExpense: number
  currentYear?: number
  viewYear: number
  viewMonth: number
  formatMoney: (n: number) => string
  onMenuClick: () => void
  timeFormat: '12h' | '24h'
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function Header({
  selectedDateLabel,
  isToday,
  todayShortDate,
  daySales,
  dayBuy,
  dayExpense,
  monthlySales,
  monthlyBuy,
  monthlyExpense,
  yearlySales,
  yearlyBuy,
  yearlyExpense,
  currentYear,
  viewYear,
  viewMonth,
  formatMoney,
  onMenuClick,
  timeFormat,
}: Props) {
  const { now } = useNetworkTime(1000)
  const formattedLiveTime = now.toLocaleTimeString(undefined, {
    hour: timeFormat === '12h' ? 'numeric' : '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat === '12h',
  })

  const monthLabel = `${MONTH_NAMES[viewMonth]} ${viewYear}`
  const displayYear = currentYear ?? now.getFullYear()

  const dayProfit = daySales - dayBuy - dayExpense
  const dayProfitPositive = dayProfit > 0
  const dayProfitNegative = dayProfit < 0
  const dayProfitSign = dayProfitPositive ? '+' : ''
  const dayProfitClass = dayProfitPositive
    ? 'app-header__value--profit-positive'
    : dayProfitNegative
      ? 'app-header__value--profit-negative'
      : 'app-header__value--profit-zero'

  const monthlyProfit = monthlySales - monthlyBuy - monthlyExpense
  const monthlyProfitPositive = monthlyProfit > 0
  const monthlyProfitNegative = monthlyProfit < 0
  const monthlyProfitSign = monthlyProfitPositive ? '+' : ''
  const monthlyProfitClass = monthlyProfitPositive
    ? 'app-header__value--profit-positive'
    : monthlyProfitNegative
      ? 'app-header__value--profit-negative'
      : 'app-header__value--profit-zero'

  const yearlyProfit = yearlySales - yearlyBuy - yearlyExpense
  const yearlyProfitPositive = yearlyProfit > 0
  const yearlyProfitNegative = yearlyProfit < 0
  const yearlyProfitSign = yearlyProfitPositive ? '+' : ''
  const yearlyProfitClass = yearlyProfitPositive
    ? 'app-header__value--profit-positive'
    : yearlyProfitNegative
      ? 'app-header__value--profit-negative'
      : 'app-header__value--profit-zero'

  return (
    <header className="app-header">
      <div className="app-header__row">
        <div className="app-header__brand">
          <ExpendfyLogo size={40} />
          <BrandWordmark size="md" layout="stacked" />
        </div>

        {/* Live time pill */}
        <div className="app-header__time-pill" aria-label="Live time">
          <Clock size={11} strokeWidth={2.4} className="app-header__time-pill-icon" />
          <span className="app-header__time-pill-text">{formattedLiveTime}</span>
        </div>

        <button
          type="button"
          className="app-header__menu"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          ☰
        </button>
      </div>

      {/* ── Summary card ── */}
      <div className="app-header__meta">

        {/* SECTION 1 — Today / Selected Date */}
        <div className="app-header__panel app-header__panel--today app-header__panel--left">
          <div className="app-header__panel-header">
            <span className="app-header__panel-title">
              {isToday ? 'Today' : selectedDateLabel}
            </span>
            {isToday && todayShortDate && (
              <span className="app-header__panel-subtitle">{todayShortDate}</span>
            )}
          </div>

          <div className="app-header__stat-row" title="Today's Sales">
            <span className="app-header__label">Sales</span>
            <span className="app-header__value">
              {formatMoney(daySales)}
            </span>
          </div>

          <div className="app-header__stat-row" title="Today's Buy">
            <span className="app-header__label app-header__label--buy">Buy</span>
            <span className="app-header__value app-header__value--buy">
              {formatMoney(dayBuy)}
            </span>
          </div>

          <div className="app-header__stat-row" title="Today's Expense">
            <span className="app-header__label">Expense</span>
            <span className="app-header__value">
              {formatMoney(dayExpense)}
            </span>
          </div>

          <div className="app-header__stat-row app-header__stat-row--profit" title="Today's Profit">
            <span className="app-header__label app-header__label--profit">Profit</span>
            <span className={`app-header__value app-header__value--profit ${dayProfitClass}`}>
              {dayProfitSign}{formatMoney(dayProfit)}
            </span>
          </div>
        </div>

        {/* DIVIDER 1 */}
        <div className="app-header__divider" />

        {/* SECTION 2 — Monthly */}
        <div className="app-header__panel app-header__panel--monthly">
          <div className="app-header__panel-header">
            <span className="app-header__panel-title app-header__panel-title--monthly">
              Monthly
            </span>
            <span className="app-header__panel-subtitle">{monthLabel}</span>
          </div>

          <div className="app-header__stat-row" title="Monthly Sales">
            <span className="app-header__label">Sales</span>
            <span className="app-header__value">
              {formatMoney(monthlySales)}
            </span>
          </div>

          <div className="app-header__stat-row" title="Monthly Buy">
            <span className="app-header__label app-header__label--buy">Buy</span>
            <span className="app-header__value app-header__value--buy">
              {formatMoney(monthlyBuy)}
            </span>
          </div>

          <div className="app-header__stat-row" title="Monthly Expense">
            <span className="app-header__label">Expense</span>
            <span className="app-header__value">
              {formatMoney(monthlyExpense)}
            </span>
          </div>

          <div className="app-header__stat-row app-header__stat-row--profit" title="Monthly Profit">
            <span className="app-header__label app-header__label--profit">Profit</span>
            <span className={`app-header__value app-header__value--profit ${monthlyProfitClass}`}>
              {monthlyProfitSign}{formatMoney(monthlyProfit)}
            </span>
          </div>
        </div>

        {/* DIVIDER 2 */}
        <div className="app-header__divider" />

        {/* SECTION 3 — Yearly */}
        <div className="app-header__panel app-header__panel--yearly app-header__panel--right">
          <div className="app-header__panel-header">
            <span className="app-header__panel-title app-header__panel-title--yearly">
              Yearly
            </span>
            <span className="app-header__panel-subtitle">{displayYear}</span>
          </div>

          <div className="app-header__stat-row" title="Yearly Sales">
            <span className="app-header__label">Sales</span>
            <span className="app-header__value">
              {formatMoney(yearlySales)}
            </span>
          </div>

          <div className="app-header__stat-row" title="Yearly Buy">
            <span className="app-header__label app-header__label--buy">Buy</span>
            <span className="app-header__value app-header__value--buy">
              {formatMoney(yearlyBuy)}
            </span>
          </div>

          <div className="app-header__stat-row" title="Yearly Expense">
            <span className="app-header__label">Expense</span>
            <span className="app-header__value">
              {formatMoney(yearlyExpense)}
            </span>
          </div>

          <div className="app-header__stat-row app-header__stat-row--profit" title="Yearly Profit">
            <span className="app-header__label app-header__label--profit">Profit</span>
            <span className={`app-header__value app-header__value--profit ${yearlyProfitClass}`}>
              {yearlyProfitSign}{formatMoney(yearlyProfit)}
            </span>
          </div>
        </div>

      </div>
    </header>
  )
}
