import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AVATAR_FALLBACK, getLocalDate } from '../lib/constants'
import ZoneSeatMap from '../components/ZoneSeatMap'
import { CalendarCheck, Trash2 } from 'lucide-react'

export default function ReservePage() {
  const { profile } = useAuth()
  const [seats, setSeats] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [occupiedSeatInfo, setOccupiedSeatInfo] = useState(null)
  const [reserveDate, setReserveDate] = useState(getLocalDate)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase.from('seats')
      .select('id, seat_number, zone_row, zone_col, row_label, col_number')
      .eq('is_active', true)
      .order('seat_number')
    if (error) console.error('fetchSeats:', error.message)
    const { data: taken, error: tErr } = await supabase.from('reservations')
      .select('seat_id, user_id, users(name, student_id, grade, avatar_url)')
      .eq('reserve_date', reserveDate).eq('status', 'active')
    if (tErr) console.error('fetchTaken:', tErr.message)
    const takenBySeat = new Map((taken || []).map(r => [r.seat_id, r]))
    setSeats((data || []).map(s => {
      const reservation = takenBySeat.get(s.id) || null
      const reserveUser = reservation?.users || null
      const isMine = reservation?.user_id === profile?.id
      return {
        ...s,
        taken: !!reservation,
        reserve_user: reserveUser,
        reserve_user_id: reservation?.user_id || null,
        occupiedTitle: reservation
          ? (isMine ? `你已预约 ${s.seat_number}` : `${reserveUser?.name || '其他同学'} 已预约`)
          : s.seat_number,
      }
    }))
  }, [reserveDate, profile?.id])

  const fetchMyReservations = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('reservations').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('status', 'active').gte('reserve_date', getLocalDate())
      .order('reserve_date')
    if (error) console.error('fetchMyReservations:', error.message)
    setMyReservations(data || [])
  }, [profile])

  useEffect(() => {
    fetchSeats()
    fetchMyReservations()
  }, [fetchSeats, fetchMyReservations])

  useEffect(() => {
    setOccupiedSeatInfo(null)
  }, [reserveDate])

  async function handleReserve() {
    if (!selectedSeat) return
    setLoading(true); setMsg(null)
    const { error } = await supabase.from('reservations').insert({
      user_id: profile.id,
      seat_id: selectedSeat,
      reserve_date: reserveDate,
      time_slot: 'allday',
    })
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? '该座位已被预约' : error.message })
    } else {
      setMsg({ type: 'success', text: '预约成功' })
      setSelectedSeat(null)
      await Promise.all([fetchSeats(), fetchMyReservations()])
    }
    setLoading(false)
  }

  async function handleCancel(id) {
    const { error } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    fetchMyReservations()
    fetchSeats()
  }

  return (
    <div className="page">
      <div className="page-header">
        <CalendarCheck size={18} />
        <h2>预约占座</h2>
      </div>

      <div className="reserve-controls">
        <input type="date" value={reserveDate}
          min={getLocalDate()}
          onChange={e => { setReserveDate(e.target.value); setSelectedSeat(null); setOccupiedSeatInfo(null) }}
          className="date-input"
        />
      </div>

      <div className="section-title">选择座位</div>
      <ZoneSeatMap
        seats={seats}
        selectedSeat={selectedSeat}
        onSelect={(seatId) => {
          setSelectedSeat(seatId)
          setOccupiedSeatInfo(null)
        }}
        occupiedKey="taken"
        onOccupiedClick={(seat) => setOccupiedSeatInfo(seat)}
      />

      {selectedSeat && (
        <div className="selected-hint">
          已选: {seats.find(s => s.id === selectedSeat)?.seat_number}
          {' // '}{reserveDate}
        </div>
      )}

      {occupiedSeatInfo?.reserve_user && (
        <div className="seat-owner-card">
          <div className="seat-owner-title">
            座位 {occupiedSeatInfo.seat_number} 已被预约
          </div>
          <div className="seat-owner-body">
            <img
              className="seat-owner-avatar"
              src={occupiedSeatInfo.reserve_user.avatar_url || AVATAR_FALLBACK(occupiedSeatInfo.reserve_user.student_id || occupiedSeatInfo.reserve_user.name || 'user')}
              alt=""
            />
            <div className="seat-owner-meta">
              <div className="seat-owner-name">{occupiedSeatInfo.reserve_user.name || '未命名用户'}</div>
              <div>{occupiedSeatInfo.reserve_user.grade || '--'}级 // {occupiedSeatInfo.reserve_user.student_id || '--'}</div>
            </div>
          </div>
        </div>
      )}
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      <button className="btn-primary" onClick={handleReserve} disabled={loading || !selectedSeat}>
        {loading ? '处理中...' : '> 确认预约'}
      </button>

      {myReservations.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: '2rem' }}>我的预约</div>
          <div className="reservation-list">
            {myReservations.map(r => (
              <div key={r.id} className="reservation-item">
                <span className="seat-tag">{r.seats?.seat_number}</span>
                <span>{r.reserve_date}</span>
                <button className="icon-btn danger" onClick={() => handleCancel(r.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
