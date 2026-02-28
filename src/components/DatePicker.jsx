import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function DatePicker({ value, onChange, placeholder = '选择日期' }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    if (value) { const d = new Date(value); return d.getFullYear() }
    return new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) { const d = new Date(value); return d.getMonth() }
    return new Date().getMonth()
  })
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const today = new Date().toISOString().slice(0, 10)

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const startDow = first.getDay()
    const arr = []
    const prevLast = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) arr.push({ day: prevLast - i, otherMonth: true, date: null })
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      arr.push({ day: d, otherMonth: false, date })
    }
    const remain = 7 - (arr.length % 7)
    if (remain < 7) for (let d = 1; d <= remain; d++) arr.push({ day: d, otherMonth: true, date: null })
    return arr
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function select(date) {
    onChange(date)
    setOpen(false)
  }

  return (
    <div className="datepicker-wrap" ref={wrapRef}>
      <button type="button" className="datepicker-trigger" onClick={() => setOpen(o => !o)}>
        <Calendar size={14} />
        <span>{value || placeholder}</span>
      </button>
      {open && (
        <div className="datepicker-dropdown">
          <div className="datepicker-header">
            <button type="button" className="btn-icon" onClick={prevMonth}><ChevronLeft size={14} /></button>
            <span>{viewYear}.{String(viewMonth + 1).padStart(2, '0')}</span>
            <button type="button" className="btn-icon" onClick={nextMonth}><ChevronRight size={14} /></button>
          </div>
          <div className="datepicker-grid">
            {WEEKDAYS.map(w => <div key={w} className="datepicker-weekday">{w}</div>)}
            {cells.map((c, i) => {
              const cls = ['datepicker-day',
                c.otherMonth && 'other-month',
                c.date === value && 'selected',
                c.date === today && 'today',
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={i} type="button" className={cls}
                  disabled={c.otherMonth}
                  onClick={() => c.date && select(c.date)}
                >
                  {c.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
