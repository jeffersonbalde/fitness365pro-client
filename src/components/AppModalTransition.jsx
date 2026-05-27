import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const DismissContext = createContext(() => {})

export const useAppModalDismiss = () => useContext(DismissContext)

const CLOSE_MS = 340
const CLOSE_MS_REDUCED = 45

/**
 * Enter/exit transitions aligned with the mobile "Add to your log" sheet.
 * - User dismiss: exit animation, then `onRequestClose`.
 * - `open` becomes false from parent without animated dismiss: instant unmount.
 */
const AppModalTransition = ({
  open,
  onRequestClose,
  backdropClassName,
  panelClassName,
  children,
  ignoreBackdropMs = 0,
}) => {
  const onCloseRef = useRef(onRequestClose)
  useEffect(() => {
    onCloseRef.current = onRequestClose
  }, [onRequestClose])

  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  const ignoreBackdropUntilRef = useRef(0)
  const closeTimerRef = useRef(null)
  const userClosingRef = useRef(false)
  const wasOpenRef = useRef(false)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const runAfterClose = useCallback(() => {
    clearCloseTimer()
    userClosingRef.current = false
    setClosing(false)
    setEntered(false)
    setMounted(false)
    onCloseRef.current?.()
  }, [clearCloseTimer])

  const requestClose = useCallback(() => {
    if (!mounted || closing) return
    if (!entered) {
      runAfterClose()
      return
    }
    userClosingRef.current = true
    setClosing(true)
    setEntered(false)
  }, [mounted, closing, entered, runAfterClose])

  /** First time (or again) `open` becomes true: mount and prepare enter animation. */
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return undefined
    }
    if (wasOpenRef.current) return undefined
    wasOpenRef.current = true
    clearCloseTimer()
    userClosingRef.current = false
    setClosing(false)
    setEntered(false)
    setMounted(true)
    if (ignoreBackdropMs > 0) {
      ignoreBackdropUntilRef.current = Date.now() + ignoreBackdropMs
    }
    return undefined
  }, [open, clearCloseTimer, ignoreBackdropMs])

  /** Parent cleared `open` without our animated dismiss. */
  useEffect(() => {
    if (open || !mounted) return undefined
    if (userClosingRef.current) return undefined
    clearCloseTimer()
    setClosing(false)
    setEntered(false)
    setMounted(false)
    return undefined
  }, [open, mounted, clearCloseTimer])

  useLayoutEffect(() => {
    if (!mounted || entered || closing) return undefined
    let id2 = 0
    const id1 = window.requestAnimationFrame(() => {
      id2 = window.requestAnimationFrame(() => {
        setEntered(true)
      })
    })
    return () => {
      window.cancelAnimationFrame(id1)
      if (id2) window.cancelAnimationFrame(id2)
    }
  }, [mounted, entered, closing])

  useEffect(() => {
    if (!closing || entered) return undefined
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? CLOSE_MS_REDUCED : CLOSE_MS
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      runAfterClose()
    }, ms)
    return clearCloseTimer
  }, [closing, entered, clearCloseTimer, runAfterClose])

  useEffect(() => {
    if (!open || !mounted) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, mounted, requestClose])

  const onBackdropClick = (e) => {
    if (e.target !== e.currentTarget) return
    if (Date.now() < ignoreBackdropUntilRef.current) return
    requestClose()
  }

  const backdropCls = `${backdropClassName}${entered ? ' is-visible' : ''}`
  const panelCls = `${panelClassName}${entered ? ' is-visible' : ''}`

  const dismissValue = useMemo(() => requestClose, [requestClose])

  const body =
    typeof children === 'function' ? children(dismissValue) : children

  if (!mounted) return null

  return (
    <DismissContext.Provider value={dismissValue}>
      <div className={backdropCls} onClick={onBackdropClick} role="presentation">
        <div className={panelCls} onClick={(e) => e.stopPropagation()} role="document">
          {body}
        </div>
      </div>
    </DismissContext.Provider>
  )
}

export default AppModalTransition
