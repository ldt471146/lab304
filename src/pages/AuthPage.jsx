import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { currentGrades } from '../lib/constants'
import { Terminal, LogIn, UserPlus, KeyRound } from 'lucide-react'

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
  const authCardRef = useRef(null)
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
  const [resetSent, setResetSent] = useState(false)
  const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || (window.location.origin + import.meta.env.BASE_URL)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const onFocusIn = (e) => {
      const el = e.target
      if (!(el instanceof HTMLElement)) return
      if (!el.matches('input,select,textarea')) return
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 160)
    }

    document.addEventListener('focusin', onFocusIn)

    const vv = window.visualViewport
    const updateKeyboardInset = () => {
      if (!vv) return
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb-inset', `${inset}px`)
    }

    if (vv) {
      updateKeyboardInset()
      vv.addEventListener('resize', updateKeyboardInset)
      vv.addEventListener('scroll', updateKeyboardInset)
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      if (vv) {
        vv.removeEventListener('resize', updateKeyboardInset)
        vv.removeEventListener('scroll', updateKeyboardInset)
      }
      document.documentElement.style.setProperty('--kb-inset', '0px')
    }
  }, [])

  function friendlyError(msg) {
    if (/rate limit/i.test(msg)) return '操作过于频繁，请稍后再试'
    if (/invalid login/i.test(msg)) return '邮箱或密码错误'
    if (/already registered/i.test(msg)) return '该邮箱已注册'
    if (/password.*short/i.test(msg)) return '密码至少 6 位'
    return msg
  }

  function switchMode(m) { setMode(m); setError(''); setResetSent(false) }

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
        emailRedirectTo: authRedirectUrl,
        data: { name: form.name, student_id: form.student_id, grade: form.grade },
      },
    })
    if (error) setError(error.message)
    else setRegistered(true)
    setLoading(false)
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!form.email.trim()) { setError('请输入邮箱地址'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: authRedirectUrl,
    })
    if (error) setError(error.message)
    else setResetSent(true)
    setLoading(false)
  }

  return (
    <div className="auth-bg">
      <canvas ref={canvasRef} />
      <DigitalRain canvasRef={canvasRef} />
      <div className="auth-card" ref={authCardRef}>
        <div className="auth-header">
          <div className="auth-logo">
            <Terminal size={30} />
          </div>
          <h1>LAB_304</h1>
          <p>登录 // 预约 // 签到</p>
        </div>

        {mode !== 'forgot' ? (
          <div className="tab-group">
            <button className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>
              <LogIn size={14} /> 登录
            </button>
            <button className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>
              <UserPlus size={14} /> 注册
            </button>
          </div>
        ) : (
          <div className="tab-group">
            <button className="tab active"><KeyRound size={14} /> 找回密码</button>
          </div>
        )}

        {registered && (
          <div className="success-msg">注册成功，请查收邮件完成验证。</div>
        )}

        {resetSent && (
          <div className="success-msg">重置邮件已发送，请查收邮箱并点击链接设置新密码。</div>
        )}

        {mode === 'forgot' ? (
          <form onSubmit={handleForgot} className="auth-form">
            <div className="field-group">
              <label>邮箱</label>
              <input type="email" placeholder="请输入注册邮箱" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            {error && <div className="error-msg">{friendlyError(error)}</div>}
            <button type="submit" className="btn-primary" disabled={loading || resetSent}>
              {loading ? '处理中...' : resetSent ? '已发送' : '> 发送重置邮件'}
            </button>
            <button type="button" className="btn-link" onClick={() => switchMode('login')}>
              返回登录
            </button>
          </form>
        ) : (
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
              <>
                <div className="remember-row">
                  <input type="checkbox" id="remember" checked={remember} onChange={e => setRemember(e.target.checked)} />
                  <label htmlFor="remember">记住我</label>
                  <button type="button" className="btn-link" onClick={() => switchMode('forgot')} style={{ marginLeft: 'auto' }}>
                    忘记密码?
                  </button>
                </div>
              </>
            )}
            {error && <div className="error-msg">{friendlyError(error)}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '处理中...' : mode === 'login' ? '> 登录' : '> 注册'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
