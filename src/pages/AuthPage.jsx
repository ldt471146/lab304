import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { FlaskConical, LogIn, UserPlus } from 'lucide-react'

const GRADES = ['2021', '2022', '2023', '2024', '2025']

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', student_id: '', grade: '2024' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        student_id: form.student_id,
        name: form.name,
        grade: form.grade,
      })
      if (profileError) setError(profileError.message)
      else setRegistered(true)
    }
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <FlaskConical size={32} />
          </div>
          <h1>实验室 304</h1>
          <p>签到 · 预约 · 占座系统</p>
        </div>

        <div className="tab-group">
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
            <LogIn size={15} /> 登录
          </button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>
            <UserPlus size={15} /> 注册
          </button>
        </div>

        {registered && (
          <div className="success-msg">注册成功！请查收邮箱并点击确认链接完成验证。</div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="field-group">
                <label>学号</label>
                <input placeholder="请输入学号" value={form.student_id} onChange={e => set('student_id', e.target.value)} required />
              </div>
              <div className="field-group">
                <label>姓名</label>
                <input placeholder="请输入姓名" value={form.name} onChange={e => set('name', e.target.value)} required />
              </div>
              <div className="field-group">
                <label>学级</label>
                <select value={form.grade} onChange={e => set('grade', e.target.value)}>
                  {GRADES.map(g => <option key={g} value={g}>{g} 级</option>)}
                </select>
              </div>
            </>
          )}
          <div className="field-group">
            <label>邮箱</label>
            <input type="email" placeholder="请输入邮箱" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div className="field-group">
            <label>密码</label>
            <input type="password" placeholder="请输入密码" value={form.password} onChange={e => set('password', e.target.value)} required />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
