import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes } from '../lib/constants'
import { Trophy, Medal } from 'lucide-react'

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('total')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchList = useCallback(async () => {
    setLoading(true)
    const view = tab === 'total' ? 'leaderboard' : 'leaderboard_monthly'
    const { data, error } = await supabase.from(view).select('*').limit(50)
    if (error) console.error('fetchList:', error.message)
    setList(data || [])
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
