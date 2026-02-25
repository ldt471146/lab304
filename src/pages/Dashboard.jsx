import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CheckCircle, Clock, Star, Calendar, Download, FileSpreadsheet, CalendarCheck } from 'lucide-react'
import * as XLSX from 'xlsx'

const SLOT_LABEL = { morning: '上午', afternoon: '下午', evening: '晚上' }

function formatDateTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function buildExportRows(records) {
  return records.map(r => ({
    '姓名': r.users?.name ?? '',
    '学号': r.users?.student_id ?? '',
    '学级': r.users?.grade ?? '',
    '签到日期': r.check_date,
    '时段': SLOT_LABEL[r.time_slot] ?? r.time_slot ?? '',
    '座位号': r.seats?.seat_number ?? '',
    '签到时间': formatDateTime(r.checked_at),
    '签退时间': formatDateTime(r.checked_out_at),
  }))
}

function buildReserveRows(records) {
  return records.map(r => ({
    '姓名': r.users?.name ?? '',
    '学号': r.users?.student_id ?? '',
    '学级': r.users?.grade ?? '',
    '预约日期': r.reserve_date,
    '时段': SLOT_LABEL[r.time_slot] ?? r.time_slot ?? '',
    '座位号': r.seats?.seat_number ?? '',
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
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
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

  useEffect(() => {
    if (!profile) return
    fetchData()
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    setStartDate(`${y}-${m}-01`)
    setEndDate(now.toISOString().split('T')[0])
  }, [profile])

  async function fetchData() {
    const today = new Date().toISOString().split('T')[0]
    const [checkinRes, reserveRes, rankRes] = await Promise.all([
      supabase.from('checkins').select('*, seats(seat_number)')
        .eq('user_id', profile.id).eq('check_date', today),
      supabase.from('reservations').select('*, seats(seat_number)')
        .eq('user_id', profile.id).eq('reserve_date', today).eq('status', 'active'),
      supabase.from('leaderboard').select('rank, grade_rank')
        .eq('id', profile.id).maybeSingle(),
    ])
    setTodayCheckins(checkinRes.data || [])
    setMyReservations(reserveRes.data || [])
    setMyRank(rankRes.data)
  }

  async function fetchExportData() {
    if (!startDate || !endDate) {
      setExportMsg({ type: 'error', text: '请选择日期范围' })
      return null
    }
    setExporting(true); setExportMsg(null)
    const { data, error } = await supabase
      .from('checkins')
      .select('check_date, time_slot, checked_at, checked_out_at, users(name, student_id, grade), seats(seat_number)')
      .gte('check_date', startDate)
      .lte('check_date', endDate)
      .order('check_date')
      .order('checked_at')
    setExporting(false)
    if (error) { setExportMsg({ type: 'error', text: error.message }); return null }
    if (!data?.length) { setExportMsg({ type: 'error', text: '该日期范围内无签到记录' }); return null }
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
    const { data, error } = await supabase
      .from('reservations')
      .select('reserve_date, time_slot, status, users(name, student_id, grade), seats(seat_number)')
      .gte('reserve_date', startDate)
      .lte('reserve_date', endDate)
      .order('reserve_date')
      .order('time_slot')
    setResExporting(false)
    if (error) { setResExportMsg({ type: 'error', text: error.message }); return null }
    if (!data?.length) { setResExportMsg({ type: 'error', text: '该日期范围内无预约记录' }); return null }
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

  const checkedSlots = todayCheckins.map(c => SLOT_LABEL[c.time_slot]).filter(Boolean)

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
        <div className={`status-card ${todayCheckins.length ? 'checked' : 'unchecked'}`}>
          <CheckCircle size={24} />
          <div>
            <div className="status-title">今日签到</div>
            <div className="status-sub">
              {checkedSlots.length
                ? `已签到 ${checkedSlots.length} 个时段（${checkedSlots.join('、')}）`
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

      {profile.is_admin && (
        <div className="export-section">
          <div className="section-title"><Download size={16} /> 数据导出（管理员）</div>
          <div className="export-card">
            <div className="export-date-row">
              <div className="field-group">
                <label>开始日期</label>
                <input type="date" className="date-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <span className="export-date-sep">至</span>
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
                {exporting ? '导出中...' : '导出 Excel'}
              </button>
            </div>
            {exportMsg && <div className={`msg ${exportMsg.type}`}>{exportMsg.text}</div>}
          </div>

          <div className="section-title" style={{ marginTop: '1.5rem' }}><CalendarCheck size={16} /> 预约记录导出</div>
          <div className="export-card">
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              使用上方日期范围，导出该区间内的所有预约记录（可用于安排值日）
            </p>
            <div className="export-actions">
              <button className="btn-export csv" onClick={() => handleReserveExport('csv')} disabled={resExporting}>
                <Download size={16} />
                {resExporting ? '导出中...' : '导出 CSV'}
              </button>
              <button className="btn-export excel" onClick={() => handleReserveExport('excel')} disabled={resExporting}>
                <FileSpreadsheet size={16} />
                {resExporting ? '导出中...' : '导出 Excel'}
              </button>
            </div>
            {resExportMsg && <div className={`msg ${resExportMsg.type}`}>{resExportMsg.text}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
