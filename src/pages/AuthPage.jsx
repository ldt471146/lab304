import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { currentGrades } from '../lib/constants'
import { Terminal, LogIn, UserPlus } from 'lucide-react'

const GRADES = currentGrades()
const REMEMBER_KEY = 'lab304_remember_email'

function DigitalRain({ canvasRef }) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]'
    const fontSize = 14
    let columns, drops

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      columns = Math.floor(canvas.width / fontSize)
      drops = Array(columns).fill(1)
    }

    function draw() {
      ctx.fillStyle = 'rgba(10, 14, 23, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = 'rgba(0, 255, 65, 0.15)'
      ctx.font = `${fontSize}px monospace`
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)]
        ctx.fillText(char, i * fontSize, drops[i] * fontSize)
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
      animId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])

  return null
}

export default function AuthPage() {
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('login')
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY))
  const [form, setForm] = useState(() => ({
    email: localStorage.getItem(REMEMBER_KEY) || '',
    password: '',
    name: '',
    student_id: '',
    grade: GRADES[1] || '2024',
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    if (remember) localStorage.setItem(REMEMBER_KEY, form.email)
    else localStorage.removeItem(REMEMBER_KEY)
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
        data: { name: form.name, student_id: form.student_id, grade: form.grade },
      },
    })
    if (error) setError(error.message)
    else setRegistered(true)
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <canvas ref={canvasRef} />
      <DigitalRain canvasRef={canvasRef} />
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Terminal size={30} />
          </div>
          <h1>LAB_304</h1>
          <p>登录 // 预约 // 签到</p>
        </div>

        <div className="tab-group">
          <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
            <LogIn size={14} /> 登录
          </button>
          <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>
            <UserPlus size={14} /> 注册
          </button>
        </div>

        {registered && (
          <div className="success-msg">注册成功，请查收邮件完成验证。</div>
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
                <label>年级</label>
                <select value={form.grade} onChange={e => set('grade', e.target.value)}>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
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
          {mode === 'login' && (
            <div className="remember-row">
              <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)} />
              <label htmlFor="remember">记住我</label>
            </div>
          )}
          {error && <div className="error-msg">错误: {error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '处理中...' : mode === 'login' ? '> 登录' : '> 注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
