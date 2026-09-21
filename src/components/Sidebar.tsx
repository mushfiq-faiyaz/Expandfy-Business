import { Calendar as CalendarIcon } from 'lucide-react'
import { ExpendfyLogo } from './ExpendfyLogo'
import { BrandWordmark } from './BrandWordmark'

export function Sidebar() {
  return (
    <aside className="app-sidebar" aria-label="Main Navigation">
      <div className="app-sidebar__header">
        <div className="app-sidebar__brand">
          <ExpendfyLogo size={36} />
          <BrandWordmark size="md" layout="stacked" />
        </div>
      </div>

      <nav className="app-sidebar__nav">
        <button
          type="button"
          className="app-sidebar__nav-item app-sidebar__nav-item--active"
          aria-current="page"
          tabIndex={0}
        >
          <CalendarIcon size={18} strokeWidth={2.2} className="app-sidebar__nav-icon" />
          <span className="app-sidebar__nav-label">Calendar</span>
        </button>
      </nav>
    </aside>
  )
}
