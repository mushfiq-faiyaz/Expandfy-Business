import { useMemo, useState } from 'react'
import { History, TrendingUp, TriangleAlert } from 'lucide-react'
import {
  formatDateTime,
  formatDisplayDate,
  formatMonthDay,
  getBackdatedClass,
  getEntryTargetDate,
  isWithin24Hours,
  toISODate,
  splitFormattedDateTime,
  extractDateOnly,
} from '../dateUtils'
import { getNetworkTodayIso } from '../networkTime'
import type { ActivityLogItem, BuyEntry, CustomCategory, Expense, IncomeEntry } from '../types'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  customCategoryToCategory,
} from '../categories'
import { ActivitySheet } from './ActivitySheet'
import { EditHistoryModal } from './EditHistoryModal'

export interface ManageCategorySnapshot {
  customCategories: CustomCategory[]
  categoryOrder: string[]
  hiddenPresets: string[]
}

type Props = {
  open: boolean
  dateIso: string
  currency: string
  currencyOptions: readonly string[]
  salesForDate?: IncomeEntry[]
  expensesForDate: Expense[]
  buysForDate: BuyEntry[]
  incomeForMonth?: IncomeEntry[]
  activityLog?: ActivityLogItem[]
  customExpenseCategories?: CustomCategory[]
  customIncomeCategories?: CustomCategory[]
  expenseCategoryOrder?: string[]
  incomeCategoryOrder?: string[]
  expenseHiddenPresets?: string[]
  incomeHiddenPresets?: string[]
  formatMoney: (n: number) => string
  timeFormat: '12h' | '24h'
  onClose: () => void
  onAddSale?: (description: string, amount: number) => void
  onUpdateSale?: (id: string, description: string, amount: number) => void
  onDeleteSale?: (id: string) => void
  onAddExpense: (description: string, amount: number) => void
  onUpdateExpense: (id: string, description: string, amount: number) => void
  onDeleteExpense: (id: string) => void
  onAddBuy: (description: string, amount: number) => void
  onUpdateBuy: (id: string, description: string, amount: number) => void
  onDeleteBuy: (id: string) => void
  onAddIncome?: (description: string, amount: number) => void
  onUpdateIncome?: (id: string, description: string, amount: number) => void
  onDeleteIncome?: (id: string) => void
  onCurrencyChange?: (currency: string) => void
  onAddCustomCategory?: (side: 'expense' | 'income', cat: CustomCategory) => void
  onUpdateCustomCategory?: (side: 'expense' | 'income', cat: CustomCategory) => void
  onDeleteCustomCategory?: (side: 'expense' | 'income', id: string) => void
  onSaveCategoryOrder?: (side: 'expense' | 'income', order: string[]) => void
  onToggleHidePreset?: (side: 'expense' | 'income', presetId: string) => void
  onRestoreCategoryState?: (
    side: 'expense' | 'income',
    state: ManageCategorySnapshot,
  ) => void
}

export function QuickEntryModal({
  open,
  dateIso,
  currency: _currency,
  currencyOptions: _currencyOptions,
  salesForDate: salesForDateProp,
  expensesForDate,
  buysForDate,
  incomeForMonth,
  activityLog = [],
  customExpenseCategories = [],
  customIncomeCategories = [],
  expenseCategoryOrder: _expenseCategoryOrder = [],
  incomeCategoryOrder: _incomeCategoryOrder = [],
  expenseHiddenPresets: _expenseHiddenPresets = [],
  incomeHiddenPresets: _incomeHiddenPresets = [],
  formatMoney,
  timeFormat,
  onClose,
  onAddSale,
  onUpdateSale,
  onDeleteSale,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onAddBuy,
  onUpdateBuy,
  onDeleteBuy,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
  onCurrencyChange: _onCurrencyChange,
  onAddCustomCategory: _onAddCustomCategory,
  onUpdateCustomCategory: _onUpdateCustomCategory,
  onDeleteCustomCategory: _onDeleteCustomCategory,
  onSaveCategoryOrder: _onSaveCategoryOrder,
  onToggleHidePreset: _onToggleHidePreset,
  onRestoreCategoryState: _onRestoreCategoryState,
}: Props) {
  const [salesDesc, setSalesDesc] = useState('')
  const [salesAmount, setSalesAmount] = useState('')
  const [salesAmountError, setSalesAmountError] = useState(false)
  const [editingSalesId, setEditingSalesId] = useState<string | null>(null)

  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseAmountError, setExpenseAmountError] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  const [buyDesc, setBuyDesc] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [buyAmountError, setBuyAmountError] = useState(false)
  const [editingBuyId, setEditingBuyId] = useState<string | null>(null)

  const [openPanel, setOpenPanel] = useState<'sales' | 'expense' | 'buy' | 'currency' | null>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editAmountError, setEditAmountError] = useState(false)
  const [expiredWarning, setExpiredWarning] = useState<{
    id: string
    action: 'edit' | 'delete'
  } | null>(null)
  const [activitySheetOpen, setActivitySheetOpen] = useState(false)
  const [viewingHistory, setViewingHistory] = useState<{
    entry: Expense | IncomeEntry
    side: 'expense' | 'income' | 'buy'
  } | null>(null)

  // Merged categories (for ActivitySheet and EditHistoryModal display)
  const mergedExpenseCategories = useMemo(
    () => [
      ...EXPENSE_CATEGORIES,
      ...customExpenseCategories.map(customCategoryToCategory),
    ],
    [customExpenseCategories],
  )

  const mergedIncomeCategories = useMemo(
    () => [
      ...INCOME_CATEGORIES,
      ...customIncomeCategories.map(customCategoryToCategory),
    ],
    [customIncomeCategories],
  )

  // Derive sales for the selected date from props
  const salesForDate = useMemo(() => {
    if (salesForDateProp) return salesForDateProp
    if (incomeForMonth) {
      return incomeForMonth.filter((e) => {
        const incDate =
          (e as unknown as { targetDate?: string; date?: string }).targetDate ||
          (e as unknown as { targetDate?: string; date?: string }).date ||
          (e.createdAt ? toISODate(new Date(e.createdAt)) : '')
        return incDate === dateIso
      })
    }
    return []
  }, [salesForDateProp, incomeForMonth, dateIso])

  const selectedDateActivityLog = useMemo(() => {
    return activityLog.filter((item) => {
      const itemActionDate = toISODate(new Date(item.timestamp))
      const entryExpenseDate = item.entrySnapshotBefore?.date || item.entrySnapshotAfter?.date
      const entryCreatedDate = item.entrySnapshotBefore?.createdAt
        ? toISODate(new Date(item.entrySnapshotBefore.createdAt))
        : null
      return (
        itemActionDate === dateIso ||
        entryExpenseDate === dateIso ||
        entryCreatedDate === dateIso
      )
    })
  }, [activityLog, dateIso])

  const activitySheetTitle = useMemo(() => {
    const todayStr = getNetworkTodayIso()
    if (dateIso === todayStr) {
      return "Today's Activity"
    }
    return `${formatDisplayDate(dateIso)} Activity`
  }, [dateIso])

  if (!open) return null

  function addSales(): void {
    const n = parseFloat(salesAmount.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) {
      setSalesAmountError(true)
      return
    }
    const addFn = onAddSale ?? onAddIncome
    addFn?.(salesDesc.trim(), n)
    setSalesDesc('')
    setSalesAmount('')
    setSalesAmountError(false)
  }

  function addExpense(): void {
    const n = parseFloat(expenseAmount.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) {
      setExpenseAmountError(true)
      return
    }
    onAddExpense(expenseDesc.trim(), n)
    setExpenseDesc('')
    setExpenseAmount('')
    setExpenseAmountError(false)
  }

  function addBuy(): void {
    const n = parseFloat(buyAmount.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) {
      setBuyAmountError(true)
      return
    }
    onAddBuy(buyDesc.trim(), n)
    setBuyDesc('')
    setBuyAmount('')
    setBuyAmountError(false)
  }

  function togglePanel(panel: 'sales' | 'expense' | 'buy' | 'currency'): void {
    setOpenPanel((prev) => (prev === panel ? null : panel))
  }

  function startEditSales(item: IncomeEntry): void {
    if (!isWithin24Hours(item.createdAt)) {
      setExpiredWarning({ id: item.id, action: 'edit' })
      return
    }
    setExpiredWarning(null)
    setEditingSalesId(item.id)
    setEditingExpenseId(null)
    setEditingBuyId(null)
    setEditDesc(item.description)
    setEditAmount(String(item.amount))
    setEditAmountError(false)
  }

  function handleDeleteSales(item: IncomeEntry): void {
    if (!isWithin24Hours(item.createdAt)) {
      setExpiredWarning({ id: item.id, action: 'delete' })
      return
    }
    setExpiredWarning(null)
    const delFn = onDeleteSale ?? onDeleteIncome
    delFn?.(item.id)
  }

  function saveSalesEdit(): void {
    if (!editingSalesId) return
    const n = parseFloat(editAmount.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) {
      setEditAmountError(true)
      return
    }
    const updateFn = onUpdateSale ?? onUpdateIncome
    updateFn?.(editingSalesId, editDesc.trim(), n)
    setEditingSalesId(null)
    setEditDesc('')
    setEditAmount('')
    setEditAmountError(false)
  }

  function startEditExpense(item: Expense): void {
    if (!isWithin24Hours(item.createdAt)) {
      setExpiredWarning({ id: item.id, action: 'edit' })
      return
    }
    setExpiredWarning(null)
    setEditingExpenseId(item.id)
    setEditingSalesId(null)
    setEditingBuyId(null)
    setEditDesc(item.description)
    setEditAmount(String(item.amount))
    setEditAmountError(false)
  }

  function handleDeleteExpense(item: Expense): void {
    if (!isWithin24Hours(item.createdAt)) {
      setExpiredWarning({ id: item.id, action: 'delete' })
      return
    }
    setExpiredWarning(null)
    onDeleteExpense(item.id)
  }

  function saveExpenseEdit(): void {
    if (!editingExpenseId) return
    const n = parseFloat(editAmount.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) {
      setEditAmountError(true)
      return
    }
    onUpdateExpense(editingExpenseId, editDesc.trim(), n)
    setEditingExpenseId(null)
    setEditDesc('')
    setEditAmount('')
    setEditAmountError(false)
  }

  function startEditBuy(item: BuyEntry): void {
    if (!isWithin24Hours(item.createdAt)) {
      setExpiredWarning({ id: item.id, action: 'edit' })
      return
    }
    setExpiredWarning(null)
    setEditingBuyId(item.id)
    setEditingSalesId(null)
    setEditingExpenseId(null)
    setEditDesc(item.description)
    setEditAmount(String(item.amount))
    setEditAmountError(false)
  }

  function handleDeleteBuy(item: BuyEntry): void {
    if (!isWithin24Hours(item.createdAt)) {
      setExpiredWarning({ id: item.id, action: 'delete' })
      return
    }
    setExpiredWarning(null)
    onDeleteBuy(item.id)
  }

  function saveBuyEdit(): void {
    if (!editingBuyId) return
    const n = parseFloat(editAmount.replace(',', '.'))
    if (Number.isNaN(n) || n <= 0) {
      setEditAmountError(true)
      return
    }
    onUpdateBuy(editingBuyId, editDesc.trim(), n)
    setEditingBuyId(null)
    setEditDesc('')
    setEditAmount('')
    setEditAmountError(false)
  }

  function cancelEdit(): void {
    setEditingSalesId(null)
    setEditingExpenseId(null)
    setEditingBuyId(null)
    setEditDesc('')
    setEditAmount('')
    setEditAmountError(false)
  }

  // Live value previews for selected date (always numeric, never dash)
  const salesDayTotal = salesForDate.reduce((s, e) => s + e.amount, 0)
  const expenseDayTotal = expensesForDate.reduce((s, e) => s + e.amount, 0)
  const buyDayTotal = buysForDate.reduce((s, e) => s + e.amount, 0)

  // Future dates are read-only
  const todayIso = getNetworkTodayIso()
  const isFutureDate = dateIso > todayIso

  return (
    <>
      <button type="button" className="quick-modal__backdrop" onClick={onClose} aria-label="Close quick entry" />
      <div className="quick-modal" role="dialog" aria-modal aria-labelledby="quick-entry-title">
        <div className="quick-modal__head">
          <h2 id="quick-entry-title" className="quick-modal__title">
            Quick entry
          </h2>
          <div className="quick-modal__head-actions">
            <button
              type="button"
              className="quick-modal__icon-btn"
              onClick={() => setActivitySheetOpen(true)}
              aria-label="View activity log"
              title="Activity"
            >
              <History size={16} strokeWidth={2.2} />
            </button>
            <button type="button" className="quick-modal__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </div>
        <p className="quick-modal__date">{formatDisplayDate(dateIso)}</p>

        {/* ── 1. Sales section ── */}
        <section className="quick-modal__section">
          <button
            type="button"
            className={`quick-modal__trigger quick-modal__trigger--row ${openPanel === 'sales' ? 'quick-modal__trigger--open' : ''}`}
            onClick={() => togglePanel('sales')}
          >
            {/* Icon badge — sales mint green tint with TrendingUp icon */}
            <span className="qm-row__badge qm-row__badge--sales" aria-hidden>
              <TrendingUp size={18} strokeWidth={2} />
            </span>
            {/* Label + sub-label */}
            <span className="qm-row__body">
              <span className="qm-row__label">Sales</span>
              <span className="qm-row__sub">Selected date</span>
            </span>
            {/* Live value + chevron */}
            <span className="qm-row__right">
              <span className="qm-row__value qm-row__value--sales">
                {formatMoney(salesDayTotal)}
              </span>
              <span className={`quick-modal__chev ${openPanel === 'sales' ? 'quick-modal__chev--open' : ''}`}>›</span>
            </span>
          </button>
          <div className="quick-modal__collapse" data-open={openPanel === 'sales'}>
            <div className="quick-modal__collapse-inner">
              <div className="quick-modal__panel">
                {isFutureDate ? (
                  <p className="quick-modal__readonly-hint">
                    Future dates are read-only for sales entries.
                  </p>
                ) : (
                  <>
                    <div className="desc-field">
                      <input
                        className="desc-field__input"
                        placeholder="Description (optional)"
                        value={salesDesc}
                        onChange={(e) => setSalesDesc(e.target.value)}
                      />
                    </div>

                    <div className="quick-modal__amount-field">
                      <div className="quick-modal__row">
                        <input
                          className={`sheet__input${salesAmountError ? ' sheet__input--error' : ''}`}
                          inputMode="decimal"
                          placeholder="Amount"
                          value={salesAmount}
                          onChange={(e) => {
                            const val = e.target.value
                            setSalesAmount(val)
                            if (salesAmountError) {
                              const n = parseFloat(val.replace(',', '.'))
                              if (!Number.isNaN(n) && n > 0) {
                                setSalesAmountError(false)
                              }
                            }
                          }}
                        />
                        <button type="button" className="btn btn--primary" onClick={addSales}>
                          Add
                        </button>
                      </div>
                      {salesAmountError && (
                        <div className="qm-amount-error" role="alert">
                          Amount is required
                        </div>
                      )}
                    </div>
                  </>
                )}
                <ul className="quick-modal__list">
                  {salesForDate.length === 0 ? (
                    <li className="quick-modal__empty">No sales entries on this date</li>
                  ) : (
                    salesForDate
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((e) => (
                        <li
                          key={e.id}
                          className={`quick-modal__item quick-modal__item--col ${getBackdatedClass(e, dateIso)}`.trim()}
                        >
                          {editingSalesId === e.id ? (
                            <div className="qm-edit__container">
                              <input
                                className="sheet__input"
                                value={editDesc}
                                onChange={(ev) => setEditDesc(ev.target.value)}
                                placeholder="Description (optional)"
                              />
                              <div className="quick-modal__amount-field">
                                <div className="quick-modal__row">
                                  <input
                                    className={`sheet__input${editAmountError ? ' sheet__input--error' : ''}`}
                                    value={editAmount}
                                    onChange={(ev) => {
                                      const val = ev.target.value
                                      setEditAmount(val)
                                      if (editAmountError) {
                                        const n = parseFloat(val.replace(',', '.'))
                                        if (!Number.isNaN(n) && n > 0) {
                                          setEditAmountError(false)
                                        }
                                      }
                                    }}
                                    inputMode="decimal"
                                    placeholder="Amount"
                                  />
                                  <button type="button" className="btn btn--primary" onClick={saveSalesEdit}>
                                    Save
                                  </button>
                                  <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </div>
                                {editAmountError && (
                                  <div className="qm-amount-error" role="alert">
                                    Amount is required
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="quick-modal__item-top">
                                <span className="qm-item__desc">
                                  {e.description || <span style={{ color: '#64748b' }}>—</span>}
                                </span>
                                <div className="entry-amount-col qm-item__amount-col">
                                  <span className="qm-item__amount">{formatMoney(e.amount)}</span>
                                  {getEntryTargetDate(e, dateIso) && (
                                    <span className="entry-for-date qm-item__for-date">
                                      for{' '}
                                      <span
                                        className="entry-for-date__pill qm-item__for-date-pill"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          padding: '1.5px 6px',
                                          borderRadius: '9999px',
                                          background: 'rgba(59, 130, 246, 0.18)',
                                          border: '1px solid rgba(59, 130, 246, 0.35)',
                                          color: '#60a5fa',
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                          letterSpacing: '0.01em',
                                          lineHeight: '1.2',
                                        }}
                                      >
                                        {formatMonthDay(getEntryTargetDate(e, dateIso)!)}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="quick-modal__item-meta">
                                <div className="qm-item__meta-time">
                                  <span style={{ fontWeight: 600 }}>
                                    {(() => {
                                      const rawTs = formatDateTime(e.updatedAt || e.createdAt, timeFormat)
                                      const parts = splitFormattedDateTime(rawTs)
                                      if (!parts) return <>On {rawTs}</>
                                      const targetDate = getEntryTargetDate(e, dateIso)
                                      const creationDateStr = extractDateOnly(e.createdAt)
                                      const targetDateStr = targetDate ? extractDateOnly(targetDate) : null
                                      const sameDate = targetDateStr ? creationDateStr === targetDateStr : true
                                      const pillBg = sameDate
                                        ? 'rgba(34, 197, 94, 0.18)'
                                        : 'rgba(239, 68, 68, 0.18)'
                                      const pillBorder = sameDate
                                        ? '1px solid rgba(34, 197, 94, 0.45)'
                                        : '1px solid rgba(239, 68, 68, 0.45)'
                                      const pillColor = sameDate ? '#4ade80' : '#f87171'
                                      return (
                                        <>
                                          {'On '}
                                          {parts.dayPrefix}
                                          {', '}
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              padding: '1px 5px',
                                              borderRadius: '9999px',
                                              background: pillBg,
                                              border: pillBorder,
                                              color: pillColor,
                                              fontSize: '0.68rem',
                                              fontWeight: 600,
                                              letterSpacing: '0.01em',
                                              lineHeight: '1.2',
                                            }}
                                          >
                                            {parts.monthDay}
                                          </span>
                                          {', '}
                                          {parts.rest}
                                        </>
                                      )
                                    })()}
                                  </span>
                                  {e.editHistory && e.editHistory.length > 0 ? (
                                    <button
                                      type="button"
                                      className="qm-item__edited-tag"
                                      onClick={() => setViewingHistory({ entry: e, side: 'income' })}
                                      title="View edit history"
                                      aria-label="View edit history"
                                    >
                                      (edited)
                                    </button>
                                  ) : null}
                                </div>
                                <div className="quick-modal__item-actions">
                                  <button type="button" className="btn btn--ghost" onClick={() => startEditSales(e)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn btn--danger" onClick={() => handleDeleteSales(e)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {expiredWarning?.id === e.id && (
                                <div className="qm-item__expired-warning" role="alert">
                                  <TriangleAlert size={13} strokeWidth={2.4} />
                                  <span>
                                    {expiredWarning.action === 'delete'
                                      ? 'Deletion window expired — entries can only be deleted within 24 hours.'
                                      : 'Editing window expired — entries can only be edited within 24 hours.'}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Expense section ── */}
        <section className="quick-modal__section">
          <button
            type="button"
            className={`quick-modal__trigger quick-modal__trigger--row ${openPanel === 'expense' ? 'quick-modal__trigger--open' : ''}`}
            onClick={() => togglePanel('expense')}
          >
            {/* Icon badge — red/orange tint */}
            <span className="qm-row__badge qm-row__badge--expense" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            </span>
            {/* Label + sub-label */}
            <span className="qm-row__body">
              <span className="qm-row__label">Expense</span>
              <span className="qm-row__sub">Selected date</span>
            </span>
            {/* Live value + chevron */}
            <span className="qm-row__right">
              <span className="qm-row__value qm-row__value--expense">
                {formatMoney(expenseDayTotal)}
              </span>
              <span className={`quick-modal__chev ${openPanel === 'expense' ? 'quick-modal__chev--open' : ''}`}>›</span>
            </span>
          </button>
          <div className="quick-modal__collapse" data-open={openPanel === 'expense'}>
            <div className="quick-modal__collapse-inner">
              <div className="quick-modal__panel">
                {isFutureDate ? (
                  <p className="quick-modal__readonly-hint">
                    Future dates are read-only for expenses.
                  </p>
                ) : (
                  <>
                    <div className="desc-field">
                      <input
                        className="desc-field__input"
                        placeholder="Description (optional)"
                        value={expenseDesc}
                        onChange={(e) => setExpenseDesc(e.target.value)}
                      />
                    </div>

                    <div className="quick-modal__amount-field">
                      <div className="quick-modal__row">
                        <input
                          className={`sheet__input${expenseAmountError ? ' sheet__input--error' : ''}`}
                          inputMode="decimal"
                          placeholder="Amount"
                          value={expenseAmount}
                          onChange={(e) => {
                            const val = e.target.value
                            setExpenseAmount(val)
                            if (expenseAmountError) {
                              const n = parseFloat(val.replace(',', '.'))
                              if (!Number.isNaN(n) && n > 0) {
                                setExpenseAmountError(false)
                              }
                            }
                          }}
                        />
                        <button type="button" className="btn btn--primary" onClick={addExpense}>
                          Add
                        </button>
                      </div>
                      {expenseAmountError && (
                        <div className="qm-amount-error" role="alert">
                          Amount is required
                        </div>
                      )}
                    </div>
                  </>
                )}
                <ul className="quick-modal__list">
                  {expensesForDate.length === 0 ? (
                    <li className="quick-modal__empty">No expense entries on this date</li>
                  ) : (
                    expensesForDate
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((e) => (
                        <li
                          key={e.id}
                          className={`quick-modal__item quick-modal__item--col ${getBackdatedClass(e, dateIso)}`.trim()}
                        >
                          {editingExpenseId === e.id ? (
                            <div className="qm-edit__container">
                              <input
                                className="sheet__input"
                                value={editDesc}
                                onChange={(ev) => setEditDesc(ev.target.value)}
                                placeholder="Description (optional)"
                              />
                              <div className="quick-modal__amount-field">
                                <div className="quick-modal__row">
                                  <input
                                    className={`sheet__input${editAmountError ? ' sheet__input--error' : ''}`}
                                    value={editAmount}
                                    onChange={(ev) => {
                                      const val = ev.target.value
                                      setEditAmount(val)
                                      if (editAmountError) {
                                        const n = parseFloat(val.replace(',', '.'))
                                        if (!Number.isNaN(n) && n > 0) {
                                          setEditAmountError(false)
                                        }
                                      }
                                    }}
                                    inputMode="decimal"
                                    placeholder="Amount"
                                  />
                                  <button type="button" className="btn btn--primary" onClick={saveExpenseEdit}>
                                    Save
                                  </button>
                                  <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </div>
                                {editAmountError && (
                                  <div className="qm-amount-error" role="alert">
                                    Amount is required
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="quick-modal__item-top">
                                <span className="qm-item__desc">
                                  {e.description || <span style={{ color: '#64748b' }}>—</span>}
                                </span>
                                <div className="entry-amount-col qm-item__amount-col">
                                  <span className="qm-item__amount">{formatMoney(e.amount)}</span>
                                  {getEntryTargetDate(e, dateIso) && (
                                    <span className="entry-for-date qm-item__for-date">
                                      for{' '}
                                      <span
                                        className="entry-for-date__pill qm-item__for-date-pill"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          padding: '1.5px 6px',
                                          borderRadius: '9999px',
                                          background: 'rgba(59, 130, 246, 0.18)',
                                          border: '1px solid rgba(59, 130, 246, 0.35)',
                                          color: '#60a5fa',
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                          letterSpacing: '0.01em',
                                          lineHeight: '1.2',
                                        }}
                                      >
                                        {formatMonthDay(getEntryTargetDate(e, dateIso)!)}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="quick-modal__item-meta">
                                <div className="qm-item__meta-time">
                                  <span style={{ fontWeight: 600 }}>
                                    {(() => {
                                      const rawTs = formatDateTime(e.updatedAt || e.createdAt, timeFormat)
                                      const parts = splitFormattedDateTime(rawTs)
                                      if (!parts) return <>On {rawTs}</>
                                      const targetDate = getEntryTargetDate(e, dateIso)
                                      const creationDateStr = extractDateOnly(e.createdAt)
                                      const targetDateStr = targetDate ? extractDateOnly(targetDate) : null
                                      const sameDate = targetDateStr ? creationDateStr === targetDateStr : true
                                      const pillBg = sameDate
                                        ? 'rgba(34, 197, 94, 0.18)'
                                        : 'rgba(239, 68, 68, 0.18)'
                                      const pillBorder = sameDate
                                        ? '1px solid rgba(34, 197, 94, 0.45)'
                                        : '1px solid rgba(239, 68, 68, 0.45)'
                                      const pillColor = sameDate ? '#4ade80' : '#f87171'
                                      return (
                                        <>
                                          {'On '}
                                          {parts.dayPrefix}
                                          {', '}
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              padding: '1px 5px',
                                              borderRadius: '9999px',
                                              background: pillBg,
                                              border: pillBorder,
                                              color: pillColor,
                                              fontSize: '0.68rem',
                                              fontWeight: 600,
                                              letterSpacing: '0.01em',
                                              lineHeight: '1.2',
                                            }}
                                          >
                                            {parts.monthDay}
                                          </span>
                                          {', '}
                                          {parts.rest}
                                        </>
                                      )
                                    })()}
                                  </span>
                                  {e.editHistory && e.editHistory.length > 0 ? (
                                    <button
                                      type="button"
                                      className="qm-item__edited-tag"
                                      onClick={() => setViewingHistory({ entry: e, side: 'expense' })}
                                      title="View edit history"
                                      aria-label="View edit history"
                                    >
                                      (edited)
                                    </button>
                                  ) : null}
                                </div>
                                <div className="quick-modal__item-actions">
                                  <button type="button" className="btn btn--ghost" onClick={() => startEditExpense(e)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn btn--danger" onClick={() => handleDeleteExpense(e)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {expiredWarning?.id === e.id && (
                                <div className="qm-item__expired-warning" role="alert">
                                  <TriangleAlert size={13} strokeWidth={2.4} />
                                  <span>
                                    {expiredWarning.action === 'delete'
                                      ? 'Deletion window expired — entries can only be deleted within 24 hours.'
                                      : 'Editing window expired — entries can only be edited within 24 hours.'}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. Buy section ── */}
        <section className="quick-modal__section">
          <button
            type="button"
            className={`quick-modal__trigger quick-modal__trigger--row ${openPanel === 'buy' ? 'quick-modal__trigger--open' : ''}`}
            onClick={() => togglePanel('buy')}
          >
            {/* Icon badge — amber tint */}
            <span className="qm-row__badge qm-row__badge--buy" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </span>
            {/* Label + sub-label */}
            <span className="qm-row__body">
              <span className="qm-row__label">Buy</span>
              <span className="qm-row__sub">Selected date</span>
            </span>
            {/* Live value + chevron */}
            <span className="qm-row__right">
              <span className="qm-row__value qm-row__value--buy">
                {formatMoney(buyDayTotal)}
              </span>
              <span className={`quick-modal__chev ${openPanel === 'buy' ? 'quick-modal__chev--open' : ''}`}>›</span>
            </span>
          </button>
          <div className="quick-modal__collapse" data-open={openPanel === 'buy'}>
            <div className="quick-modal__collapse-inner">
              <div className="quick-modal__panel">
                {isFutureDate ? (
                  <p className="quick-modal__readonly-hint">
                    Future dates are read-only for buy entries.
                  </p>
                ) : (
                  <>
                    <div className="desc-field">
                      <input
                        className="desc-field__input"
                        placeholder="Description (optional)"
                        value={buyDesc}
                        onChange={(e) => setBuyDesc(e.target.value)}
                      />
                    </div>

                    <div className="quick-modal__amount-field">
                      <div className="quick-modal__row">
                        <input
                          className={`sheet__input${buyAmountError ? ' sheet__input--error' : ''}`}
                          inputMode="decimal"
                          placeholder="Amount"
                          value={buyAmount}
                          onChange={(e) => {
                            const val = e.target.value
                            setBuyAmount(val)
                            if (buyAmountError) {
                              const n = parseFloat(val.replace(',', '.'))
                              if (!Number.isNaN(n) && n > 0) {
                                setBuyAmountError(false)
                              }
                            }
                          }}
                        />
                        <button type="button" className="btn btn--primary" onClick={addBuy}>
                          Add
                        </button>
                      </div>
                      {buyAmountError && (
                        <div className="qm-amount-error" role="alert">
                          Amount is required
                        </div>
                      )}
                    </div>
                  </>
                )}
                <ul className="quick-modal__list">
                  {buysForDate.length === 0 ? (
                    <li className="quick-modal__empty">No buy entries on this date</li>
                  ) : (
                    buysForDate
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((e) => (
                        <li
                          key={e.id}
                          className={`quick-modal__item quick-modal__item--col ${getBackdatedClass(e, dateIso)}`.trim()}
                        >
                          {editingBuyId === e.id ? (
                            <div className="qm-edit__container">
                              <input
                                className="sheet__input"
                                value={editDesc}
                                onChange={(ev) => setEditDesc(ev.target.value)}
                                placeholder="Description (optional)"
                              />
                              <div className="quick-modal__amount-field">
                                <div className="quick-modal__row">
                                  <input
                                    className={`sheet__input${editAmountError ? ' sheet__input--error' : ''}`}
                                    value={editAmount}
                                    onChange={(ev) => {
                                      const val = ev.target.value
                                      setEditAmount(val)
                                      if (editAmountError) {
                                        const n = parseFloat(val.replace(',', '.'))
                                        if (!Number.isNaN(n) && n > 0) {
                                          setEditAmountError(false)
                                        }
                                      }
                                    }}
                                    inputMode="decimal"
                                    placeholder="Amount"
                                  />
                                  <button type="button" className="btn btn--primary" onClick={saveBuyEdit}>
                                    Save
                                  </button>
                                  <button type="button" className="btn btn--ghost" onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </div>
                                {editAmountError && (
                                  <div className="qm-amount-error" role="alert">
                                    Amount is required
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="quick-modal__item-top">
                                <span className="qm-item__desc">
                                  {e.description || <span style={{ color: '#64748b' }}>—</span>}
                                </span>
                                <div className="entry-amount-col qm-item__amount-col">
                                  <span className="qm-item__amount">{formatMoney(e.amount)}</span>
                                  {getEntryTargetDate(e, dateIso) && (
                                    <span className="entry-for-date qm-item__for-date">
                                      for{' '}
                                      <span
                                        className="entry-for-date__pill qm-item__for-date-pill"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          padding: '1.5px 6px',
                                          borderRadius: '9999px',
                                          background: 'rgba(59, 130, 246, 0.18)',
                                          border: '1px solid rgba(59, 130, 246, 0.35)',
                                          color: '#60a5fa',
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                          letterSpacing: '0.01em',
                                          lineHeight: '1.2',
                                        }}
                                      >
                                        {formatMonthDay(getEntryTargetDate(e, dateIso)!)}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="quick-modal__item-meta">
                                <div className="qm-item__meta-time">
                                  <span style={{ fontWeight: 600 }}>
                                    {(() => {
                                      const rawTs = formatDateTime(e.updatedAt || e.createdAt, timeFormat)
                                      const parts = splitFormattedDateTime(rawTs)
                                      if (!parts) return <>On {rawTs}</>
                                      const targetDate = getEntryTargetDate(e, dateIso)
                                      const creationDateStr = extractDateOnly(e.createdAt)
                                      const targetDateStr = targetDate ? extractDateOnly(targetDate) : null
                                      const sameDate = targetDateStr ? creationDateStr === targetDateStr : true
                                      const pillBg = sameDate
                                        ? 'rgba(34, 197, 94, 0.18)'
                                        : 'rgba(239, 68, 68, 0.18)'
                                      const pillBorder = sameDate
                                        ? '1px solid rgba(34, 197, 94, 0.45)'
                                        : '1px solid rgba(239, 68, 68, 0.45)'
                                      const pillColor = sameDate ? '#4ade80' : '#f87171'
                                      return (
                                        <>
                                          {'On '}
                                          {parts.dayPrefix}
                                          {', '}
                                          <span
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              padding: '1px 5px',
                                              borderRadius: '9999px',
                                              background: pillBg,
                                              border: pillBorder,
                                              color: pillColor,
                                              fontSize: '0.68rem',
                                              fontWeight: 600,
                                              letterSpacing: '0.01em',
                                              lineHeight: '1.2',
                                            }}
                                          >
                                            {parts.monthDay}
                                          </span>
                                          {', '}
                                          {parts.rest}
                                        </>
                                      )
                                    })()}
                                  </span>
                                  {e.editHistory && e.editHistory.length > 0 ? (
                                    <button
                                      type="button"
                                      className="qm-item__edited-tag"
                                      onClick={() => setViewingHistory({ entry: e, side: 'buy' })}
                                      title="View edit history"
                                      aria-label="View edit history"
                                    >
                                      (edited)
                                    </button>
                                  ) : null}
                                </div>
                                <div className="quick-modal__item-actions">
                                  <button type="button" className="btn btn--ghost" onClick={() => startEditBuy(e)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn btn--danger" onClick={() => handleDeleteBuy(e)}>
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {expiredWarning?.id === e.id && (
                                <div className="qm-item__expired-warning" role="alert">
                                  <TriangleAlert size={13} strokeWidth={2.4} />
                                  <span>
                                    {expiredWarning.action === 'delete'
                                      ? 'Deletion window expired — entries can only be deleted within 24 hours.'
                                      : 'Editing window expired — entries can only be edited within 24 hours.'}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Edit History Modal Popover ── */}
      {viewingHistory && (
        <EditHistoryModal
          entry={viewingHistory.entry}
          side={viewingHistory.side}
          categories={
            viewingHistory.side === 'expense'
              ? mergedExpenseCategories
              : mergedIncomeCategories
          }
          formatMoney={formatMoney}
          timeFormat={timeFormat}
          onClose={() => setViewingHistory(null)}
        />
      )}

      {/* ── Activity Sheet (Selected Date Activity) ── */}
      <ActivitySheet
        open={activitySheetOpen}
        title={activitySheetTitle}
        activityLog={selectedDateActivityLog}
        expenseCategories={mergedExpenseCategories}
        incomeCategories={mergedIncomeCategories}
        formatMoney={formatMoney}
        timeFormat={timeFormat}
        onClose={() => setActivitySheetOpen(false)}
        onOpenEditHistory={(entry, side) => {
          setViewingHistory({ entry, side })
        }}
      />
    </>
  )
}
