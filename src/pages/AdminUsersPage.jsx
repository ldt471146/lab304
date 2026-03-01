import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes, formatPoints, AVATAR_FALLBACK, formatGender } from '../lib/constants'
import { Users, Search, Clock, Star, Trash2, X, Check, Ban, Eye } from 'lucide-react'

export default function AdminUsersPage() {
  const PAGE_SIZE = 10
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [confirmUser, setConfirmUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/', { replace: true })
  }, [profile, navigate])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase
      .from('users')
      .select('id, name, student_id, grade, points, total_minutes, created_at, avatar_url, id_photo_url, email, approval_status, gender, class_name, phone')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [profile])

  if (!profile?.is_admin) return null

  const pendingCount = users.filter(u => u.approval_status === 'pending').length
  const approvedCount = users.filter(u => u.approval_status === 'approved').length
  const rejectedCount = users.filter(u => u.approval_status === 'rejected').length

  const filtered = users
    .filter(u => {
      if (statusFilter === 'all') return true
      return u.approval_status === statusFilter
    })
    .filter(u => {
      if (!query) return true
      return u.name?.includes(query) || u.student_id?.includes(query)
    })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const start = (page - 1) * PAGE_SIZE
  const pagedUsers = filtered.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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

  async function handleApprove(userId) {
    const { error } = await supabase.rpc('admin_approve_user', { target_user_id: userId })
    if (error) {
      alert('审核通过失败：' + error.message)
      return
    }
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, approval_status: 'approved' } : u)))
  }

  async function handleReject(userId) {
    const { error } = await supabase.rpc('admin_reject_user', { target_user_id: userId })
    if (error) {
      alert('驳回失败：' + error.message)
      return
    }
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, approval_status: 'rejected' } : u)))
  }

  return (
    <div className="page">
      <div className="page-header">
        <Users size={20} />
        <h2>用户管理</h2>
        <span className="date-badge">待审核 {pendingCount}</span>
      </div>

      <div className="tab-group au-filter-row">
        <button className={`tab ${statusFilter === 'pending' ? 'active' : ''}`} onClick={() => setStatusFilter('pending')}>
          待审核 ({pendingCount})
        </button>
        <button className={`tab ${statusFilter === 'approved' ? 'active' : ''}`} onClick={() => setStatusFilter('approved')}>
          已通过 ({approvedCount})
        </button>
        <button className={`tab ${statusFilter === 'rejected' ? 'active' : ''}`} onClick={() => setStatusFilter('rejected')}>
          已驳回 ({rejectedCount})
        </button>
        <button className={`tab ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
          全部 ({users.length})
        </button>
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
          {pagedUsers.map(u => (
            <div key={u.student_id} className="au-item">
              <img
                className="au-avatar"
                src={u.avatar_url || AVATAR_FALLBACK(u.student_id)}
                alt=""
              />
              <div className="au-info">
                <span className="au-name">{u.name}</span>
                <span className="au-meta">
                  {u.grade}级 // {u.student_id} // {u.email || '--'} // {u.approval_status === 'approved' ? '已通过' : u.approval_status === 'rejected' ? '已驳回' : '待审核'}
                </span>
              </div>
              <div className="au-stats">
                <span className="au-stat"><Star size={12} />{formatPoints(u.points)}</span>
                <span className="au-stat"><Clock size={12} />{formatMinutes(u.total_minutes)}</span>
              </div>
              <span className="au-date">{new Date(u.created_at).toLocaleDateString('zh-CN')}</span>
              <button className="au-del-btn" onClick={() => setViewUser(u)} title="查看资料">
                <Eye size={14} />
              </button>
              {u.id !== profile.id && (
                <button className="au-del-btn" onClick={() => setConfirmUser(u)} title="删除用户">
                  <Trash2 size={14} />
                </button>
              )}
              {u.id !== profile.id && u.approval_status !== 'approved' && (
                <button className="au-del-btn" onClick={() => handleApprove(u.id)} title="审核通过">
                  <Check size={14} />
                </button>
              )}
              {u.id !== profile.id && u.approval_status === 'pending' && (
                <button className="au-del-btn" onClick={() => handleReject(u.id)} title="驳回申请">
                  <Ban size={14} />
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-hint">当前筛选下暂无用户</div>}
        </div>
      )}
      {filtered.length > 0 && (
        <div className="au-pagination">
          <span className="au-page-meta">第 {page} / {totalPages} 页，共 {filtered.length} 人</span>
          <div className="au-page-actions">
            <button className="btn-preset" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</button>
            <button className="btn-preset" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>下一页</button>
          </div>
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
      {viewUser && (
        <div className="au-modal-overlay" onClick={() => setViewUser(null)}>
          <div className="au-modal" onClick={e => e.stopPropagation()}>
            <div className="au-modal-header">
              <span>用户资料</span>
              <button className="au-modal-close" onClick={() => setViewUser(null)}><X size={16} /></button>
            </div>
            <div className="au-modal-body">
              <div className="seat-owner-body">
                <img className="seat-owner-avatar" src={viewUser.id_photo_url || viewUser.avatar_url || AVATAR_FALLBACK(viewUser.student_id)} alt="" />
                <div className="seat-owner-meta">
                  <div className="seat-owner-name">{viewUser.name || '--'}</div>
                  <div>{viewUser.grade || '--'}级 // {viewUser.student_id || '--'}</div>
                </div>
              </div>
              <div style={{ marginTop: '0.8rem', lineHeight: 1.8 }}>
                <div><b>性别</b>：{formatGender(viewUser.gender)}</div>
                <div><b>班级</b>：{viewUser.class_name || '--'}</div>
                <div><b>邮箱</b>：{viewUser.email || '--'}</div>
                <div><b>联系电话</b>：{viewUser.phone || '--'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
