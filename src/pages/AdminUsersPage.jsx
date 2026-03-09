import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes, formatPoints, AVATAR_FALLBACK, formatGender } from '../lib/constants'
import { Users, Search, Clock, Star, Trash2, X, Check, Ban, Eye, SlidersHorizontal, ShieldPlus, ShieldOff, Pencil } from 'lucide-react'

export default function AdminUsersPage() {
  const PAGE_SIZE = 10
  const HISTORY_PAGE_SIZE = 50
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [confirmUser, setConfirmUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)
  const [strikeEditor, setStrikeEditor] = useState(null)
  const [strikeValue, setStrikeValue] = useState('')
  const [strikeSaving, setStrikeSaving] = useState(false)
  const [strikeError, setStrikeError] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [reservationHistory, setReservationHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [ruleForm, setRuleForm] = useState({
    is_enabled: true,
    min_study_minutes: 90,
    max_continuous_days: 7,
    penalty_points: 1.5,
    strike_value: 1,
    strike_threshold: 3,
    restrict_days: 7,
  })
  const [ruleLoading, setRuleLoading] = useState(true)
  const [ruleSaving, setRuleSaving] = useState(false)
  const [ruleMsg, setRuleMsg] = useState(null)

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/', { replace: true })
  }, [profile, navigate])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase
      .from('users')
      .select('id, name, student_id, grade, points, total_minutes, created_at, avatar_url, id_photo_url, email, approval_status, gender, class_name, phone, reservation_strikes, reservation_restricted_until, is_admin, is_super_admin')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [profile])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase
      .from('reservation_rules')
      .select('id, is_enabled, min_study_minutes, max_continuous_days, penalty_points, strike_value, strike_threshold, restrict_days')
      .eq('id', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setRuleForm({
            is_enabled: Boolean(data.is_enabled),
            min_study_minutes: Number(data.min_study_minutes ?? 90),
            max_continuous_days: Number(data.max_continuous_days ?? 7),
            penalty_points: Number(data.penalty_points ?? 1.5),
            strike_value: Number(data.strike_value ?? 1),
            strike_threshold: Number(data.strike_threshold ?? 3),
            restrict_days: Number(data.restrict_days ?? 7),
          })
        }
        setRuleLoading(false)
      })
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

  useEffect(() => {
    if (!photoPreview) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setPhotoPreview(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [photoPreview])

  useEffect(() => {
    if (!viewUser) {
      setReservationHistory([])
      setHistoryLoading(false)
      setHistoryLoadingMore(false)
      setHistoryHasMore(false)
      setHistoryError(null)
      return
    }
    fetchReservationHistory(viewUser.id, 0, false)
  }, [viewUser])

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

  async function handleSetAdminRole(userId, makeAdmin) {
    const { error } = await supabase.rpc('admin_set_admin_role', {
      target_user_id: userId,
      make_admin: makeAdmin,
    })
    if (error) {
      alert((makeAdmin ? '任命管理员失败：' : '回收管理员失败：') + error.message)
      return
    }
    setUsers(prev => prev.map(u => (
      u.id === userId
        ? { ...u, is_admin: makeAdmin, approval_status: makeAdmin ? 'approved' : u.approval_status }
        : u
    )))
  }

  function applyUserPatch(userId, patch) {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...patch } : u)))
    setViewUser(prev => (prev?.id === userId ? { ...prev, ...patch } : prev))
    setStrikeEditor(prev => (prev?.id === userId ? { ...prev, ...patch } : prev))
  }

  function openStrikeEditor(user) {
    setStrikeEditor(user)
    setStrikeValue(String(Math.max(0, Number(user?.reservation_strikes || 0))))
    setStrikeError(null)
  }

  async function fetchReservationHistory(userId, offset = 0, append = false) {
    if (!userId) return
    if (append) setHistoryLoadingMore(true)
    else {
      setHistoryLoading(true)
      setReservationHistory([])
    }
    setHistoryError(null)

    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('id, reserve_date, status, created_at, seat_id, seats(seat_number)')
      .eq('user_id', userId)
      .order('reserve_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1)

    if (error) {
      setHistoryError(error.message)
      setHistoryLoading(false)
      setHistoryLoadingMore(false)
      return
    }

    const rows = reservations || []
    const dates = [...new Set(rows.map(r => r.reserve_date).filter(Boolean))]
    let checkedKeys = new Set()

    if (dates.length > 0) {
      const { data: checkins, error: checkinError } = await supabase
        .from('checkins')
        .select('seat_id, check_date')
        .eq('user_id', userId)
        .in('check_date', dates)

      if (checkinError) {
        setHistoryError(checkinError.message)
        setHistoryLoading(false)
        setHistoryLoadingMore(false)
        return
      }

      checkedKeys = new Set((checkins || []).map(c => `${c.seat_id}:${c.check_date}`))
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
    const mapped = rows.map(item => {
      const hasCheckin = checkedKeys.has(`${item.seat_id}:${item.reserve_date}`)
      let statusLabel = '生效中'
      let statusClass = 'active'

      if (hasCheckin) {
        statusLabel = '已签到'
        statusClass = 'checked'
      } else if (item.status !== 'active') {
        statusLabel = '已取消'
        statusClass = 'cancelled'
      } else if (item.reserve_date < today) {
        statusLabel = '已过期未签到'
        statusClass = 'expired'
      }

      return {
        ...item,
        statusLabel,
        statusClass,
      }
    })

    setReservationHistory(prev => (append ? [...prev, ...mapped] : mapped))
    setHistoryHasMore(rows.length === HISTORY_PAGE_SIZE)
    setHistoryLoading(false)
    setHistoryLoadingMore(false)
  }

  function closeStrikeEditor() {
    if (strikeSaving) return
    setStrikeEditor(null)
    setStrikeValue('')
    setStrikeError(null)
  }

  async function handleSaveStrikeEditor() {
    if (!strikeEditor) return
    const parsed = Number(strikeValue)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setStrikeError('请输入 0 或更大的整数')
      return
    }
    const nextValue = Math.trunc(parsed)
    setStrikeSaving(true)
    setStrikeError(null)
    const { data, error } = await supabase
      .rpc('admin_set_user_reservation_strikes', {
        target_user_id: strikeEditor.id,
        p_reservation_strikes: nextValue,
      })
      .single()
    setStrikeSaving(false)
    if (error) {
      setStrikeError(error.message)
      return
    }
    applyUserPatch(strikeEditor.id, {
      reservation_strikes: Number(data?.reservation_strikes ?? nextValue),
      reservation_restricted_until: data?.reservation_restricted_until || null,
    })
    closeStrikeEditor()
  }

  function updateRuleField(key, value) {
    setRuleForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSaveRules() {
    setRuleSaving(true)
    setRuleMsg(null)
    const payload = {
      p_is_enabled: Boolean(ruleForm.is_enabled),
      p_min_study_minutes: Math.max(0, Math.min(1440, Number(ruleForm.min_study_minutes) || 0)),
      p_max_continuous_days: Math.max(1, Math.min(30, Number(ruleForm.max_continuous_days) || 1)),
      p_penalty_points: Math.max(0, Number(ruleForm.penalty_points) || 0),
      p_strike_value: Math.max(0, Math.min(10, Number(ruleForm.strike_value) || 0)),
      p_strike_threshold: Math.max(0, Math.min(100, Number(ruleForm.strike_threshold) || 0)),
      p_restrict_days: Math.max(0, Math.min(365, Number(ruleForm.restrict_days) || 0)),
    }
    const { data, error } = await supabase.rpc('admin_upsert_reservation_rules', payload).single()
    setRuleSaving(false)
    if (error) {
      setRuleMsg({ type: 'error', text: '保存失败：' + error.message })
      return
    }
    if (data) {
      setRuleForm({
        is_enabled: Boolean(data.is_enabled),
        min_study_minutes: Number(data.min_study_minutes ?? payload.p_min_study_minutes),
        max_continuous_days: Number(data.max_continuous_days ?? payload.p_max_continuous_days),
        penalty_points: Number(data.penalty_points ?? payload.p_penalty_points),
        strike_value: Number(data.strike_value ?? payload.p_strike_value),
        strike_threshold: Number(data.strike_threshold ?? payload.p_strike_threshold),
        restrict_days: Number(data.restrict_days ?? payload.p_restrict_days),
      })
    }
    setRuleMsg({ type: 'success', text: '连续预约规则已更新' })
  }

  function formatRestrictDate(v) {
    if (!v) return '--'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    return d.toLocaleDateString('zh-CN')
  }

  function getUserPhoto(user) {
    return user?.id_photo_url || user?.avatar_url || AVATAR_FALLBACK(user?.student_id || 'user')
  }

  function openPhotoPreview(user) {
    setPhotoPreview({
      src: getUserPhoto(user),
      title: `${user?.name || '用户'}的照片`,
      hint: user?.id_photo_url ? '个人照片' : '未上传个人照片，当前显示头像',
    })
  }

  function openViewUser(user) {
    setPhotoPreview(null)
    setViewUser(user)
  }

  function closeViewUser() {
    setPhotoPreview(null)
    setViewUser(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <Users size={20} />
        <h2>用户管理</h2>
        <span className="date-badge">待审核 {pendingCount}</span>
      </div>

      <div className="au-rule-card">
        <div className="section-title"><SlidersHorizontal size={14} /> 连续预约规则</div>
        {ruleLoading ? (
          <div className="loading">规则加载中...</div>
        ) : (
          <>
            <div className="au-rule-grid">
              <label className="field-group">
                <span>连续预约开关</span>
                <select
                  value={ruleForm.is_enabled ? 'on' : 'off'}
                  onChange={e => updateRuleField('is_enabled', e.target.value === 'on')}
                >
                  <option value="on">开启</option>
                  <option value="off">关闭</option>
                </select>
              </label>
              <label className="field-group">
                <span>每日最低学习时长(分钟)</span>
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={ruleForm.min_study_minutes}
                  onChange={e => updateRuleField('min_study_minutes', e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>连续预约最多天数</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={ruleForm.max_continuous_days}
                  onChange={e => updateRuleField('max_continuous_days', e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>未达标扣分</span>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={ruleForm.penalty_points}
                  onChange={e => updateRuleField('penalty_points', e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>未达标记次</span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={ruleForm.strike_value}
                  onChange={e => updateRuleField('strike_value', e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>触发限制阈值(累计次)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={ruleForm.strike_threshold}
                  onChange={e => updateRuleField('strike_threshold', e.target.value)}
                />
              </label>
              <label className="field-group">
                <span>触发后限制天数</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={ruleForm.restrict_days}
                  onChange={e => updateRuleField('restrict_days', e.target.value)}
                />
              </label>
            </div>
            {ruleMsg && <div className={`msg ${ruleMsg.type}`}>{ruleMsg.text}</div>}
            <div className="au-rule-actions">
              <button className="btn-preset" onClick={handleSaveRules} disabled={ruleSaving}>
                {ruleSaving ? '保存中...' : '保存规则'}
              </button>
            </div>
          </>
        )}
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
                  {' // '}
                  {u.is_super_admin ? '超级管理员' : u.is_admin ? '管理员' : '普通用户'}
                </span>
              </div>
              <div className="au-stats">
                <span className="au-stat"><Star size={12} />{formatPoints(u.points)}</span>
                <span className="au-stat"><Clock size={12} />{formatMinutes(u.total_minutes)}</span>
                <span className={`au-stat ${Number(u.reservation_strikes || 0) > 0 ? 'warn' : ''}`}>
                  <Ban size={12} />
                  标记{Number(u.reservation_strikes || 0)}
                </span>
              </div>
              <span className="au-date">{u.reservation_restricted_until ? `限制至 ${formatRestrictDate(u.reservation_restricted_until)}` : '未限制'}</span>
              <span className="au-date">{new Date(u.created_at).toLocaleDateString('zh-CN')}</span>
              <button className="au-del-btn" onClick={() => openViewUser(u)} title="查看资料">
                <Eye size={14} />
              </button>
              {(profile.is_super_admin || !u.is_super_admin) && (
                <button className="au-del-btn" onClick={() => openStrikeEditor(u)} title="修改标记">
                  <Pencil size={14} />
                </button>
              )}
              {u.id !== profile.id && !u.is_admin && !u.is_super_admin && (
                <button className="au-del-btn" onClick={() => setConfirmUser(u)} title="删除用户">
                  <Trash2 size={14} />
                </button>
              )}
              {profile.is_super_admin && u.id !== profile.id && !u.is_super_admin && !u.is_admin && (
                <button className="au-del-btn" onClick={() => handleSetAdminRole(u.id, true)} title="任命管理员">
                  <ShieldPlus size={14} />
                </button>
              )}
              {profile.is_super_admin && u.id !== profile.id && !u.is_super_admin && u.is_admin && (
                <button className="au-del-btn" onClick={() => handleSetAdminRole(u.id, false)} title="回收管理员">
                  <ShieldOff size={14} />
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
        <div className="au-modal-overlay" onClick={closeViewUser}>
          <div className="au-modal au-modal-profile" onClick={e => e.stopPropagation()}>
            <div className="au-modal-header">
              <span>用户资料</span>
              <button className="au-modal-close" onClick={closeViewUser}><X size={16} /></button>
            </div>
            <div className="au-modal-body">
              <div className="au-profile-photo-block">
                <button
                  type="button"
                  className="au-photo-trigger"
                  onClick={() => openPhotoPreview(viewUser)}
                >
                  <img
                    className="au-photo-trigger-img"
                    src={getUserPhoto(viewUser)}
                    alt={`${viewUser.name || '用户'}照片`}
                  />
                  <span className="au-photo-trigger-hint">
                    {viewUser.id_photo_url ? '点击查看个人照片大图' : '未上传个人照片，点击查看头像'}
                  </span>
                </button>
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
                <div><b>标记次数</b>：{Number(viewUser.reservation_strikes || 0)}</div>
                <div><b>限制到期</b>：{formatRestrictDate(viewUser.reservation_restricted_until)}</div>
                {(profile.is_super_admin || !viewUser.is_super_admin) && (
                  <button type="button" className="btn-preset au-inline-action" onClick={() => openStrikeEditor(viewUser)}>
                    修改标记
                  </button>
                )}
              </div>
              <div className="au-history-block">
                <div className="section-title">预约历史</div>
                {historyLoading ? (
                  <div className="loading">预约记录加载中...</div>
                ) : historyError ? (
                  <div className="msg error">{historyError}</div>
                ) : reservationHistory.length === 0 ? (
                  <div className="empty-hint">暂无预约记录</div>
                ) : (
                  <>
                    <div className="au-history-list">
                      {reservationHistory.map(item => (
                        <div key={item.id} className="au-history-item">
                          <div className="au-history-main">
                            <div className="au-history-title">
                              <span>{item.reserve_date || '--'}</span>
                              <span className={`au-history-tag ${item.statusClass}`}>{item.statusLabel}</span>
                            </div>
                            <div className="au-history-meta">
                              座位 {item.seats?.seat_number || item.seat_id || '--'} // 创建于 {new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {historyHasMore && (
                      <button
                        type="button"
                        className="btn-preset au-history-more"
                        onClick={() => fetchReservationHistory(viewUser.id, reservationHistory.length, true)}
                        disabled={historyLoadingMore}
                      >
                        {historyLoadingMore ? '加载中...' : '加载更多'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {strikeEditor && (
        <div className="au-modal-overlay" onClick={closeStrikeEditor}>
          <div className="au-modal" onClick={e => e.stopPropagation()}>
            <div className="au-modal-header">
              <span>修改标记</span>
              <button className="au-modal-close" onClick={closeStrikeEditor}><X size={16} /></button>
            </div>
            <div className="au-modal-body">
              <div><strong>{strikeEditor.name}</strong>（{strikeEditor.student_id}）</div>
              <div className="au-modal-note">当前限制到期：{formatRestrictDate(strikeEditor.reservation_restricted_until)}</div>
              <div className="au-modal-note">低于阈值后会自动解除预约限制。</div>
              <label className="field-group" style={{ marginTop: '0.85rem' }}>
                <span>标记次数</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={strikeValue}
                  onChange={e => setStrikeValue(e.target.value)}
                  disabled={strikeSaving}
                />
              </label>
              {strikeError && <div className="msg error">{strikeError}</div>}
            </div>
            <div className="au-modal-footer">
              <button className="au-modal-cancel" onClick={closeStrikeEditor} disabled={strikeSaving}>取消</button>
              <button className="au-modal-confirm" onClick={handleSaveStrikeEditor} disabled={strikeSaving}>
                {strikeSaving ? '保存中...' : '保存'}
              </button>
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
    </div>
  )
}
