import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isOpenNow, OPEN_HOUR, CLOSE_HOUR, getLocalDate, formatMinutes } from '../lib/constants'
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
  const [todayCheckins, setTodayCheckins] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [elapsed, setElapsed] = useState('')

  const today = getLocalDate()
  const open = isOpenNow()

  const activeCheckin = todayCheckins.find(c => !c.checked_out_at) || null
  const finishedCheckins = todayCheckins.filter(c => c.checked_out_at)
  const canCheckin = open && !activeCheckin

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase.from('seat_status_today').select('*').order('seat_number')
    if (error) console.error('fetchSeats:', error.message)
    setSeats(data || [])
  }, [])

  const fetchTodayCheckins = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('checkins').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('check_date', today).order('checked_at', { ascending: false })
    if (error) console.error('fetchTodayCheckins:', error.message)
    setTodayCheckins(data || [])
  }, [profile, today])

  useEffect(() => {
    fetchSeats()
    fetchTodayCheckins()
  }, [fetchSeats, fetchTodayCheckins])

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
    setLoading(true); setMsg(null)
    const payload = { user_id: profile.id, check_date: today, time_slot: 'allday' }
    if (selectedSeat) payload.seat_id = selectedSeat
    const { error } = await supabase.from('checkins').insert(payload)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      const isFirst = todayCheckins.length === 0
      setMsg({ type: 'success', text: isFirst ? '签到成功 // +1 积分' : '签到成功' })
      await Promise.all([fetchTodayCheckins(), fetchSeats(), fetchProfile(profile.id)])
      setSelectedSeat(null)
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
      await Promise.all([fetchTodayCheckins(), fetchSeats(), fetchProfile(profile.id)])
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
