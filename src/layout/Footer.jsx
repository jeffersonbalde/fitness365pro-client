import React from 'react'

const FOOTER_TAGLINE = 'Fitness 365 Pro Admin Console'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="py-3 bg-light mt-auto sb-admin-footer">
      <div className="container-fluid">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between small">
          <span className="text-muted">
            &copy; {currentYear} Fitness 365 Pro. {FOOTER_TAGLINE}. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}

export default Footer