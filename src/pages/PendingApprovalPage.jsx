import { ShieldAlert } from 'lucide-react'
import { supabase } from '../lib/supabase'

const STATUS_TEXT = {
  pending: '账号已提交，等待管理员审核通过。',
  rejected: '账号审核未通过，请联系管理员处理。',
}

export default function PendingApprovalPage({ status = 'pending' }) {
  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><ShieldAlert size={30} /></div>
          <h1>账号审核中</h1>
          <p>{STATUS_TEXT[status] || STATUS_TEXT.pending}</p>
        </div>
        <div className="auth-form">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            {'> 刷新状态'}
          </button>
          <button type="button" className="btn-link" onClick={() => supabase.auth.signOut()}>
            退出登录
          </button>
        </div>
      </div>
    </div>
  )
}
