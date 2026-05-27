import React from 'react'
import logoFinal from '../assets/images/logo_final.png'

const Footer = () => {
  return (
    <footer className="auth-footer position-relative">
      <div className="container px-4 px-md-5">
        <div className="d-flex flex-column flex-md-row align-items-center justify-content-between py-3 border-top border-light">
          <div className="d-flex align-items-center gap-2 mb-2 mb-md-0">
            <img
              src={logoFinal}
              alt="Fitness 365 Pro"
              className="auth-footer-logo"
            />
            <div className="d-flex flex-column">
              <span className="auth-footer-copy">
                © {new Date().getFullYear()} All rights reserved.
              </span>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="d-flex align-items-center gap-3 small">
              <a href="/terms" className="auth-footer-link">
                Terms
              </a>
              <span className="auth-footer-separator">•</span>
              <a href="/privacy" className="auth-footer-link">
                Privacy
              </a>
            </div>

            <a
              href="https://facebook.com"
              className="auth-footer-icon d-inline-flex align-items-center justify-content-center text-decoration-none"
              aria-label="Visit Fitness 365 Pro on Facebook"
              target="_blank"
              rel="noreferrer"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.12 8.44 9.88v-7H8.59v-2.88h1.85V9.41c0-1.83 1.09-3.58 3.76-3.58 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78L15.8 14.9h-2.16v7C18.34 21.12 22 16.99 22 12z"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

