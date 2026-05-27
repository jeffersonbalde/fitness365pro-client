import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import './AdminCmsTabs.css'

const TABS = [
  { to: '/admin/cms/posts', label: 'Posts' },
  { to: '/admin/cms/events', label: 'Events' },
  { to: '/admin/cms/event-progress', label: 'Progress review' },
  { to: '/admin/cms/event-participants', label: 'Participants' },
  { to: '/admin/cms/members', label: 'Members' },
]

const AdminCmsTabs = ({ className = '' }) => {
  const location = useLocation()

  return (
    <nav className={`admin-cms-tabs card border-0 shadow-sm mb-3 ${className}`.trim()} aria-label="CMS sections">
      <div className="card-body py-2 px-2 px-sm-3">
        <div className="admin-cms-tabs__row" role="tablist">
          {TABS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `admin-cms-tabs__link${isActive ? ' is-active' : ''}`}
              role="tab"
              aria-current={location.pathname === to ? 'page' : undefined}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default AdminCmsTabs
