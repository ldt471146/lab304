import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CheckCircle, Clock, Star, Calendar } from 'lucide-react'

export default function Dashboard() {
  const { profile } = useAuth()
  const [todayCheckin, setTodayCheckin] = useState(null)
  const [myReservations, setMyReservations] = useState([])
  const [myRank, setMyRank] = useState(null)

  useEffect(() => {
    if (!profile) return
    fetchData()
  }, [profile])

  async function fetchData() {
    const today = new Date().toISOString().split('T')[0]
    const [checkinRes, reserveRes, rankRes] = await Promise.all([
      supabase.from('checkins').select('*, seats(seat_number)').eq('user_id', profile.id).eq('check_date', today).maybeSingle(),
      supabase.from('reservations').select('*, seats(seat_number)').eq('user_id', profile.id).eq('reserve_date', today).eq('status', 'active'),
      supabase.from('leaderboard').select('rank, grade_rank').eq('id', profile.id).maybeSingle(),
    ])
    setTodayCheckin(checkinRes.data)
    setMyReservations(reserveRes.data || [])
    setMyRank(rankRes.data)
  }

  const SLOT_LABEL = { morning: '上午', afternoon: '下午', evening: '晚上' }
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return '早上好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  if (!profile) return <div className="loading">加载中...</div>

  return (
    <div className="page">
      <div className="dashboard-hero">
        <div>
          <h2>{greeting()}，{profile.name}</h2>
          <span className="badge">{profile.grade} 级 · {profile.student_id}</span>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-num">{profile.checkin_count}</span>
            <span className="stat-label">累计签到</span>
          </div>
          <div className="stat">
            <span className="stat-num">{profile.points}</span>
            <span className="stat-label">积分</span>
          </div>
          <div className="stat">
            <span className="stat-num">#{myRank?.rank ?? '--'}</span>
            <span className="stat-label">总排名</span>
          </div>
        </div>
      </div>

      <div className="card-grid">
        <div className={`status-card ${todayCheckin ? 'checked' : 'unchecked'}`}>
          <CheckCircle size={24} />
          <div>
            <div className="status-title">今日签到</div>
            <div className="status-sub">
              {todayCheckin
                ? `已签到${todayCheckin.seats ? ' · ' + todayCheckin.seats.seat_number : ''}`
                : '尚未签到'}
            </div>
          </div>
        </div>

        <div className="status-card info">
          <Star size={24} />
          <div>
            <div className="status-title">学级排名</div>
            <div className="status-sub">{profile.grade} 级第 {myRank?.grade_rank ?? '--'} 名</div>
          </div>
        </div>
      </div>

      <div className="section-title"><Calendar size={16} /> 今日预约</div>
      {myReservations.length === 0
        ? <div className="empty-hint">今天暂无预约，去预约一个座位吧</div>
        : (
          <div className="reservation-list">
            {myReservations.map(r => (
              <div key={r.id} className="reservation-item">
                <Clock size={15} />
                <span>{SLOT_LABEL[r.time_slot]}</span>
                <span className="seat-tag">{r.seats?.seat_number}</span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}
