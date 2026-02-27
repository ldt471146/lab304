import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SLOTS, SLOT_LABEL, getLocalDate } from '../lib/constants'
import ZoneSeatMap from '../components/ZoneSeatMap'
import { CalendarCheck, Trash2 } from 'lucide-react'

export default function ReservePage() {
  const { profile } = useAuth()
  const [seats, setSeats] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedSlot, setSelectedSlot] = useState('morning')
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [reserveDate, setReserveDate] = useState(getLocalDate)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  const fetchSeatsForSlot = useCallback(async () => {
    const { data, error } = await supabase.from('seats')
      .select('id, seat_number, zone_row, zone_col, row_label, col_number')
      .eq('is_active', true)
      .order('seat_number')
    if (error) console.error('fetchSeatsForSlot:', error.message)
    const { data: taken, error: tErr } = await supabase.from('reservations')
      .select('seat_id').eq('reserve_date', reserveDate).eq('time_slot', selectedSlot).eq('status', 'active')
    if (tErr) console.error('fetchTaken:', tErr.message)
    const takenIds = new Set((taken || []).map(r => r.seat_id))
    setSeats((data || []).map(s => ({ ...s, taken: takenIds.has(s.id) })))
  }, [reserveDate, selectedSlot])

  const fetchMyReservations = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('reservations').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('status', 'active').gte('reserve_date', getLocalDate())
      .order('reserve_date').order('time_slot')
    if (error) console.error('fetchMyReservations:', error.message)
    setMyReservations(data || [])
  }, [profile])

  useEffect(() => {
    fetchSeatsForSlot()
    fetchMyReservations()
  }, [fetchSeatsForSlot, fetchMyReservations])

  async function handleReserve() {
    if (!selectedSeat) return
    setLoading(true); setMsg(null)
    const { error } = await supabase.from('reservations').insert({
      user_id: profile.id,
      seat_id: selectedSeat,
      reserve_date: reserveDate,
      time_slot: selectedSlot,
    })
    if (error) {
      setMsg({ type: 'error', text: error.code === '23505' ? '该座位已被预约' : error.message })
    } else {
      setMsg({ type: 'success', text: '预约成功' })
      setSelectedSeat(null)
      await Promise.all([fetchSeatsForSlot(), fetchMyReservations()])
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
    fetchSeatsForSlot()
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
          onChange={e => { setReserveDate(e.target.value); setSelectedSeat(null) }}
          className="date-input"
        />
        <div className="slot-tabs">
          {SLOTS.map(s => (
            <button key={s.key} className={`slot-tab ${selectedSlot === s.key ? 'active' : ''}`}
              onClick={() => { setSelectedSlot(s.key); setSelectedSeat(null) }}>
              <span>{s.label}</span>
              <small>{s.time}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">选择座位</div>
      <ZoneSeatMap seats={seats} selectedSeat={selectedSeat} onSelect={setSelectedSeat} occupiedKey="taken" />

      {selectedSeat && (
        <div className="selected-hint">
          已选: {seats.find(s => s.id === selectedSeat)?.seat_number}
          {' // '}{reserveDate} {SLOT_LABEL[selectedSlot]}
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
                <span>{SLOT_LABEL[r.time_slot]}</span>
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
