import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isOpenNow, OPEN_HOUR, CLOSE_HOUR, getLocalDate, formatMinutes } from '../lib/constants'
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
  const navigate = useNavigate()
  const [todayCheckins, setTodayCheckins] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedReservationId, setSelectedReservationId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [elapsed, setElapsed] = useState('')

  const today = getLocalDate()
  const open = isOpenNow()

  const activeCheckin = todayCheckins.find(c => !c.checked_out_at) || null
  const finishedCheckins = todayCheckins.filter(c => c.checked_out_at)
  const canCheckin = open && !activeCheckin && myReservations.length > 0

  const fetchTodayCheckins = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('checkins').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('check_date', today).order('checked_at', { ascending: false })
    if (error) console.error('fetchTodayCheckins:', error.message)
    setTodayCheckins(data || [])
  }, [profile, today])

  const fetchMyReservations = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase
      .from('reservations')
      .select('id, seat_id, reserve_date, status, seats(seat_number)')
      .eq('user_id', profile.id)
      .eq('reserve_date', today)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    if (error) console.error('fetchMyReservations:', error.message)
    setMyReservations(data || [])
  }, [profile, today])

  useEffect(() => {
    fetchTodayCheckins()
    fetchMyReservations()
  }, [fetchTodayCheckins, fetchMyReservations])

  useEffect(() => {
    if (myReservations.length === 1) {
      setSelectedReservationId(myReservations[0].id)
      return
    }
    if (myReservations.length === 0) {
      setSelectedReservationId(null)
      return
    }
    const exists = myReservations.some(r => r.id === selectedReservationId)
    if (!exists) setSelectedReservationId(myReservations[0].id)
  }, [myReservations, selectedReservationId])

  useEffect(() => {
    if (!activeCheckin) { setElapsed(''); return }
    const tick = () => {
      const diff = Date.now() - new Date(activeCheckin.checked_at).getTime()
      setElapsed(formatDuration(diff))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeCheckin])

  const todayTotalMinutes = (() => {
    let sum = 0
    for (const c of finishedCheckins) {
      sum += Math.max(0, (new Date(c.checked_out_at) - new Date(c.checked_at)) / 60000)
    }
    if (activeCheckin) {
      sum += Math.max(0, (Date.now() - new Date(activeCheckin.checked_at).getTime()) / 60000)
    }
    return Math.floor(sum)
  })()

  async function handleCheckin() {
    if (!profile || !open) return
    const reservation = myReservations.find(r => r.id === selectedReservationId)
    if (!reservation) {
      setMsg({ type: 'error', text: '请先预约今日座位后再签到' })
      return
    }
    setLoading(true); setMsg(null)
    const { error } = await supabase.from('checkins').insert({
      user_id: profile.id,
      check_date: today,
      time_slot: 'allday',
      seat_id: reservation.seat_id,
    })
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '签到成功' })
      await Promise.all([fetchTodayCheckins(), fetchMyReservations(), fetchProfile(profile.id)])
    }
    setLoading(false)
  }

  async function handleCheckout() {
    if (!activeCheckin) return
    setCheckoutLoading(true); setMsg(null)
    const { error } = await supabase.rpc('checkout_checkin', { p_checkin_id: activeCheckin.id })
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: '签退成功' })
      await Promise.all([fetchTodayCheckins(), fetchMyReservations(), fetchProfile(profile.id)])
    }
    setCheckoutLoading(false)
  }

  const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'

  return (
    <div className="page">
      <div className="page-header">
        <CheckCheck size={18} />
        <h2>签到</h2>
        <span className="date-badge">{today}</span>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {todayCheckins.length > 0 && (
        <div className="today-study-summary">
          <Clock size={16} />
          <span>今日学习: {formatMinutes(todayTotalMinutes)}</span>
        </div>
      )}

      {activeCheckin && (
        <div className="checkout-card">
          <div className="checkout-card-info">
            <div className="checkout-card-title">
              <Timer size={18} />
              <span>学习中</span>
            </div>
            <div className="checkout-card-meta">
              {activeCheckin.seats?.seat_number && `座位 ${activeCheckin.seats.seat_number} // `}
              签到 {formatTime(activeCheckin.checked_at)}
            </div>
            <div className="checkout-timer">{elapsed}</div>
          </div>
          <button className="btn-checkout-lg" onClick={handleCheckout} disabled={checkoutLoading}>
            <LogOut size={20} />
            <span>{checkoutLoading ? '...' : '签退'}</span>
          </button>
        </div>
      )}

      {finishedCheckins.length > 0 && (
        <div className="finished-checkins-compact">
          <div className="finished-header">
            <CheckCheck size={14} />
            <span>今日记录 ({finishedCheckins.length})</span>
          </div>
          {finishedCheckins.map(c => {
            const mins = Math.floor(Math.max(0, (new Date(c.checked_out_at) - new Date(c.checked_at)) / 60000))
            return (
              <div key={c.id} className="finished-row">
                <span className="finished-time">{formatTime(c.checked_at)} → {formatTime(c.checked_out_at)}</span>
                <span className="finished-dur">{formatMinutes(mins)}</span>
              </div>
            )
          })}
        </div>
      )}

      {!open && (
        <div className="out-of-slot-hint">
          <Clock size={28} />
          <div>当前不在开放时间</div>
          <small>开放时段: {OPEN_HOUR}:00 - {CLOSE_HOUR}:00</small>
        </div>
      )}

      {open && !activeCheckin && myReservations.length === 0 && (
        <div className="out-of-slot-hint">
          <MapPin size={28} />
          <div>今天还没有预约座位</div>
          <small>请先预约后再签到</small>
          <button className="btn-primary" style={{ marginTop: '0.8rem' }} onClick={() => navigate('/reserve')}>
            {'> 去预约'}
          </button>
        </div>
      )}

      {canCheckin && (
        <>
          <div className="section-title"><MapPin size={14} /> 选择今日预约座位</div>
          <select
            className="date-input"
            value={selectedReservationId || ''}
            onChange={(e) => setSelectedReservationId(Number(e.target.value))}
          >
            {myReservations.map(r => (
              <option key={r.id} value={r.id}>
                {r.seats?.seat_number || `座位ID ${r.seat_id}`} // {r.reserve_date}
              </option>
            ))}
          </select>
          {selectedReservationId && (
            <div className="selected-hint">
              已选: {myReservations.find(r => r.id === selectedReservationId)?.seats?.seat_number || '--'}
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
