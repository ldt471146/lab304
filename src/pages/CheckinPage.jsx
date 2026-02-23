import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CheckCheck, MapPin, LogOut, Clock, Timer } from 'lucide-react'

const SLOTS = [
  { key: 'morning',   label: '上午', start: 8,  end: 12 },
  { key: 'afternoon', label: '下午', start: 14, end: 18 },
  { key: 'evening',   label: '晚上', start: 19, end: 22 },
]

function getCurrentSlot() {
  const h = new Date().getHours()
  return SLOTS.find(s => h >= s.start && h < s.end) || null
}

function getSlotStatus(slot, currentSlot, checkinMap) {
  const checked = !!checkinMap[slot.key]
  if (checked) return 'checked'
  if (currentSlot?.key === slot.key) return 'active'
  const h = new Date().getHours()
  if (h >= slot.end) return 'expired'
  return 'upcoming'
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return h > 0
    ? `${h}小时${m}分${s}秒`
    : m > 0 ? `${m}分${s}秒` : `${s}秒`
}

const STATUS_LABELS = {
  checked: '已签到',
  active: '可签到',
  expired: '已过期',
  upcoming: '未开始',
}

export default function CheckinPage() {
  const { profile, fetchProfile } = useAuth()
  const [seats, setSeats] = useState([])
  const [todayCheckins, setTodayCheckins] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [elapsed, setElapsed] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const currentSlot = getCurrentSlot()

  // 当前时段的签到记录
  const checkinMap = {}
  todayCheckins.forEach(c => { checkinMap[c.time_slot] = c })
  const currentCheckin = currentSlot ? checkinMap[currentSlot.key] : null

  const fetchSeats = useCallback(async () => {
    const { data } = await supabase.from('seat_status_today').select('*').order('seat_number')
    setSeats(data || [])
  }, [])

  const fetchTodayCheckins = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('checkins').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('check_date', today)
    setTodayCheckins(data || [])
  }, [profile, today])

  useEffect(() => {
    fetchSeats()
    fetchTodayCheckins()
  }, [fetchSeats, fetchTodayCheckins])

  // 签到时长计时器
  useEffect(() => {
    if (!currentCheckin || currentCheckin.checked_out_at) return
    const tick = () => {
      const diff = Date.now() - new Date(currentCheckin.checked_at).getTime()
      setElapsed(formatDuration(diff))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [currentCheckin])

  async function handleCheckin() {
    if (!profile || !currentSlot) return
    setLoading(true); setMsg(null)
    const payload = { user_id: profile.id, check_date: today, time_slot: currentSlot.key }
    if (selectedSeat) payload.seat_id = selectedSeat
    const { error } = await supabase.from('checkins').insert(payload)
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? '该时段已签到过了' : error.message })
    } else {
      setMsg({ type: 'success', text: `${currentSlot.label}签到成功！+1 积分` })
      await Promise.all([fetchTodayCheckins(), fetchSeats(), fetchProfile(profile.id)])
      setSelectedSeat(null)
    }
    setLoading(false)
  }

  async function handleCheckout() {
    if (!currentCheckin) return
    setCheckoutLoading(true); setMsg(null)
    const { error } = await supabase.from('checkins')
      .update({ checked_out_at: new Date().toISOString() })
      .eq('id', currentCheckin.id)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '签退成功，再见！' })
      await Promise.all([fetchTodayCheckins(), fetchSeats()])
    }
    setCheckoutLoading(false)
  }

  // 按当前时段过滤座位占用
  const currentSlotSeats = seats.filter(s => !s.checkin_slot || s.checkin_slot === currentSlot?.key)
  const seatsBySlot = currentSlot
    ? seats.reduce((acc, s) => {
        // 同一个物理座位可能出现多行（不同 time_slot），只取当前时段的占用
        const key = s.seat_id
        if (!acc[key]) acc[key] = { ...s, checkin_user: null, checkin_slot: null }
        if (s.checkin_slot === currentSlot.key) acc[key] = s
        return acc
      }, {})
    : {}
  const dedupedSeats = Object.values(seatsBySlot)
  const rows = [...new Set(dedupedSeats.map(s => s.row_label))].sort()

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'

  const outOfSlot = !currentSlot
  const alreadyChecked = currentSlot && !!currentCheckin
  const canCheckin = currentSlot && !currentCheckin

  return (
    <div className="page">
      <div className="page-header">
        <CheckCheck size={20} />
        <h2>今日签到</h2>
        <span className="date-badge">{today}</span>
      </div>

      {/* 时段状态栏 */}
      <div className="slot-status-bar">
        {SLOTS.map(s => {
          const status = getSlotStatus(s, currentSlot, checkinMap)
          const checkin = checkinMap[s.key]
          return (
            <div key={s.key} className={`slot-card slot-${status}`}>
              <div className="slot-card-header">
                <Clock size={14} />
                <span className="slot-label">{s.label}</span>
                <span className={`slot-badge slot-badge-${status}`}>{STATUS_LABELS[status]}</span>
              </div>
              <div className="slot-card-time">{s.start}:00 – {s.end}:00</div>
              {checkin && (
                <div className="slot-card-detail">
                  {checkin.seats?.seat_number && <span>座位 {checkin.seats.seat_number}</span>}
                  <span>{formatTime(checkin.checked_at)}</span>
                  {checkin.checked_out_at && <span>→ {formatTime(checkin.checked_out_at)}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {/* 签退卡片 — 当前时段已签到且未签退 */}
      {alreadyChecked && !currentCheckin.checked_out_at && (
        <div className="checkout-card">
          <div className="checkout-card-info">
            <div className="checkout-card-title">
              <Timer size={18} />
              <span>{currentSlot.label}已签到</span>
            </div>
            <div className="checkout-card-meta">
              {currentCheckin.seats?.seat_number && `座位 ${currentCheckin.seats.seat_number} · `}
              签到时间 {formatTime(currentCheckin.checked_at)}
            </div>
            <div className="checkout-timer">{elapsed}</div>
          </div>
          <button className="btn-checkout-lg" onClick={handleCheckout} disabled={checkoutLoading}>
            <LogOut size={20} />
            <span>{checkoutLoading ? '签退中...' : '签退'}</span>
          </button>
        </div>
      )}

      {/* 当前时段已签退 */}
      {alreadyChecked && currentCheckin.checked_out_at && (
        <div className="checked-out-banner">
          <CheckCheck size={20} />
          <div>
            <div>{currentSlot.label}已签退</div>
            <div className="sub">
              {currentCheckin.seats?.seat_number && `座位 ${currentCheckin.seats.seat_number} · `}
              {formatTime(currentCheckin.checked_at)} → {formatTime(currentCheckin.checked_out_at)}
            </div>
          </div>
        </div>
      )}

      {/* 不在签到时段 */}
      {outOfSlot && (
        <div className="out-of-slot-hint">
          <Clock size={32} />
          <div>当前不在签到时段</div>
          <small>签到时间：上午 08:00-12:00 · 下午 14:00-18:00 · 晚上 19:00-22:00</small>
        </div>
      )}

      {/* 可签到 — 座位选择 + 签到按钮 */}
      {canCheckin && (
        <>
          <div className="section-title"><MapPin size={15} /> 选择座位（可跳过）</div>
          <div className="seat-map">
            {rows.map(row => (
              <div key={row} className="seat-row">
                <span className="row-label">{row}</span>
                {dedupedSeats.filter(s => s.row_label === row).map(seat => {
                  const occupied = seat.checkin_slot === currentSlot.key && !!seat.checkin_user
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
              已选：{dedupedSeats.find(s => s.seat_id === selectedSeat)?.seat_number}
            </div>
          )}

          <button className="btn-primary checkin-btn" onClick={handleCheckin} disabled={loading}>
            {loading ? '签到中...' : `确认签到（${currentSlot.label}）`}
          </button>
        </>
      )}
    </div>
  )
}
