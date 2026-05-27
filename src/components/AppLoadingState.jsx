import { useId } from 'react'
import './AppLoadingState.css'

/**
 * Minimal loading UI: one wrapper, spinner + text. Uses theme tokens (--brand-primary, --app-*).
 *
 * @param {string} [hint='Loading…'] Visible text under spinner.
 * @param {boolean} [compact=false] Less padding inside tight panels.
 * @param {string} [className] Extra classes on the root.
 */
export function AppLoadingState({ hint = 'Loading…', compact = false, className = '' }) {
  const hintId = useId()

  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby={hintId}
      className={`app-loading-state ${compact ? 'app-loading-state--compact' : ''} ${className}`.trim()}
    >
      <span className="app-loading-state__spinner" aria-hidden="true" />
      <span id={hintId} className="app-loading-state__hint">
        {hint}
      </span>
    </div>
  )
}
