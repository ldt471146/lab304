import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CheckCheck, MapPin, LogOut, Clock } from 'lucide-react'

// 签到时间段定义
const SLOTS = [
  { key: 'morning',   label: '上午',  start: 8,  end: 12 },
  { key: 'afternoon', label: '下午',  start: 14, end: 18 },
  { key: 'evening',   label: '晚上',  start: 19, end: 22 },
]

function getCurrentSlot() {
  const h = new Date().getHours()
  return SLOTS.find(s => h >= s.start && h < s.end) || null
}

export default function CheckinPage() {
  const { profile, fetchProfile } = useAuth()
  const [seats, setSeats] = useState([])
  const [todayCheckin, setTodayCheckin] = useState(null)
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const today = new Date().toISOString().split('T')[0]
  const currentSlot = getCurrentSlot()

  useEffect(() => {
    fetchSeats()
    fetchTodayCheckin()
  }, [profile])

  async function fetchSeats() {
    const { data } = await supabase.from('seat_status_today').select('*').order('seat_number')
    setSeats(data || [])
  }

  async function fetchTodayCheckin() {
    if (!profile) return
    const { data } = await supabase.from('checkins').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('check_date', today).maybeSingle()
    setTodayCheckin(data)
  }

  async function handleCheckin() {
    if (!profile) return
    setLoading(true); setMsg(null)
    const payload = { user_id: profile.id, check_date: today }
    if (selectedSeat) payload.seat_id = selectedSeat
    const { error } = await supabase.from('checkins').insert(payload)
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? '今天已经签到过了' : error.message })
    } else {
      setMsg({ type: 'success', text: '签到成功！+1 积分' })
      await Promise.all([fetchTodayCheckin(), fetchSeats(), fetchProfile(profile.id)])
      setSelectedSeat(null)
    }
    setLoading(false)
  }

  async function handleCheckout() {
    if (!todayCheckin) return
    setCheckoutLoading(true); setMsg(null)
    const { error } = await supabase.from('checkins')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', todayCheckin.id)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '签退成功，再见！' })
      await Promise.all([fetchTodayCheckin(), fetchSeats()])
    }
    setCheckoutLoading(false)
  }

  const rows = [...new Set(seats.map(s => s.row_label))].sort()
  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'

  // 当前不在任何签到时段
  const outOfSlot = !currentSlot

  return (
    <div className="page">
      <div className="page-header">
        <CheckCheck size={20} />
        <h2>今日签到</h2>
        <span className="date-badge">{today}</span>
      </div>

      {/* 时段状态提示 */}
      <div className="slot-status-bar">
        {SLOTS.map(s => {
          const isCurrent = currentSlot?.key === s.key
          return (
            <div key={s.key} className={`slot-status-item ${isCurrent ? 'current' : ''}`}>
              <Clock size={13} />
              <span>{s.label}</span>
              <small>{s.start}:00 - {s.end}:00</small>
              {isCurrent && <span className="slot-dot" />}
            </div>
          )
        })}
      </div>

      {todayCheckin ? (
        <>
          <div className={`success-banner ${todayCheckin.checked_out_at ? 'checked-out' : ''}`}>
            <CheckCheck size={22} />
            <div style={{ flex: 1 }}>
              <div>{todayCheckin.checked_out_at ? '今日已签退' : '今日已签到'}</div>
              <div className="sub">
                {todayCheckin.seats ? '座位 ' + todayCheckin.seats.seat_number + ' · ' : ''}
                签到 {formatTime(todayCheckin.checked_at)}
                {todayCheckin.checked_out_at && <> · 签退 {formatTime(todayCheckin.checked_out_at)}</>}
              </div>
            </div>
            {!todayCheckin.checked_out_at && (
              <button className="btn-checkout" onClick={handleCheckout} disabled={checkoutLoading}>
                <LogOut size={15} />
                {checkoutLoading ? '签退中...' : '签退'}
              </button>
            )}
          </div>
          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
        </>
      ) : outOfSlot ? (
        <div className="out-of-slot-hint">
          <Clock size={32} />
          <div>当前不在签到时段</div>
          <small>签到时间：上午 08:00-12:00 · 下午 14:00-18:00 · 晚上 19:00-22:00</small>
        </div>
      ) : (
        <>
          <div className="section-title"><MapPin size={15} /> 选择座位（可跳过）</div>
          <div className="seat-map">
            {rows.map(row => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                {seats.filter(s => s.row_label === row).map(seat => {
                  const occupied = !!seat.checkin_user
                  const mine = selectedSeat === seat.seat_id
                  return (
                    <button
                      key={seat.seat_id}
                      className={`seat ${occupied ? 'occupied' : ''} ${mine ? 'selected' : ''}`}
                      onClick={() => !occupied && setSelectedSeat(mine ? null : seat.seat_id)}
                      title={occupied ? `${seat.checkin_user} 已签到` : seat.seat_number}
                      disabled={occupied}
                    >
                      {seat.col_number}
                    </button>
                  )
                })}
              </div>
            ))}
            <div className="seat-legend">
              <span className="legend-dot available" /> 空闲
              <span className="legend-dot occupied" /> 已签到
              <span className="legend-dot selected" /> 已选
            </div>
          </div>

          {selectedSeat && (
            <div className="selected-hint">
              已选：{seats.find(s => s.seat_id === selectedSeat)?.seat_number}
            </div>
          )}

          {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          <button className="btn-primary checkin-btn" onClick={handleCheckin} disabled={loading}>
            {loading ? '签到中...' : `确认签到（${currentSlot.label}）`}
          </button>
        </>
      )}
    </div>
  )
}
