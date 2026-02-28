import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { KeyRound } from 'lucide-react'

export default function ResetPasswordPage() {
  const { clearPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setError('密码至少 6 位'); return }
    if (password !== confirm) { setError('两次输入的密码不一致'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setSuccess(true)
    setLoading(false)
    setTimeout(() => clearPasswordRecovery(), 1500)
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><KeyRound size={30} /></div>
          <h1>设置新密码</h1>
          <p>请输入新密码完成重置</p>
        </div>

        {success ? (
          <div className="success-msg">密码重置成功，正在跳转...</div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label>新密码</label>
              <input type="password" placeholder="至少 6 位" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="field-group">
              <label>确认密码</label>
              <input type="password" placeholder="再次输入新密码" value={confirm}
                onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <div className="error-msg">错误: {error}</div>}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '处理中...' : '> 确认重置'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
