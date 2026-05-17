import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const toYmd = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const parseYmd = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [yy, mm, dd] = value.split('-').map(Number)
  const dt = new Date(yy, mm - 1, dd)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

export function DatePickerInput({
  value,
  onChange,
  className = '',
  placeholder = 'YYYY-MM-DD',
}: DatePickerInputProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selectedDate = useMemo(() => parseYmd(value), [value])
  const [viewDate, setViewDate] = useState<Date>(selectedDate || new Date())

  useEffect(() => {
    if (selectedDate) setViewDate(selectedDate)
  }, [selectedDate?.getTime()])

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0)
  const leading = monthStart.getDay()
  const daysInMonth = monthEnd.getDate()
  const todayYmd = toYmd(new Date())

  const cells: Array<{ ymd: string; day: number; inMonth: boolean }> = []
  for (let i = 0; i < leading; i += 1) {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), i - leading + 1)
    cells.push({ ymd: toYmd(d), day: d.getDate(), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dt = new Date(viewDate.getFullYear(), viewDate.getMonth(), d)
    cells.push({ ymd: toYmd(dt), day: d, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const dt = parseYmd(last.ymd) || new Date()
    dt.setDate(dt.getDate() + 1)
    cells.push({ ymd: toYmd(dt), day: dt.getDate(), inMonth: false })
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-bg-tertiary border border-border-subtle rounded-xl px-4 py-2 text-text-primary text-left flex items-center justify-between gap-2"
      >
        <span className={value ? 'text-text-primary' : 'text-text-tertiary'}>{value || placeholder}</span>
        <Calendar className="w-4 h-4 text-text-tertiary" />
      </button>

      {open && (
        <div className="absolute z-[10000] mt-2 w-[300px] modal-panel border border-border-subtle rounded-2xl shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-semibold text-text-primary">
              {viewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekdayLabels.map((d) => (
              <div key={d} className="text-center text-[11px] text-text-tertiary py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((c) => {
              const isSelected = value === c.ymd
              const isToday = c.ymd === todayYmd
              return (
                <button
                  key={c.ymd}
                  type="button"
                  onClick={() => {
                    onChange(c.ymd)
                    setOpen(false)
                  }}
                  className={`h-9 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent-primary text-bg-primary font-semibold'
                      : c.inMonth
                        ? 'text-text-primary hover:bg-bg-hover'
                        : 'text-text-tertiary/60 hover:bg-bg-hover'
                  } ${isToday && !isSelected ? 'ring-1 ring-accent-secondary/50' : ''}`}
                >
                  {c.day}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
            <button type="button" onClick={() => onChange('')} className="text-xs text-text-tertiary hover:text-text-secondary">Xóa</button>
            <button
              type="button"
              onClick={() => {
                onChange(todayYmd)
                setOpen(false)
              }}
              className="text-xs text-accent-secondary hover:text-text-primary"
            >
              Hôm nay
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

