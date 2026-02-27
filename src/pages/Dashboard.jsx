import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SLOT_LABEL, getLocalDate } from '../lib/constants'
import { LayoutDashboard, CheckCircle, Clock, Star, Calendar, Download, FileSpreadsheet, CalendarCheck } from 'lucide-react'
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
    '时段': SLOT_LABEL[r.time_slot] ?? r.time_slot ?? '',
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
    '时段': SLOT_LABEL[r.time_slot] ?? r.time_slot ?? '',
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

  useEffect(() => {
    if (!profile) return
    fetchData()
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

  const checkedSlots = todayCheckins.map(c => SLOT_LABEL[c.time_slot]).filter(Boolean)

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
            <span className="stat-num">{profile.checkin_count}</span>
            <span className="stat-label">签到</span>
          </div>
          <div className="stat">
            <span className="stat-num">{profile.points}</span>
            <span className="stat-label">积分</span>
          </div>
          <div className="stat">
            <span className="stat-num">#{myRank?.rank ?? '--'}</span>
            <span className="stat-label">排名</span>
          </div>
        </div>
      </div>

      <div className="card-grid">
        <div className={`status-card ${todayCheckins.length ? 'checked' : 'unchecked'}`}>
          <span className={`led ${todayCheckins.length ? 'led-green' : 'led-red'}`} />
          <CheckCircle size={24} />
          <div>
            <div className="status-title">今日状态</div>
            <div className="status-sub">
              {checkedSlots.length
                ? `已签到 ${checkedSlots.length} 个时段 (${checkedSlots.join(', ')})`
                : '今日未签到'}
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

      <div className="section-title"><Calendar size={16} /> 今日预约</div>
      {myReservations.length === 0
        ? <div className="empty-hint">今日暂无预约</div>
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
    </div>
  )
}
