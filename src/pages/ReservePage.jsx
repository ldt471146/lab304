import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AVATAR_FALLBACK, getLocalDate } from '../lib/constants'
import ZoneSeatMap from '../components/ZoneSeatMap'
import { CalendarCheck, Trash2, X } from 'lucide-react'

export default function ReservePage() {
  const { profile, fetchProfile } = useAuth()
  const [seats, setSeats] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [selectedSeat, setSelectedSeat] = useState(null)
  const [occupiedSeatInfo, setOccupiedSeatInfo] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [reserveDate, setReserveDate] = useState(getLocalDate)
  const [reserveMode, setReserveMode] = useState('single')
  const [seriesDays, setSeriesDays] = useState(3)
  const [rules, setRules] = useState(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)

  function getReserveErrorText(error) {
    const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
    if (error?.code === '23505') {
      if (raw.includes('user') || raw.includes('用户') || raw.includes('multiple') || raw.includes('same day')) {
        return '一个人不可以同时预约多个座位'
      }
      return '该座位已被预约'
    }
    if (raw.includes('限制预约')) return error?.message || '当前账号已被限制预约'
    if (raw.includes('连续预约最多')) return error?.message || '连续预约天数超过限制'
    if (raw.includes('关闭连续预约')) return error?.message || '管理员已关闭连续预约'
    return error?.message || '预约失败'
  }

  function formatComplianceText(status) {
    if (status === 'completed') return '已达标'
    if (status === 'violated') return '未达标'
    if (status === 'waived') return '已取消'
    return '待结算'
  }

  const today = getLocalDate()
  const maxContinuousDays = Number(rules?.max_continuous_days || 7)
  const continuousEnabled = Boolean(rules?.is_enabled ?? true)
  const isRestricted = Boolean(
    profile?.reservation_restricted_until && profile.reservation_restricted_until >= today
  )

  const fetchSeats = useCallback(async () => {
    const { data, error } = await supabase.from('seats')
      .select('id, seat_number, zone_row, zone_col, row_label, col_number')
      .eq('is_active', true)
      .order('seat_number')
    if (error) console.error('fetchSeats:', error.message)
    const { data: taken, error: tErr } = await supabase.from('reservations')
      .select('seat_id, user_id, users(name, student_id, grade, avatar_url, id_photo_url)')
      .eq('reserve_date', reserveDate).eq('status', 'active')
    if (tErr) console.error('fetchTaken:', tErr.message)
    const { data: activeCheckins, error: cErr } = await supabase.from('checkins')
      .select('seat_id, user_id')
      .eq('check_date', reserveDate)
      .is('checked_out_at', null)
    if (cErr) console.error('fetchActiveCheckins:', cErr.message)
    const takenBySeat = new Map((taken || []).map(r => [r.seat_id, r]))
    const checkedInBySeat = new Set(
      (activeCheckins || []).map(c => `${c.seat_id}:${c.user_id}`)
    )
    setSeats((data || []).map(s => {
      const reservation = takenBySeat.get(s.id) || null
      const reserveUser = reservation?.users || null
      const isMine = reservation?.user_id === profile?.id
      const occupancyStatus = reservation && checkedInBySeat.has(`${reservation.seat_id}:${reservation.user_id}`)
        ? 'checked_in'
        : 'reserved'
      return {
        ...s,
        taken: !!reservation,
        reserve_user: reserveUser,
        reserve_user_id: reservation?.user_id || null,
        occupancy_status: reservation ? occupancyStatus : null,
        occupiedTitle: reservation
          ? (isMine ? `你已预约 ${s.seat_number}` : `${reserveUser?.name || '其他同学'} 已预约`)
          : s.seat_number,
      }
    }))
  }, [reserveDate, profile?.id])

  const fetchMyReservations = useCallback(async () => {
    if (!profile) return
    const { data, error } = await supabase.from('reservations')
      .select('id, seat_id, reserve_date, status, series_id, compliance_status, seats(seat_number)')
      .eq('user_id', profile.id)
      .eq('status', 'active')
      .gte('reserve_date', today)
      .order('reserve_date')
    if (error) console.error('fetchMyReservations:', error.message)
    setMyReservations(data || [])
  }, [profile, today])

  const fetchRules = useCallback(async () => {
    const { data, error } = await supabase
      .from('reservation_rules')
      .select('id, is_enabled, min_study_minutes, max_continuous_days, penalty_points, strike_value, strike_threshold, restrict_days')
      .eq('id', true)
      .maybeSingle()
    if (error) {
      console.error('fetchRules:', error.message)
      return
    }
    setRules(data || null)
  }, [])

  useEffect(() => {
    fetchSeats()
    fetchMyReservations()
    fetchRules()
  }, [fetchSeats, fetchMyReservations, fetchRules])

  useEffect(() => {
    setOccupiedSeatInfo(null)
    setPhotoPreview(null)
  }, [reserveDate])

  useEffect(() => {
    if (!photoPreview) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPhotoPreview(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photoPreview])

  function getSeatOccupantPhoto(seat) {
    return seat?.reserve_user?.id_photo_url
      || seat?.reserve_user?.avatar_url
      || AVATAR_FALLBACK(seat?.reserve_user?.student_id || seat?.reserve_user?.name || 'user')
  }

  function getSeatOccupancyStatusText(seat) {
    return seat?.occupancy_status === 'checked_in' ? '已签到' : '已预约，未签到'
  }

  function openSeatPhotoPreview(seat) {
    setPhotoPreview({
      src: getSeatOccupantPhoto(seat),
      title: `${seat?.reserve_user?.name || '用户'}的照片`,
      hint: seat?.reserve_user?.id_photo_url ? '个人照片' : '未上传个人照片，当前显示头像',
    })
  }

  async function handleReserve() {
    if (!selectedSeat) return
    if (isRestricted) {
      setMsg({ type: 'error', text: `当前账号已被限制预约，截止到 ${profile?.reservation_restricted_until}` })
      return
    }
    if (reserveMode === 'continuous' && !continuousEnabled) {
      setMsg({ type: 'error', text: '管理员已关闭连续预约' })
      return
    }
    setLoading(true)
    setMsg(null)

    let error = null
    let successText = '预约成功'
    if (reserveMode === 'continuous') {
      const normalizedDays = Math.max(1, Math.min(maxContinuousDays, Number(seriesDays) || 1))
      const { error: rpcError } = await supabase.rpc('create_reservation_series', {
        p_seat_id: selectedSeat,
        p_start_date: reserveDate,
        p_days: normalizedDays,
        p_time_slot: 'allday',
      })
      error = rpcError
      successText = `连续预约成功（${normalizedDays} 天）`
    } else {
      const { error: rpcError } = await supabase.rpc('create_reservation_with_rules', {
        p_seat_id: selectedSeat,
        p_reserve_date: reserveDate,
        p_time_slot: 'allday',
      })
      error = rpcError
    }

    if (error) {
      setMsg({ type: 'error', text: getReserveErrorText(error) })
    } else {
      setMsg({ type: 'success', text: successText })
      setSelectedSeat(null)
      await Promise.all([fetchSeats(), fetchMyReservations(), fetchProfile(profile.id)])
    }
    setLoading(false)
  }

  async function handleCancel(reservation) {
    const { data: activeCheckins, error: findError } = await supabase
      .from('checkins')
      .select('id')
      .eq('user_id', profile.id)
      .eq('check_date', reservation.reserve_date)
      .eq('seat_id', reservation.seat_id)
      .is('checked_out_at', null)
    if (findError) {
      setMsg({ type: 'error', text: findError.message })
      return
    }
    if (activeCheckins?.length) {
      const results = await Promise.all(
        activeCheckins.map(c => supabase.rpc('checkout_checkin', { p_checkin_id: c.id }))
      )
      const checkoutError = results.find(r => r.error)?.error
      if (checkoutError) {
        setMsg({ type: 'error', text: checkoutError.message })
        return
      }
    }

    const { error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled', compliance_status: 'waived' })
      .eq('id', reservation.id)
    if (error) {
      setMsg({ type: 'error', text: error.message })
      return
    }
    setMsg({ type: 'success', text: '已取消预约，并结束对应学习计时' })
    await Promise.all([
      fetchMyReservations(),
      fetchSeats(),
      fetchProfile(profile.id),
    ])
  }

  return (
    <div className="page">
      <div className="page-header">
        <CalendarCheck size={18} />
        <h2>预约占座</h2>
      </div>

      <div className="reserve-controls">
        <input type="date" value={reserveDate}
          min={today}
          onChange={e => { setReserveDate(e.target.value); setSelectedSeat(null); setOccupiedSeatInfo(null) }}
          className="date-input"
        />
        {reserveMode === 'continuous' && (
          <label className="reserve-days-wrap">
            <span className="reserve-days-label">连续天数</span>
            <input
              className="date-input reserve-days-input"
              type="number"
              min={1}
              max={maxContinuousDays}
              value={seriesDays}
              onChange={(e) => setSeriesDays(e.target.value)}
            />
            <span className="reserve-days-tip">最多 {maxContinuousDays} 天</span>
          </label>
        )}
      </div>
      <div className="tab-group reserve-mode-tabs">
        <button
          className={`tab ${reserveMode === 'single' ? 'active' : ''}`}
          onClick={() => setReserveMode('single')}
          type="button"
        >
          单日预约
        </button>
        <button
          className={`tab ${reserveMode === 'continuous' ? 'active' : ''}`}
          onClick={() => setReserveMode('continuous')}
          type="button"
        >
          连续预约
        </button>
      </div>
      {rules && (
        <div className="reserve-rule-hint">
          每日达标 {rules.min_study_minutes} 分钟 // 连续最多 {rules.max_continuous_days} 天 // 未达标扣 {rules.penalty_points} 分并记 {rules.strike_value} 次
        </div>
      )}
      {isRestricted && (
        <div className="msg error">
          当前账号已被限制预约，截止到 {profile?.reservation_restricted_until}
        </div>
      )}

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
            <button
              type="button"
              className="au-photo-trigger seat-owner-photo-trigger"
              onClick={() => openSeatPhotoPreview(occupiedSeatInfo)}
            >
              <img
                className="au-photo-trigger-img seat-owner-photo-img"
                src={getSeatOccupantPhoto(occupiedSeatInfo)}
                alt={`${occupiedSeatInfo.reserve_user.name || '用户'}照片`}
              />
              <span className="au-photo-trigger-hint">
                {occupiedSeatInfo.reserve_user.id_photo_url ? '点击查看个人照片大图' : '未上传个人照片，点击查看头像'}
              </span>
            </button>
            <div className="seat-owner-meta">
              <div className="seat-owner-name">{occupiedSeatInfo.reserve_user.name || '未命名用户'}</div>
              <div>{occupiedSeatInfo.reserve_user.grade || '--'}级 // {occupiedSeatInfo.reserve_user.student_id || '--'}</div>
              <div className={`seat-owner-status ${occupiedSeatInfo.occupancy_status === 'checked_in' ? 'checked-in' : 'reserved'}`}>
                当前状态：{getSeatOccupancyStatusText(occupiedSeatInfo)}
              </div>
            </div>
          </div>
        </div>
      )}
      {photoPreview && (
        <div className="au-preview-overlay" onClick={() => setPhotoPreview(null)}>
          <div className="au-preview-shell" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className="au-preview-close"
              onClick={() => setPhotoPreview(null)}
              aria-label="关闭大图预览"
            >
              <X size={18} />
            </button>
            <img
              className="au-preview-image"
              src={photoPreview.src}
              alt={photoPreview.title}
            />
            <div className="au-preview-caption">
              <strong>{photoPreview.title}</strong>
              <span>{photoPreview.hint}</span>
            </div>
          </div>
        </div>
      )}
      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
      <button
        className="btn-primary"
        onClick={handleReserve}
        disabled={loading || !selectedSeat || isRestricted || (reserveMode === 'continuous' && !continuousEnabled)}
      >
        {loading ? '处理中...' : (reserveMode === 'continuous' ? '> 确认连续预约' : '> 确认预约')}
      </button>

      {myReservations.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: '2rem' }}>我的预约</div>
          <div className="reservation-list">
            {myReservations.map(r => (
              <div key={r.id} className="reservation-item">
                <span className="seat-tag">{r.seats?.seat_number}</span>
                <span>{r.reserve_date}</span>
                {r.series_id && <span className="seat-tag">连约</span>}
                <span>{formatComplianceText(r.compliance_status)}</span>
                <button className="icon-btn danger" onClick={() => handleCancel(r)}>
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
