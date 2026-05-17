import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'

export interface SearchableOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: SearchableOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  triggerClassName?: string
  panelClassName?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No result',
  className = '',
  triggerClassName = '',
  panelClassName = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [openUpward, setOpenUpward] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 })
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!rootRef.current) return
      const target = e.target as Node
      const inTrigger = rootRef.current.contains(target)
      const inPanel = panelRef.current?.contains(target) ?? false
      if (!inTrigger && !inPanel) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label || placeholder,
    [options, value, placeholder]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open || !rootRef.current) return
    const updatePanelPlacement = () => {
      if (!rootRef.current) return
      const rect = rootRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const estimatedPanelHeight = 280
      const shouldOpenUpward = spaceBelow < estimatedPanelHeight
      setOpenUpward(shouldOpenUpward)
      setPanelPos({
        top: shouldOpenUpward ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      })
    }
    updatePanelPlacement()
    window.addEventListener('resize', updatePanelPlacement)
    window.addEventListener('scroll', updatePanelPlacement, true)
    return () => {
      window.removeEventListener('resize', updatePanelPlacement)
      window.removeEventListener('scroll', updatePanelPlacement, true)
    }
  }, [open, options.length])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          setQuery('')
        }}
        className={`w-full rounded-2xl px-4 py-2.5 text-left text-text-primary flex items-center justify-between gap-2 border border-border-subtle bg-bg-tertiary hover:bg-bg-hover transition-colors ${triggerClassName}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className="w-4 h-4 text-text-tertiary" />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className={`fixed z-[9999] bg-bg-elevated border border-border-subtle rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md ${panelClassName}`}
          style={{
            top: openUpward ? undefined : `${panelPos.top}px`,
            bottom: openUpward ? `${window.innerHeight - panelPos.top}px` : undefined,
            left: `${panelPos.left}px`,
            width: `${panelPos.width}px`,
          }}
        >
          <div className="p-2 border-b border-border-subtle relative">
            <Search className="w-4 h-4 text-text-tertiary absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-bg-elevated border border-border-subtle rounded-xl pl-9 pr-2 py-1.5 text-sm text-text-primary"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-text-tertiary">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`w-full text-left px-2 py-2 rounded-lg text-sm transition-colors ${
                    o.value === value
                      ? 'bg-accent-primary/10 text-accent-primary'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
