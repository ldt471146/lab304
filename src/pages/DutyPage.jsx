import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getLocalDate } from '../lib/constants'
import { generateSchedule, computeStats } from '../lib/dutyScheduler'
import DatePicker from '../components/DatePicker'
import { CalendarClock, ChevronLeft, ChevronRight, UserPlus, Trash2, Wand2, BarChart3, X, Plus, Check } from 'lucide-react'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function fmtDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function monthRange(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return { daysInMonth: last.getDate(), startDow: first.getDay() }
}

function startOfWeekMonday(baseDate = new Date()) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d
}

function addDaysLocal(baseDate, days) {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  d.setDate(d.getDate() + days)
  return d
}

// toast auto-clear
function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)
  const show = useCallback((type, text) => {
    clearTimeout(timerRef.current)
    setToast({ type, text })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, show }
}

export default function DutyPage() {
  const { profile } = useAuth()
  const today = getLocalDate()
  const { toast, show: showToast } = useToast()

  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [scheduleMap, setScheduleMap] = useState({})

  // admin
  const [dutyMembers, setDutyMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [memberStart, setMemberStart] = useState('')
  const [memberEnd, setMemberEnd] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [minPerDay, setMinPerDay] = useState(1)
  const [maxPerDay, setMaxPerDay] = useState(2)
  const [generating, setGenerating] = useState(false)
  const [stats, setStats] = useState(null)
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()))
  const [calendarEditDate, setCalendarEditDate] = useState('')
  const [calendarAddId, setCalendarAddId] = useState('')

  useEffect(() => { fetchSchedule(); fetchMembers() }, [])

  async function fetchSchedule() {
    const { data } = await supabase
      .from('duty_schedule')
      .select('duty_date, user_id, users!inner(name)')
      .order('duty_date')
    const map = {}
    for (const r of data || []) {
      if (!map[r.duty_date]) map[r.duty_date] = []
      map[r.duty_date].push({ userId: r.user_id, name: r.users.name })
    }
    setScheduleMap(map)
  }

  async function fetchMembers() {
    const [membersRes, usersRes] = await Promise.all([
      supabase.from('duty_members').select('*, users!inner(name)').eq('is_active', true).order('created_at'),
      supabase.from('users').select('id, name, student_id').order('name'),
    ])
    setDutyMembers(membersRes.data || [])
    setAllUsers(usersRes.data || [])
  }

  async function addMember() {
    if (!selectedUserId || !memberStart || !memberEnd) {
      showToast('error', '请选择成员并填写在岗日期'); return
    }
    if (memberStart > memberEnd) {
      showToast('error', '开始日期不能晚于结束日期'); return
    }
    const userName = allUsers.find(u => u.id === selectedUserId)?.name || ''
    const { error } = await supabase.from('duty_members').upsert({
      user_id: selectedUserId, start_date: memberStart, end_date: memberEnd, is_active: true,
    }, { onConflict: 'user_id' })
    if (error) { showToast('error', error.message); return }
    setSelectedUserId('')
    showToast('success', `已添加 ${userName}`)
    fetchMembers()
  }

  async function removeMember(id, name) {
    await supabase.from('duty_members').delete().eq('id', id)
    showToast('success', `已移除 ${name}`)
    fetchMembers()
  }

  // quick date presets
  function setPreset(type) {
    const now = new Date()
    const y = now.getFullYear(), m = now.getMonth()
    if (type === 'thisMonth') {
      setRangeStart(fmtDate(y, m + 1, 1))
      setRangeEnd(fmtDate(y, m + 1, new Date(y, m + 1, 0).getDate()))
    } else if (type === 'nextMonth') {
      const ny = m === 11 ? y + 1 : y, nm = m === 11 ? 1 : m + 2
      setRangeStart(fmtDate(ny, nm, 1))
      setRangeEnd(fmtDate(ny, nm, new Date(ny, nm, 0).getDate()))
    } else if (type === 'nextWeek') {
      const mon = new Date(now)
      mon.setDate(now.getDate() + (8 - now.getDay()) % 7 || 7)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      setRangeStart(mon.toISOString().slice(0, 10))
      setRangeEnd(sun.toISOString().slice(0, 10))
    }
  }

  async function handleGenerate() {
    if (!rangeStart || !rangeEnd) {
      showToast('error', '请设置排班日期范围'); return
    }
    if (!dutyMembers.length) {
      showToast('error', '请先添加值日成员'); return
    }
    if (rangeStart > rangeEnd) {
      showToast('error', '开始日期不能晚于结束日期'); return
    }
    setGenerating(true); setStats(null)
    const members = dutyMembers.map(m => ({
      userId: m.user_id, name: m.users.name, startDate: m.start_date, endDate: m.end_date,
    }))
    const schedule = generateSchedule({ members, rangeStart, rangeEnd, minPerDay, maxPerDay })

    await supabase.from('duty_schedule').delete()
      .gte('duty_date', rangeStart).lte('duty_date', rangeEnd)

    const rows = []
    for (const { date, userIds } of schedule) {
      for (const uid of userIds) rows.push({ duty_date: date, user_id: uid, created_by: profile.id })
    }
    if (rows.length) {
      const { error } = await supabase.from('duty_schedule').insert(rows)
      if (error) { showToast('error', error.message); setGenerating(false); return }
    }
    setStats(computeStats(schedule, members))
    showToast('success', `已生成 ${schedule.length} 天排班，共 ${rows.length} 条`)
    setGenerating(false)
    fetchSchedule()
  }

  async function manualAdd(date, userId) {
    const name = allUsers.find(u => u.id === userId)?.name || ''
    const { error } = await supabase.from('duty_schedule').insert({
      duty_date: date, user_id: userId, created_by: profile.id,
    })
    if (error) { showToast('error', error.message); return }
    showToast('success', `${date} 已添加 ${name}`)
    fetchSchedule()
  }

  async function manualRemove(date, userId, name) {
    await supabase.from('duty_schedule').delete()
      .eq('duty_date', date).eq('user_id', userId)
    showToast('success', `${date} 已移除 ${name}`)
    fetchSchedule()
  }

  // calendar
  const { daysInMonth, startDow } = useMemo(() => monthRange(viewYear, viewMonth), [viewYear, viewMonth])
  const calendarCells = useMemo(() => {
    const cells = []
    const prevLast = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) cells.push({ day: prevLast - i, otherMonth: true, date: null })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, otherMonth: false, date: fmtDate(viewYear, viewMonth + 1, d) })
    }
    const remain = 7 - (cells.length % 7)
    if (remain < 7) for (let d = 1; d <= remain; d++) cells.push({ day: d, otherMonth: true, date: null })
    return cells
  }, [viewYear, viewMonth, daysInMonth, startDow])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  const isAdmin = profile?.is_admin
  const availableUsers = allUsers.filter(u => !dutyMembers.some(m => m.user_id === u.id))
  const weekRows = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDaysLocal(weekStart, i)
      const date = fmtDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
      return {
        date,
        label: WEEKDAY_LABELS[i],
        entries: scheduleMap[date] || [],
      }
    })
  }, [weekStart, scheduleMap])
  const calendarEditEntries = calendarEditDate ? (scheduleMap[calendarEditDate] || []) : []
  const calendarEditAvailable = allUsers.filter(u => !calendarEditEntries.some(e => e.userId === u.id))

  return (
    <div className="page">
      <div className="page-header">
        <CalendarClock size={18} />
        <h2>值日表</h2>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`duty-toast ${toast.type}`}>
          {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
          {toast.text}
        </div>
      )}

      <div className="duty-main-layout">
        <div className="duty-main-left">
          {/* Calendar */}
          <div className="duty-calendar">
            <div className="duty-cal-header">
              <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
              <span className="duty-cal-title">{viewYear} 年 {viewMonth + 1} 月</span>
              <button className="btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>
            <div className="duty-cal-grid">
              {WEEKDAYS.map(w => <div key={w} className="duty-weekday">{w}</div>)}
              {calendarCells.map((cell, i) => {
                const entries = cell.date ? (scheduleMap[cell.date] || []) : []
                const isToday = cell.date === today
                const isMine = entries.some(e => e.userId === profile?.id)
                const cls = ['duty-day',
                  cell.otherMonth && 'other-month',
                  isToday && 'today',
                  isMine && 'mine',
                  isAdmin && cell.date && calendarEditDate === cell.date && 'selected',
                ].filter(Boolean).join(' ')
                return (
                  <div
                    key={i}
                    className={cls}
                    onClick={() => {
                      if (!isAdmin || !cell.date) return
                      setCalendarEditDate(cell.date)
                      setCalendarAddId('')
                    }}
                  >
                    <span className="duty-day-num">{cell.day}</span>
                    {entries.length > 0 && (
                      <div className="duty-names">
                        {entries.map((e, j) => (
                          <span key={j} className={e.userId === profile?.id ? 'duty-name-me' : ''}>{e.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {isAdmin && <div className="duty-cal-hint">点击日期可直接编辑当天值日成员</div>}
            {isAdmin && (
              <div className="duty-cal-editor">
                <div className="duty-cal-editor-head">
                  {calendarEditDate ? `${calendarEditDate} 值日编辑` : '先点击日历中的日期再编辑'}
                </div>
                {calendarEditDate && (
                  <>
                    <div className="duty-week-tags">
                      {calendarEditEntries.length
                        ? calendarEditEntries.map(e => (
                          <span key={e.userId} className="duty-week-tag">
                            {e.name}
                            <button
                              type="button"
                              className="duty-week-tag-remove"
                              onClick={() => manualRemove(calendarEditDate, e.userId, e.name)}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))
                        : <span className="duty-week-empty">当天暂无值日</span>}
                    </div>
                    <div className="duty-cal-editor-row">
                      <select className="date-input" value={calendarAddId} onChange={e => setCalendarAddId(e.target.value)}>
                        <option value="">添加成员...</option>
                        {calendarEditAvailable.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn-primary btn-sm"
                        disabled={!calendarAddId}
                        onClick={() => {
                          if (!calendarAddId) return
                          manualAdd(calendarEditDate, calendarAddId)
                          setCalendarAddId('')
                        }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="duty-week-note">
          <div className="duty-week-board">
            <div className="duty-week-header">
              <div className="section-title"><CalendarClock size={16} /> 一周值日便签</div>
              <div className="duty-week-actions">
                <button className="btn-preset" onClick={() => setWeekStart(w => addDaysLocal(w, -7))}>上一周</button>
                <button className="btn-preset" onClick={() => setWeekStart(startOfWeekMonday(new Date()))}>本周</button>
                <button className="btn-preset" onClick={() => setWeekStart(w => addDaysLocal(w, 7))}>下一周</button>
              </div>
            </div>
            <div className="duty-week-list">
              {weekRows.map(row => {
                return (
                  <div key={row.date} className={`duty-week-row${row.date === today ? ' today' : ''}`}>
                    <div className="duty-week-day">{row.label}</div>
                    <div className="duty-week-date">{row.date}</div>
                    <div className="duty-week-members">
                      {row.entries.length ? (
                        <div className="duty-week-tags">
                          {row.entries.slice(0, 4).map(e => <span key={e.userId} className="duty-week-tag">{e.name}</span>)}
                          {row.entries.length > 4 && <span className="duty-week-more">+{row.entries.length - 4}</span>}
                        </div>
                      ) : '无人值日'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Admin */}
      {isAdmin && (
        <div className="duty-admin">
          <div className="section-title"><UserPlus size={16} /> 值日成员管理</div>

          <div className="duty-add-row">
            <select className="date-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
              <option value="">选择成员...</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.student_id})</option>)}
            </select>
            <DatePicker value={memberStart} onChange={setMemberStart} placeholder="开始日期" />
            <DatePicker value={memberEnd} onChange={setMemberEnd} placeholder="结束日期" />
            <button className="btn-primary" onClick={addMember}><UserPlus size={14} /> 添加</button>
          </div>

          {dutyMembers.length > 0 && (
            <div className="duty-member-list">
              {dutyMembers.map(m => (
                <div key={m.id} className="duty-member-row">
                  <span className="duty-member-name">{m.users.name}</span>
                  <span className="duty-member-date">{m.start_date} ~ {m.end_date}</span>
                  <button className="btn-danger-sm" onClick={() => removeMember(m.id, m.users.name)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="section-title" style={{ marginTop: '1.5rem' }}><Wand2 size={16} /> 算法生成排班</div>

          <div className="duty-preset-row">
            <button className="btn-preset" onClick={() => setPreset('thisMonth')}>本月</button>
            <button className="btn-preset" onClick={() => setPreset('nextMonth')}>下月</button>
            <button className="btn-preset" onClick={() => setPreset('nextWeek')}>下周</button>
          </div>

          <div className="duty-gen-row">
            <div className="field-group">
              <label>排班开始</label>
              <DatePicker value={rangeStart} onChange={setRangeStart} placeholder="开始日期" />
            </div>
            <div className="field-group">
              <label>排班结束</label>
              <DatePicker value={rangeEnd} onChange={setRangeEnd} placeholder="结束日期" />
            </div>
            <div className="field-group">
              <label>每日最少</label>
              <input type="number" className="date-input" min={1} max={10} value={minPerDay} onChange={e => setMinPerDay(+e.target.value)} />
            </div>
            <div className="field-group">
              <label>每日最多</label>
              <input type="number" className="date-input" min={1} max={10} value={maxPerDay} onChange={e => setMaxPerDay(+e.target.value)} />
            </div>
          </div>
          <button className="btn-primary" onClick={handleGenerate} disabled={generating} style={{ marginTop: '0.75rem' }}>
            <Wand2 size={14} /> {generating ? '生成中...' : '生成排班'}
          </button>

          {stats && (
            <div className="duty-stats">
              <div className="section-title"><BarChart3 size={16} /> 排班统计</div>
              <div className="duty-stats-summary">
                平均 {stats.avg} 次 / 标准差 {stats.stddev}
              </div>
              <div className="duty-stats-grid">
                {stats.perMember.map(m => (
                  <div key={m.userId} className="duty-stat-item">
                    <span>{m.name}</span>
                    <span className="duty-stat-count">{m.count} 次</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
