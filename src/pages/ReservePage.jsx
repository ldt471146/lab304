import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CalendarCheck, Trash2 } from 'lucide-react'

const SLOTS = [
  { key: 'morning', label: '上午', time: '08:00 - 12:00' },
  { key: 'afternoon', label: '下午', time: '14:00 - 18:00' },
  { key: 'evening', label: '晚上', time: '19:00 - 22:00' },
]

export default function ReservePage() {
  const { profile } = useAuth()
  const [seats, setSeats] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedSlot, setSelectedSlot] = useState('morning')
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [reserveDate, setReserveDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    fetchSeatsForSlot()
    fetchMyReservations()
  }, [reserveDate, selectedSlot])

  async function fetchSeatsForSlot() {
    const { data } = await supabase.from('seats').select('id, seat_number, row_label, col_number').eq('is_active', true).order('seat_number')
    // 查该日期该时段已有预约
    const { data: taken } = await supabase.from('reservations')
      .select('seat_id').eq('reserve_date', reserveDate).eq('time_slot', selectedSlot).eq('status', 'active')
    const takenIds = new Set((taken || []).map(r => r.seat_id))
    setSeats((data || []).map(s => ({ ...s, taken: takenIds.has(s.id) })))
  }

  async function fetchMyReservations() {
    if (!profile) return
    const { data } = await supabase.from('reservations').select('*, seats(seat_number)')
      .eq('user_id', profile.id).eq('status', 'active').gte('reserve_date', new Date().toISOString().split('T')[0])
      .order('reserve_date').order('time_slot')
    setMyReservations(data || [])
  }

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
      setMsg({ type: 'error', text: error.code === '23505' ? '该座位该时段已被预约' : error.message })
    } else {
      setMsg({ type: 'success', text: '预约成功！' })
      setSelectedSeat(null)
      await Promise.all([fetchSeatsForSlot(), fetchMyReservations()])
    }
    setLoading(false)
  }

  async function handleCancel(id) {
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id)
    fetchMyReservations()
    fetchSeatsForSlot()
  }

  const SLOT_LABEL = { morning: '上午', afternoon: '下午', evening: '晚上' }
  const rows = [...new Set(seats.map(s => s.row_label))].sort()

  return (
    <div className="page">
      <div className="page-header">
        <CalendarCheck size={20} />
        <h2>预约占座</h2>
      </div>

      <div className="reserve-controls">
        <input type="date" value={reserveDate}
          min={new Date().toISOString().split('T')[0]}
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
      <div className="seat-map">
        {rows.map(row => (
          <div key={row} className="seat-row">
            <span className="row-label">{row}</span>
            {seats.filter(s => s.row_label === row).map(seat => {
              const mine = selectedSeat === seat.id
              return (
                <button key={seat.id}
                  className={`seat ${seat.taken ? 'occupied' : ''} ${mine ? 'selected' : ''}`}
                  onClick={() => !seat.taken && setSelectedSeat(mine ? null : seat.id)}
                  title={seat.taken ? '已被预约' : seat.seat_number}
                  disabled={seat.taken}>
                  {seat.col_number}
                </button>
              )
            })}
          </div>
        ))}
        <div className="seat-legend">
          <span className="legend-dot available" /> 空闲
          <span className="legend-dot occupied" /> 已预约
          <span className="legend-dot selected" /> 已选
        </div>
      </div>

      {selectedSeat && (
        <div className="selected-hint">
          已选：{seats.find(s => s.id === selectedSeat)?.seat_number}
          &nbsp;·&nbsp;{reserveDate}&nbsp;{SLOT_LABEL[selectedSlot]}
        </div>
      )}
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      <button className="btn-primary" onClick={handleReserve} disabled={loading || !selectedSeat}>
        {loading ? '预约中...' : '确认预约'}
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
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
