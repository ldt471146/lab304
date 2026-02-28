import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isOpenNow, OPEN_HOUR, CLOSE_HOUR, getLocalDate } from '../lib/constants'
import ZoneSeatMap from '../components/ZoneSeatMap'
import { CheckCheck, MapPin, LogOut, Clock, Timer } from 'lucide-react'

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export default function CheckinPage() {
  const { profile, fetchProfile } = useAuth()
  const [seats, setSeats] = useState([])
  const [todayCheckin, setTodayCheckin] = useState(null)
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [elapsed, setElapsed] = useState('')

  const today = getLocalDate()
  const open = isOpenNow()

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase.from('seat_status_today').select('*').order('seat_number')
    if (error) console.error('fetchSeats:', error.message)
    setSeats(data || [])
  }, [])

  const fetchTodayCheckin = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('checkins').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('check_date', today).maybeSingle()
    if (error) console.error('fetchTodayCheckin:', error.message)
    setTodayCheckin(data || null)
  }, [profile, today])

  useEffect(() => {
    fetchSeats()
    fetchTodayCheckin()
  }, [fetchSeats, fetchTodayCheckin])

  useEffect(() => {
    if (!todayCheckin || todayCheckin.checked_out_at) return
    const tick = () => {
      const diff = Date.now() - new Date(todayCheckin.checked_at).getTime()
      setElapsed(formatDuration(diff))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [todayCheckin])

  async function handleCheckin() {
    if (!profile || !open) return
    setLoading(true); setMsg(null)
    const payload = { user_id: profile.id, check_date: today, time_slot: 'allday' }
    if (selectedSeat) payload.seat_id = selectedSeat
    const { error } = await supabase.from('checkins').insert(payload)
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? '今日已签到' : error.message })
    } else {
      setMsg({ type: 'success', text: '签到成功 // +1 积分' })
      await Promise.all([fetchTodayCheckin(), fetchSeats(), fetchProfile(profile.id)])
      setSelectedSeat(null)
    }
    setLoading(false)
  }

  async function handleCheckout() {
    if (!todayCheckin) return
    setCheckoutLoading(true); setMsg(null)
    const { error } = await supabase.rpc('checkout_checkin', { p_checkin_id: todayCheckin.id })
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '签退成功' })
      await Promise.all([fetchTodayCheckin(), fetchSeats()])
    }
    setCheckoutLoading(false)
  }

  const seatMap = seats.reduce((acc, s) => {
    if (!acc[s.seat_id]) acc[s.seat_id] = { ...s, checkin_user: null }
    if (s.checkin_user) acc[s.seat_id] = s
    return acc
  }, {})
  const dedupedSeats = Object.values(seatMap).map(s => ({
    ...s,
    occupied: !!s.checkin_user,
  }))

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'
  const alreadyChecked = !!todayCheckin
  const canCheckin = open && !todayCheckin

  return (
    <div className="page">
      <div className="page-header">
        <CheckCheck size={18} />
        <h2>签到</h2>
        <span className="date-badge">{today}</span>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {alreadyChecked && !todayCheckin.checked_out_at && (
        <div className="checkout-card">
          <div className="checkout-card-info">
            <div className="checkout-card-title">
              <Timer size={18} />
              <span>签到中</span>
            </div>
            <div className="checkout-card-meta">
              {todayCheckin.seats?.seat_number && `座位 ${todayCheckin.seats.seat_number} // `}
              签到 {formatTime(todayCheckin.checked_at)}
            </div>
            <div className="checkout-timer">{elapsed}</div>
          </div>
          <button className="btn-checkout-lg" onClick={handleCheckout} disabled={checkoutLoading}>
            <LogOut size={20} />
            <span>{checkoutLoading ? '...' : '签退'}</span>
          </button>
        </div>
      )}

      {alreadyChecked && todayCheckin.checked_out_at && (
        <div className="checked-out-banner">
          <CheckCheck size={18} />
          <div>
            <div>今日已完成</div>
            <div className="sub">
              {todayCheckin.seats?.seat_number && `${todayCheckin.seats.seat_number} // `}
              {formatTime(todayCheckin.checked_at)} {'>'} {formatTime(todayCheckin.checked_out_at)}
            </div>
          </div>
        </div>
      )}

      {!open && (
        <div className="out-of-slot-hint">
          <Clock size={28} />
          <div>当前不在开放时间</div>
          <small>开放时段: {OPEN_HOUR}:00 - {CLOSE_HOUR}:00</small>
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
            {loading ? '处理中...' : '> 签到'}
          </button>
        </>
      )}
    </div>
  )
}
