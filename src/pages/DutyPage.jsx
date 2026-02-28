import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getLocalDate } from '../lib/constants'
import { generateSchedule, computeStats } from '../lib/dutyScheduler'
import { CalendarClock, ChevronLeft, ChevronRight, UserPlus, Trash2, Wand2, BarChart3 } from 'lucide-react'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function monthRange(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  return { first, last, daysInMonth: last.getDate(), startDow: first.getDay() }
}

export default function DutyPage() {
  const { profile } = useAuth()
  const today = getLocalDate()

  // calendar state
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [scheduleMap, setScheduleMap] = useState({})

  // admin state
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
  const [msg, setMsg] = useState(null)

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
      setMsg({ type: 'error', text: '请选择成员并填写在岗日期' }); return
    }
    const { error } = await supabase.from('duty_members').insert({
      user_id: selectedUserId, start_date: memberStart, end_date: memberEnd,
    })
    if (error) { setMsg({ type: 'error', text: error.message }); return }
    setSelectedUserId(''); setMsg(null)
    fetchMembers()
  }

  async function removeMember(id) {
    await supabase.from('duty_members').delete().eq('id', id)
    fetchMembers()
  }

  async function handleGenerate() {
    if (!rangeStart || !rangeEnd || !dutyMembers.length) {
      setMsg({ type: 'error', text: '请设置日期范围并添加值日成员' }); return
    }
    setGenerating(true); setMsg(null); setStats(null)

    const members = dutyMembers.map(m => ({
      userId: m.user_id, name: m.users.name, startDate: m.start_date, endDate: m.end_date,
    }))
    const schedule = generateSchedule({ members, rangeStart, rangeEnd, minPerDay, maxPerDay })

    // delete old then insert
    await supabase.from('duty_schedule').delete()
      .gte('duty_date', rangeStart).lte('duty_date', rangeEnd)

    const rows = []
    for (const { date, userIds } of schedule) {
      for (const uid of userIds) rows.push({ duty_date: date, user_id: uid, created_by: profile.id })
    }
    if (rows.length) {
      const { error } = await supabase.from('duty_schedule').insert(rows)
      if (error) { setMsg({ type: 'error', text: error.message }); setGenerating(false); return }
    }

    setStats(computeStats(schedule, members))
    setMsg({ type: 'success', text: `已生成 ${schedule.length} 天排班 (${rows.length} 条记录)` })
    setGenerating(false)
    fetchSchedule()
  }

  // calendar rendering
  const { daysInMonth, startDow } = useMemo(() => monthRange(viewYear, viewMonth), [viewYear, viewMonth])

  const calendarCells = useMemo(() => {
    const cells = []
    // previous month padding
    const prevLast = new Date(viewYear, viewMonth, 0).getDate()
    for (let i = startDow - 1; i >= 0; i--) cells.push({ day: prevLast - i, otherMonth: true, date: null })
    // current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ day: d, otherMonth: false, date })
    }
    // next month padding
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

  return (
    <div className="page">
      <div className="page-header">
        <CalendarClock size={18} />
        <h2>值日表</h2>
      </div>

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
            ].filter(Boolean).join(' ')
            return (
              <div key={i} className={cls}>
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
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="duty-admin">
          <div className="section-title"><UserPlus size={16} /> 值日成员管理</div>

          <div className="duty-add-row">
            <select className="date-input" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
              <option value="">选择成员...</option>
              {availableUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.student_id})</option>)}
            </select>
            <input type="date" className="date-input" value={memberStart} onChange={e => setMemberStart(e.target.value)} placeholder="开始" />
            <input type="date" className="date-input" value={memberEnd} onChange={e => setMemberEnd(e.target.value)} placeholder="结束" />
            <button className="btn-primary" onClick={addMember}><UserPlus size={14} /> 添加</button>
          </div>

          {dutyMembers.length > 0 && (
            <div className="duty-member-list">
              {dutyMembers.map(m => (
                <div key={m.id} className="duty-member-row">
                  <span className="duty-member-name">{m.users.name}</span>
                  <span className="duty-member-date">{m.start_date} ~ {m.end_date}</span>
                  <button className="btn-danger-sm" onClick={() => removeMember(m.id)}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="section-title" style={{ marginTop: '1.5rem' }}><Wand2 size={16} /> 生成排班</div>
          <div className="duty-gen-row">
            <div className="field-group">
              <label>排班开始</label>
              <input type="date" className="date-input" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            </div>
            <div className="field-group">
              <label>排班结束</label>
              <input type="date" className="date-input" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
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

          {msg && <div className={`msg ${msg.type}`} style={{ marginTop: '0.75rem' }}>{msg.text}</div>}

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
