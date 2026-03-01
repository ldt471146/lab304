import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SLOT_TEXT, getLocalDate, formatMinutes, formatPoints } from '../lib/constants'
import { LayoutDashboard, CheckCircle, Clock, Star, Calendar, Download, FileSpreadsheet, CalendarCheck, ClipboardList, Megaphone, Pin, Plus, Pencil, Trash2, X } from 'lucide-react'
import * as XLSX from 'xlsx'

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function buildExportRows(records) {
  return records.map(r => ({
    '姓名': r.user_name ?? '',
    '学号': r.student_id ?? '',
    '年级': r.grade ?? '',
    '日期': r.check_date,
    '时段': SLOT_TEXT[r.time_slot] ?? r.time_slot ?? '',
    '座位': r.seat_number ?? '',
    '签到时间': formatDateTime(r.checked_at),
    '签退时间': formatDateTime(r.checked_out_at),
  }))
}

function buildReserveRows(records) {
  return records.map(r => ({
    '姓名': r.user_name ?? '',
    '学号': r.student_id ?? '',
    '年级': r.grade ?? '',
    '日期': r.reserve_date,
    '时段': SLOT_TEXT[r.time_slot] ?? r.time_slot ?? '',
    '座位': r.seat_number ?? '',
    '状态': r.status === 'active' ? '有效' : r.status === 'cancelled' ? '已取消' : r.status,
  }))
}

function downloadCSV(rows, filename) {
  const headers = Object.keys(rows[0])
  const csv = '\uFEFF' + [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadExcel(rows, filename, sheetName = '签到记录') {
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0]).map(k => ({
    wch: Math.max(k.length * 2, ...rows.map(r => String(r[k]).length)) + 2
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [todayCheckins, setTodayCheckins] = useState([])
  const [myReservations, setMyReservations] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState(null)
  const [resExporting, setResExporting] = useState(false)
  const [resExportMsg, setResExportMsg] = useState(null)
  const [announcements, setAnnouncements] = useState([])
  const [editingAnn, setEditingAnn] = useState(null)
  const [annForm, setAnnForm] = useState({ title: '', content: '' })
  const [annLoading, setAnnLoading] = useState(false)
  const [showAnnModal, setShowAnnModal] = useState(false)
  const [dutyToday, setDutyToday] = useState([])
  const [showDutyModal, setShowDutyModal] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchData()
    fetchAnnouncements()
    fetchDutyToday()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    setStartDate(`${y}-${m}-01`)
    setEndDate(getLocalDate())
  }, [profile])

  async function fetchData() {
    const today = getLocalDate()
    const [checkinRes, reserveRes, rankRes] = await Promise.all([
      supabase.from('checkins').select('*, seats(seat_number)')
        .eq('user_id', profile.id).eq('check_date', today),
      supabase.from('reservations').select('*, seats(seat_number)')
        .eq('user_id', profile.id).eq('reserve_date', today).eq('status', 'active'),
      supabase.from('leaderboard').select('rank, grade_rank')
        .eq('id', profile.id).maybeSingle(),
    ])
    if (checkinRes.error) console.error('fetchCheckins:', checkinRes.error.message)
    if (reserveRes.error) console.error('fetchReservations:', reserveRes.error.message)
    if (rankRes.error) console.error('fetchRank:', rankRes.error.message)
    setTodayCheckins(checkinRes.data || [])
    setMyReservations(reserveRes.data || [])
    setMyRank(rankRes.data)
  }

  async function fetchDutyToday() {
    const { data } = await supabase
      .from('duty_schedule')
      .select('user_id, users!inner(name)')
      .eq('duty_date', getLocalDate())
    const list = data || []
    setDutyToday(list)
    if (profile && list.some(d => d.user_id === profile.id)) {
      const ackKey = `lab304_duty_ack_${profile.id}_${getLocalDate()}`
      if (!localStorage.getItem(ackKey)) setShowDutyModal(true)
    }
  }

  async function fetchAnnouncements() {
    const { data } = await supabase.from('announcements').select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
    const list = data || []
    setAnnouncements(list)
    if (list.length && profile) {
      const latestId = Math.max(...list.map(a => a.id))
      const seenId = Number(localStorage.getItem(`lab304_ann_seen_${profile.id}`)) || 0
      if (latestId > seenId) setShowAnnModal(true)
    }
  }

  function handleAckAnn() {
    if (announcements.length && profile) {
      const latestId = Math.max(...announcements.map(a => a.id))
      localStorage.setItem(`lab304_ann_seen_${profile.id}`, String(latestId))
    }
    setShowAnnModal(false)
  }

  function startEditAnn(ann) {
    setEditingAnn(ann.id)
    setAnnForm({ title: ann.title, content: ann.content })
  }

  function cancelEditAnn() {
    setEditingAnn(null)
    setAnnForm({ title: '', content: '' })
  }

  async function handleSaveAnn() {
    if (!annForm.title.trim() || !annForm.content.trim()) return
    setAnnLoading(true)
    if (editingAnn === 'new') {
      await supabase.from('announcements').insert({ title: annForm.title, content: annForm.content })
    } else {
      await supabase.from('announcements').update({
        title: annForm.title, content: annForm.content, updated_at: new Date().toISOString(),
      }).eq('id', editingAnn)
    }
    cancelEditAnn()
    await fetchAnnouncements()
    setAnnLoading(false)
  }

  async function handleDeleteAnn(id) {
    if (!confirm('确定删除此公告？')) return
    await supabase.from('announcements').delete().eq('id', id)
    fetchAnnouncements()
  }

  async function handleTogglePin(ann) {
    await supabase.from('announcements').update({ is_pinned: !ann.is_pinned }).eq('id', ann.id)
    fetchAnnouncements()
  }

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return `${m} 分钟前`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} 小时前`
    const d = Math.floor(h / 24)
    return `${d} 天前`
  }

  async function fetchExportData() {
    if (!startDate || !endDate) {
      setExportMsg({ type: 'error', text: '请选择日期范围' })
      return null
    }
    setExporting(true); setExportMsg(null)
    const { data, error } = await supabase.rpc('export_checkins', {
      start_date: startDate, end_date: endDate,
    })
    setExporting(false)
    if (error) { setExportMsg({ type: 'error', text: error.message }); return null }
    if (!data?.length) { setExportMsg({ type: 'error', text: '所选范围内无记录' }); return null }
    return buildExportRows(data)
  }

  async function handleExport(type) {
    const rows = await fetchExportData()
    if (!rows) return
    const filename = `签到记录_${startDate}_${endDate}`
    if (type === 'csv') downloadCSV(rows, filename + '.csv')
    else downloadExcel(rows, filename + '.xlsx')
    setExportMsg({ type: 'success', text: `已导出 ${rows.length} 条记录 (${type.toUpperCase()})` })
  }

  async function fetchReserveData() {
    if (!startDate || !endDate) {
      setResExportMsg({ type: 'error', text: '请选择日期范围' })
      return null
    }
    setResExporting(true); setResExportMsg(null)
    const { data, error } = await supabase.rpc('export_reservations', {
      start_date: startDate, end_date: endDate,
    })
    setResExporting(false)
    if (error) { setResExportMsg({ type: 'error', text: error.message }); return null }
    if (!data?.length) { setResExportMsg({ type: 'error', text: '所选范围内无预约' }); return null }
    return buildReserveRows(data)
  }

  async function handleReserveExport(type) {
    const rows = await fetchReserveData()
    if (!rows) return
    const filename = `预约记录_${startDate}_${endDate}`
    if (type === 'csv') downloadCSV(rows, filename + '.csv')
    else downloadExcel(rows, filename + '.xlsx', '预约记录')
    setResExportMsg({ type: 'success', text: `已导出 ${rows.length} 条预约 (${type.toUpperCase()})` })
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return '早上好'
    if (h < 18) return '下午好'
    return '晚上好'
  }

  if (!profile) return <div className="loading">加载中...</div>

  const hasCheckedIn = todayCheckins.length > 0

  return (
    <div className="page">
      <div className="page-header">
        <LayoutDashboard size={18} />
        <h2>仪表板</h2>
        <span className="date-badge">{getLocalDate()}</span>
      </div>

      <div className="dashboard-hero">
        <div>
          <h2>{greeting()}, {profile.name}</h2>
          <span className="badge">{profile.grade}级 // {profile.student_id}</span>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <span className="stat-num">{formatMinutes(profile.total_minutes ?? 0)}</span>
            <span className="stat-label">学习</span>
          </div>
          <div className="stat">
            <span className="stat-num">{formatPoints(profile.points)}</span>
            <span className="stat-label">积分</span>
          </div>
          <div className="stat">
            <span className="stat-num">#{myRank?.rank ?? '--'}</span>
            <span className="stat-label">排名</span>
          </div>
        </div>
      </div>

      <div className="card-grid">
        <div className={`status-card ${hasCheckedIn ? 'checked' : 'unchecked'}`}>
          <span className={`led ${hasCheckedIn ? 'led-green' : 'led-red'}`} />
          <CheckCircle size={24} />
          <div>
            <div className="status-title">今日状态</div>
            <div className="status-sub">
              {hasCheckedIn
                ? todayCheckins.some(c => !c.checked_out_at) ? '学习中' : `已学习 ${formatMinutes(todayCheckins.reduce((sum, c) => sum + (c.checked_out_at ? Math.max(0, (new Date(c.checked_out_at) - new Date(c.checked_at)) / 60000) : 0), 0) | 0)}`
                : '未签到'}
            </div>
          </div>
        </div>

        <div className="status-card info">
          <span className="led led-cyan" />
          <Star size={24} />
          <div>
            <div className="status-title">年级排名</div>
            <div className="status-sub">#{myRank?.grade_rank ?? '--'} / {profile.grade}级</div>
          </div>
        </div>
      </div>

      <div className={`status-card duty-today-card${dutyToday.some(d => d.user_id === profile.id) ? ' mine' : ''}`}>
        <span className={`led ${dutyToday.length ? (dutyToday.some(d => d.user_id === profile.id) ? 'led-green' : 'led-cyan') : 'led-dim'}`} />
        <ClipboardList size={24} />
        <div>
          <div className="status-title">今日值日</div>
          <div className="status-sub">
            {dutyToday.length
              ? <>
                  {dutyToday.map(d => d.users.name).join('、')}
                  {dutyToday.some(d => d.user_id === profile.id) && <span className="duty-you"> (你今天值日!)</span>}
                </>
              : '今日无人值日'}
          </div>
        </div>
      </div>

      <div className="announcement-board">
        <div className="announcement-header">
          <div className="section-title"><Megaphone size={16} /> 公告栏</div>
          {profile.is_admin && !editingAnn && (
            <button className="btn-ann-add" onClick={() => { setEditingAnn('new'); setAnnForm({ title: '', content: '' }) }}>
              <Plus size={14} /> 新增
            </button>
          )}
        </div>

        {editingAnn && (
          <div className="announcement-form">
            <input
              className="date-input" placeholder="公告标题"
              value={annForm.title} onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="date-input ann-textarea" placeholder="公告内容" rows={6}
              value={annForm.content} onChange={e => setAnnForm(f => ({ ...f, content: e.target.value }))}
            />
            <div className="announcement-form-actions">
              <button className="btn-ann-save" onClick={handleSaveAnn} disabled={annLoading}>
                {annLoading ? '保存中...' : '保存'}
              </button>
              <button className="btn-ann-cancel" onClick={cancelEditAnn}><X size={14} /> 取消</button>
            </div>
          </div>
        )}

        {announcements.length === 0
          ? <div className="announcement-empty">暂无公告</div>
          : announcements.map(ann => (
            <div key={ann.id} className={`announcement-item${ann.is_pinned ? ' pinned' : ''}`}>
              <div className="announcement-title">
                {ann.is_pinned && <Pin size={13} className="pin-icon" />}
                {ann.title}
              </div>
              <div className="announcement-content">{ann.content}</div>
              <div className="announcement-meta">
                <span>{relativeTime(ann.created_at)}</span>
                {profile.is_admin && (
                  <span className="ann-actions">
                    <button onClick={() => handleTogglePin(ann)} title={ann.is_pinned ? '取消置顶' : '置顶'}>
                      <Pin size={13} />
                    </button>
                    <button onClick={() => startEditAnn(ann)} title="编辑"><Pencil size={13} /></button>
                    <button onClick={() => handleDeleteAnn(ann.id)} title="删除"><Trash2 size={13} /></button>
                  </span>
                )}
              </div>
            </div>
          ))
        }
      </div>

      <div className="section-title"><Calendar size={16} /> 今日预约</div>
      {myReservations.length === 0
        ? <div className="empty-hint">今日暂无预约</div>
        : (
          <div className="reservation-list">
            {myReservations.map(r => (
              <div key={r.id} className="reservation-item">
                <Clock size={15} />
                <span>{r.reserve_date}</span>
                <span className="seat-tag">{r.seats?.seat_number}</span>
              </div>
            ))}
          </div>
        )
      }

      {profile.is_admin && (
        <div className="export-section">
          <div className="section-title"><Download size={16} /> 数据导出 (管理员)</div>
          <div className="export-card">
            <div className="export-date-row">
              <div className="field-group">
                <label>开始日期</label>
                <input type="date" className="date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <span className="export-date-sep">&gt;</span>
              <div className="field-group">
                <label>结束日期</label>
                <input type="date" className="date-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="export-actions">
              <button className="btn-export csv" onClick={() => handleExport('csv')} disabled={exporting}>
                <Download size={16} />
                {exporting ? '导出中...' : '导出 CSV'}
              </button>
              <button className="btn-export excel" onClick={() => handleExport('excel')} disabled={exporting}>
                <FileSpreadsheet size={16} />
                {exporting ? '导出中...' : '导出 XLSX'}
              </button>
            </div>
            {exportMsg && <div className={`msg ${exportMsg.type}`}>{exportMsg.text}</div>}
          </div>

          <div className="section-title" style={{ marginTop: '1.5rem' }}><CalendarCheck size={16} /> 预约导出</div>
          <div className="export-card">
            <div className="export-actions">
              <button className="btn-export csv" onClick={() => handleReserveExport('csv')} disabled={resExporting}>
                <Download size={16} />
                {resExporting ? '导出中...' : '导出 CSV'}
              </button>
              <button className="btn-export excel" onClick={() => handleReserveExport('excel')} disabled={resExporting}>
                <FileSpreadsheet size={16} />
                {resExporting ? '导出中...' : '导出 XLSX'}
              </button>
            </div>
            {resExportMsg && <div className={`msg ${resExportMsg.type}`}>{resExportMsg.text}</div>}
          </div>
        </div>
      )}
      {showAnnModal && announcements.length > 0 && (
        <div className="ann-modal-overlay" onClick={handleAckAnn}>
          <div className="ann-modal" onClick={e => e.stopPropagation()}>
            <div className="ann-modal-title"><Megaphone size={18} /> 系统公告</div>
            <div className="ann-modal-list">
              {announcements.map(ann => (
                <div key={ann.id} className={`announcement-item${ann.is_pinned ? ' pinned' : ''}`}>
                  <div className="announcement-title">
                    {ann.is_pinned && <Pin size={13} className="pin-icon" />}
                    {ann.title}
                  </div>
                  <div className="announcement-content" style={{ WebkitLineClamp: 'unset' }}>{ann.content}</div>
                  <div className="announcement-meta"><span>{relativeTime(ann.created_at)}</span></div>
                </div>
              ))}
            </div>
            <button className="btn-ann-ack" onClick={handleAckAnn}>已收到</button>
          </div>
        </div>
      )}
      {showDutyModal && (
        <div className="ann-modal-overlay" onClick={() => {}}>
          <div className="ann-modal" onClick={e => e.stopPropagation()}>
            <div className="ann-modal-title"><ClipboardList size={18} /> 值日提醒</div>
            <div className="ann-modal-list">
              <div style={{ textAlign: 'center', fontSize: '1.1rem', padding: '1.5rem 0' }}>
                今天你值日呦！
              </div>
            </div>
            <button className="btn-ann-ack" onClick={() => {
              localStorage.setItem(`lab304_duty_ack_${profile.id}_${getLocalDate()}`, '1')
              setShowDutyModal(false)
            }}>收到</button>
          </div>
        </div>
      )}
    </div>
  )
}
