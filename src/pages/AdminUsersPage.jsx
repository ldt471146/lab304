import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes } from '../lib/constants'
import { AVATAR_FALLBACK } from '../lib/constants'
import { Users, Search, Clock, Star } from 'lucide-react'

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/', { replace: true })
  }, [profile, navigate])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase
      .from('users')
      .select('name, student_id, grade, points, total_minutes, created_at, avatar_url')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [profile])

  if (!profile?.is_admin) return null

  const filtered = query
    ? users.filter(u => u.name?.includes(query) || u.student_id?.includes(query))
    : users

  return (
    <div className="page">
      <div className="page-header">
        <Users size={20} />
        <h2>用户管理</h2>
        <span className="date-badge">{filtered.length} 人</span>
      </div>

      <div className="au-search">
        <Search size={14} className="au-search-icon" />
        <input
          type="text"
          placeholder="搜索姓名或学号..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {loading ? <div className="loading">加载中...</div> : (
        <div className="au-list">
          {filtered.map(u => (
            <div key={u.student_id} className="au-item">
              <img
                className="au-avatar"
                src={u.avatar_url || AVATAR_FALLBACK(u.student_id)}
                alt=""
              />
              <div className="au-info">
                <span className="au-name">{u.name}</span>
                <span className="au-meta">{u.grade}级 // {u.student_id}</span>
              </div>
              <div className="au-stats">
                <span className="au-stat">
                  <Star size={12} />
                  {u.points ?? 0}
                </span>
                <span className="au-stat">
                  <Clock size={12} />
                  {formatMinutes(u.total_minutes)}
                </span>
              </div>
              <span className="au-date">{new Date(u.created_at).toLocaleDateString('zh-CN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
