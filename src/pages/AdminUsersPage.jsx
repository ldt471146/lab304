import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes, AVATAR_FALLBACK } from '../lib/constants'
import { Users, Search, Clock, Star, Trash2, X } from 'lucide-react'

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [confirmUser, setConfirmUser] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/', { replace: true })
  }, [profile, navigate])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase
      .from('users')
      .select('id, name, student_id, grade, points, total_minutes, created_at, avatar_url, email')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [profile])

  if (!profile?.is_admin) return null

  const filtered = query
    ? users.filter(u => u.name?.includes(query) || u.student_id?.includes(query))
    : users

  async function handleDelete() {
    if (!confirmUser) return
    setDeleting(true)
    const { error } = await supabase.rpc('admin_delete_user', { target_user_id: confirmUser.id })
    setDeleting(false)
    if (error) {
      alert('删除失败：' + error.message)
    } else {
      setUsers(prev => prev.filter(u => u.id !== confirmUser.id))
      setConfirmUser(null)
    }
  }

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
                <span className="au-meta">{u.grade}级 // {u.student_id} // {u.email || '--'}</span>
              </div>
              <div className="au-stats">
                <span className="au-stat"><Star size={12} />{u.points ?? 0}</span>
                <span className="au-stat"><Clock size={12} />{formatMinutes(u.total_minutes)}</span>
              </div>
              <span className="au-date">{new Date(u.created_at).toLocaleDateString('zh-CN')}</span>
              {u.id !== profile.id && (
                <button className="au-del-btn" onClick={() => setConfirmUser(u)} title="删除用户">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmUser && (
        <div className="au-modal-overlay" onClick={() => setConfirmUser(null)}>
          <div className="au-modal" onClick={e => e.stopPropagation()}>
            <div className="au-modal-header">
              <span>确认删除</span>
              <button className="au-modal-close" onClick={() => setConfirmUser(null)}><X size={16} /></button>
            </div>
            <div className="au-modal-body">
              <p>即将删除用户 <strong>{confirmUser.name}</strong>（{confirmUser.student_id}）</p>
              <p className="au-modal-warn">此操作不可撤销，将同时删除该用户的所有签到、预约记录。</p>
            </div>
            <div className="au-modal-footer">
              <button className="au-modal-cancel" onClick={() => setConfirmUser(null)}>取消</button>
              <button className="au-modal-confirm" onClick={handleDelete} disabled={deleting}>
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
