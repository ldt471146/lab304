import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes } from '../lib/constants'
import { Trophy, Medal } from 'lucide-react'

function getWeekRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = (start.getDay() + 6) % 7 // Monday=0
  start.setDate(start.getDate() - day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  return { start, end }
}

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('total')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchList = useCallback(async () => {
    setLoading(true)
    if (tab === 'weekly') {
      const { start, end } = getWeekRange()
      const { data, error } = await supabase
        .from('checkins')
        .select('user_id, checked_at, checked_out_at, users!inner(id, name, student_id, grade)')
        .gte('checked_at', start.toISOString())
        .lt('checked_at', end.toISOString())
        .not('checked_out_at', 'is', null)
        .limit(1000)
      if (error) {
        console.error('fetchWeeklyList:', error.message)
        setList([])
      } else {
        const map = new Map()
        for (const row of data || []) {
          const mins = Math.max(0, Math.floor((new Date(row.checked_out_at) - new Date(row.checked_at)) / 60000))
          const prev = map.get(row.user_id)
          if (!prev) {
            map.set(row.user_id, {
              id: row.users.id,
              name: row.users.name,
              student_id: row.users.student_id,
              grade: row.users.grade,
              weekly_minutes: mins,
            })
          } else {
            prev.weekly_minutes += mins
          }
        }
        const ranked = Array.from(map.values())
          .sort((a, b) => b.weekly_minutes - a.weekly_minutes)
          .slice(0, 50)
          .map((u, i) => ({ ...u, rank: i + 1 }))
        setList(ranked)
      }
    } else {
      const view = tab === 'total' ? 'leaderboard' : 'leaderboard_monthly'
      const { data, error } = await supabase.from(view).select('*').limit(50)
      if (error) console.error('fetchList:', error.message)
      setList(data || [])
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchList() }, [fetchList])

  const rankIcon = (rank) => {
    if (rank === 1) return <span className="rank-icon gold"><Trophy size={16} /></span>
    if (rank === 2) return <span className="rank-icon silver"><Medal size={16} /></span>
    if (rank === 3) return <span className="rank-icon bronze"><Medal size={16} /></span>
    return <span className="rank-num">{rank}</span>
  }

  return (
    <div className="page">
      <div className="page-header">
        <Trophy size={20} />
        <h2>排行榜</h2>
      </div>

      <div className="tab-group">
        <button className={`tab ${tab === 'total' ? 'active' : ''}`} onClick={() => setTab('total')}>总榜</button>
        <button className={`tab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>周榜</button>
        <button className={`tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>月榜</button>
      </div>

      {loading ? <div className="loading">加载中...</div> : (
        <div className="leaderboard">
          {list.map((item, i) => {
            const isMe = item.id === profile?.id
            return (
              <div key={item.id} className={`lb-item ${isMe ? 'mine' : ''} ${i < 3 ? 'top3' : ''}`}>
                <div className="lb-rank">{rankIcon(item.rank)}</div>
                <div className="lb-info">
                  <span className="lb-name">{item.name} {isMe && <span className="me-tag">我</span>}</span>
                  <span className="lb-meta">{item.grade}级 // {item.student_id}</span>
                </div>
                <div className="lb-score">
                  {tab === 'total'
                    ? <><span className="score-num">{formatMinutes(item.total_minutes)}</span></>
                    : tab === 'weekly'
                      ? <><span className="score-num">{formatMinutes(item.weekly_minutes)}</span></>
                    : <><span className="score-num">{formatMinutes(item.monthly_minutes)}</span></>
                  }
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
