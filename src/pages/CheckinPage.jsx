import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SLOTS, getLocalDate } from '../lib/constants'
import ZoneSeatMap from '../components/ZoneSeatMap'
import { CheckCheck, MapPin, LogOut, Clock, Timer } from 'lucide-react'

function getCurrentSlot() {
  const h = new Date().getHours()
  return SLOTS.find(s => h >= s.start && h < s.end) || null
}

function getSlotStatus(slot, currentSlot, checkinMap) {
  if (checkinMap[slot.key]) return 'checked'
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
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

const STATUS_LABELS = {
  checked: '已完成',
  active: '进行中',
  expired: '已结束',
  upcoming: '待开始',
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

  const today = getLocalDate()
  const currentSlot = getCurrentSlot()

  const checkinMap = {}
  todayCheckins.forEach(c => { checkinMap[c.time_slot] = c })
  const currentCheckin = currentSlot ? checkinMap[currentSlot.key] : null

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase.from('seat_status_today').select('*').order('seat_number')
    if (error) console.error('fetchSeats:', error.message)
    setSeats(data || [])
  }, [])

  const fetchTodayCheckins = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('checkins').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('check_date', today)
    if (error) console.error('fetchTodayCheckins:', error.message)
    setTodayCheckins(data || [])
  }, [profile, today])

  useEffect(() => {
    fetchSeats()
    fetchTodayCheckins()
  }, [fetchSeats, fetchTodayCheckins])

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
      setMsg({ type: 'error', text: error.code === '23505' ? '该时段已签到' : error.message })
    } else {
      setMsg({ type: 'success', text: `${currentSlot.label} 签到成功 // +1 积分` })
      await Promise.all([fetchTodayCheckins(), fetchSeats(), fetchProfile(profile.id)])
      setSelectedSeat(null)
    }
    setLoading(false)
  }

  async function handleCheckout() {
    if (!currentCheckin) return
    setCheckoutLoading(true); setMsg(null)
    const { error } = await supabase.rpc('checkout_checkin', { p_checkin_id: currentCheckin.id })
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '签退成功' })
      await Promise.all([fetchTodayCheckins(), fetchSeats()])
    }
    setCheckoutLoading(false)
  }

  const seatsBySlot = currentSlot
    ? seats.reduce((acc, s) => {
        const key = s.seat_id
        if (!acc[key]) acc[key] = { ...s, checkin_user: null, checkin_slot: null }
        if (s.checkin_slot === currentSlot.key) acc[key] = s
        return acc
      }, {})
    : {}
  const dedupedSeats = Object.values(seatsBySlot).map(s => ({
    ...s,
    occupied: s.checkin_slot === currentSlot?.key && !!s.checkin_user,
  }))

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'
  const outOfSlot = !currentSlot
  const alreadyChecked = currentSlot && !!currentCheckin
  const canCheckin = currentSlot && !currentCheckin

  return (
    <div className="page">
      <div className="page-header">
        <CheckCheck size={18} />
        <h2>签到</h2>
        <span className="date-badge">{today}</span>
      </div>

      <div className="slot-status-bar">
        {SLOTS.map((s, index) => {
          const status = getSlotStatus(s, currentSlot, checkinMap)
          const checkin = checkinMap[s.key]
          return (
            <div key={s.key} className={`slot-card slot-${status}`}>
              <div className="slot-card-header">
                <span className="led led-green" style={{ animationDelay: `${index * 0.3}s` }} />
                <span className="slot-label">{s.label}</span>
                <span className={`slot-badge slot-badge-${status}`}>{STATUS_LABELS[status]}</span>
              </div>
              <div className="slot-card-time">{s.start}:00 - {s.end}:00</div>
              {checkin && (
                <div className="slot-card-detail">
                  {checkin.seats?.seat_number && <span>{checkin.seats.seat_number}</span>}
                  <span>{formatTime(checkin.checked_at)}</span>
                  {checkin.checked_out_at && <span>{'>'} {formatTime(checkin.checked_out_at)}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {alreadyChecked && !currentCheckin.checked_out_at && (
        <div className="checkout-card">
          <div className="checkout-card-info">
            <div className="checkout-card-title">
              <Timer size={18} />
              <span>{currentSlot.label} // 进行中</span>
            </div>
            <div className="checkout-card-meta">
              {currentCheckin.seats?.seat_number && `座位 ${currentCheckin.seats.seat_number} // `}
              签到 {formatTime(currentCheckin.checked_at)}
            </div>
            <div className="checkout-timer">{elapsed}</div>
          </div>
          <button className="btn-checkout-lg" onClick={handleCheckout} disabled={checkoutLoading}>
            <LogOut size={20} />
            <span>{checkoutLoading ? '...' : '签退'}</span>
          </button>
        </div>
      )}

      {alreadyChecked && currentCheckin.checked_out_at && (
        <div className="checked-out-banner">
          <CheckCheck size={18} />
          <div>
            <div>{currentSlot.label} // 已完成</div>
            <div className="sub">
              {currentCheckin.seats?.seat_number && `${currentCheckin.seats.seat_number} // `}
              {formatTime(currentCheckin.checked_at)} {'>'} {formatTime(currentCheckin.checked_out_at)}
            </div>
          </div>
        </div>
      )}

      {outOfSlot && (
        <div className="out-of-slot-hint">
          <Clock size={28} />
          <div>当前不在签到时段</div>
          <small>时段: 08:00-12:00 // 14:00-18:00 // 19:00-22:00</small>
        </div>
      )}

      {canCheckin && (
        <>
          <div className="section-title"><MapPin size={14} /> 选择座位（可选）</div>
          <ZoneSeatMap
            seats={dedupedSeats}
            selectedSeat={selectedSeat}
            onSelect={setSelectedSeat}
          />
          {selectedSeat && (
            <div className="selected-hint">
              已选: {dedupedSeats.find(s => s.seat_id === selectedSeat)?.seat_number}
            </div>
          )}
          <button className="btn-primary checkin-btn" onClick={handleCheckin} disabled={loading}>
            {loading ? '处理中...' : `> 签到 (${currentSlot.label})`}
          </button>
        </>
      )}
    </div>
  )
}
