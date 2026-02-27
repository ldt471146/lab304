import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { currentGrades } from '../lib/constants'
import { Terminal } from 'lucide-react'

const GRADES = currentGrades()

export default function SetupProfile() {
  const { session, fetchProfile } = useAuth()
  const meta = session?.user?.user_metadata || {}
  const [form, setForm] = useState({
    student_id: meta.student_id || '',
    name: meta.name || '',
    grade: meta.grade || GRADES[1] || '2024',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.from('users').insert({
      id: session.user.id,
      student_id: form.student_id,
      name: form.name,
      grade: form.grade,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await fetchProfile(session.user.id)
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><Terminal size={30} /></div>
          <h1>完善资料</h1>
          <p>请填写个人信息以继续</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label>学号</label>
            <input placeholder="请输入学号" value={form.student_id} onChange={e => set('student_id', e.target.value)} required />
          </div>
          <div className="field-group">
            <label>姓名</label>
            <input placeholder="请输入姓名" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="field-group">
            <label>年级</label>
            <select value={form.grade} onChange={e => set('grade', e.target.value)}>
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {error && <div className="error-msg">错误: {error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '处理中...' : '> 确认提交'}
          </button>
        </form>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button className="nav-logout" style={{ margin: '0 auto' }}
            onClick={() => supabase.auth.signOut()}>
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
