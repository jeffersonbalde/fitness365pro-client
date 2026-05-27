import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const SidebarIcon = ({ name }) => {
  const commonProps = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const icons = {
    updates: (
      <svg {...commonProps}><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
    ),
    report: (
      <svg {...commonProps}><path d="M3 3v18h18" /><path d="m8 14 3-3 2 2 4-5" /></svg>
    ),
    progress: (
      <svg {...commonProps}>
        <path d="M4 19V5M4 19h16M9 17V9l4 3 5-7v10" />
      </svg>
    ),
    members: (
      <svg {...commonProps}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    ),
    users: (
      <svg {...commonProps}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm12 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  }

  return icons[name] || icons.updates
}

const Sidebar = ({ user, onCloseSidebar }) => {
  const location = useLocation()

  const isActiveLink = (href) => {
    const normalize = (path) => (path || '').replace(/\/+$/, '') || '/'
    return normalize(location.pathname) === normalize(href)
  }

  const closeSidebarOnMobile = () => {
    if (window.innerWidth < 1200 && onCloseSidebar) onCloseSidebar()
  }

  const menuSections = [
    {
      heading: 'CONTENT',
      items: [
        { icon: 'updates', label: 'CMS (Home feed)', href: '/admin/cms/posts', enabled: true },
        { icon: 'report', label: 'Events CMS', href: '/admin/cms/events', enabled: true },
        { icon: 'progress', label: 'Progress review', href: '/admin/cms/event-progress', enabled: true },
        { icon: 'users', label: 'Participants', href: '/admin/cms/event-participants', enabled: true },
        { icon: 'members', label: 'Member directory', href: '/admin/cms/members', enabled: true },
      ],
    },
  ]

  return (
    <nav className="sb-sidenav accordion sb-sidenav-dark" id="sidenavAccordion">
      <div className="sb-sidenav-menu">
        {menuSections.map((section) => (
          <React.Fragment key={section.heading}>
            <div className="sb-sidenav-menu-heading">{section.heading}</div>
            <ul className="nav">
              {section.items.map((item) => {
                const isActive = item.href ? isActiveLink(item.href) : false
                return (
                  <li className="nav-item" key={`${section.heading}-${item.label}`}>
                    {item.enabled ? (
                      <NavLink
                        className={`nav-link ${isActive ? 'active' : ''}`}
                        to={item.href}
                        onClick={closeSidebarOnMobile}
                      >
                        <span className="sb-nav-link-icon"><SidebarIcon name={item.icon} /></span>
                        <span className="sb-nav-link-label">{item.label}</span>
                        {isActive ? (
                          <span className="sb-nav-link-trailing">
                            <i className="fas fa-chevron-right sb-nav-link-arrow" aria-hidden />
                          </span>
                        ) : null}
                      </NavLink>
                    ) : (
                      <button type="button" className="nav-link nav-link-disabled" aria-disabled="true">
                        <span className="sb-nav-link-icon"><SidebarIcon name={item.icon} /></span>
                        <span className="sb-nav-link-label">{item.label}</span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </React.Fragment>
        ))}
      </div>
      <div className="sb-sidenav-footer">
        <div className="small">Logged in as</div>
        <div className="user-name">{user?.name || user?.email || 'Administrator'}</div>
        <div className="small text-white-50">Administrator</div>
      </div>
    </nav>
  )
}

export default Sidebar
