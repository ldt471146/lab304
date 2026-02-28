import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AVATAR_FALLBACK, formatMinutes } from '../lib/constants'
import { User, Upload, Loader2, Save } from 'lucide-react'

export default function ProfilePage() {
  const { session, profile, fetchProfile } = useAuth()
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [editName, setEditName] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  if (!profile) return <div className="loading">加载中...</div>

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: '文件大小不能超过 2MB' })
      return
    }
    setUploading(true); setMsg(null)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) { setMsg({ type: 'error', text: upErr.message }); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase
      .from('users').update({ avatar_url: url }).eq('id', profile.id)
    if (dbErr) { setMsg({ type: 'error', text: dbErr.message }); setUploading(false); return }
    await fetchProfile(profile.id)
    setMsg({ type: 'success', text: '头像已更新' })
    setUploading(false)
  }

  async function handleSaveName() {
    if (!editName?.trim() || editName.trim() === profile.name) { setEditName(null); return }
    setSaving(true); setMsg(null)
    const { error } = await supabase
      .from('users').update({ name: editName.trim() }).eq('id', profile.id)
    if (error) { setMsg({ type: 'error', text: error.message }) }
    else {
      await fetchProfile(profile.id)
      setMsg({ type: 'success', text: '姓名已更新' })
      setEditName(null)
    }
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="page-header">
        <User size={20} />
        <h2>个人资料</h2>
      </div>
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-btn" onClick={() => !uploading && fileRef.current?.click()}>
            <img
              className="profile-avatar"
              src={profile.avatar_url || AVATAR_FALLBACK(profile.student_id)}
              alt=""
            />
            <div className="profile-avatar-overlay">
              {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
        </div>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-num">{formatMinutes(profile.total_minutes ?? 0)}</div>
            <div className="profile-stat-label">学习</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-num">{profile.points ?? 0}</div>
            <div className="profile-stat-label">积分</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-num">{profile.grade}</div>
            <div className="profile-stat-label">年级</div>
          </div>
        </div>
        <div className="profile-fields">
          <div className="profile-field">
            <span className="profile-field-label">姓名</span>
            {editName !== null ? (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <input className="profile-edit-input" value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()} autoFocus />
                <button className="icon-btn" onClick={handleSaveName} disabled={saving}>
                  <Save size={14} style={{ color: 'var(--neon-green)' }} />
                </button>
              </div>
            ) : (
              <span className="profile-field-value" style={{ cursor: 'pointer' }}
                onClick={() => setEditName(profile.name)} title="点击编辑">
                {profile.name}
              </span>
            )}
          </div>
          <div className="profile-field">
            <span className="profile-field-label">学号</span>
            <span className="profile-field-value">{profile.student_id}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">邮箱</span>
            <span className="profile-field-value">{profile.email || session?.user?.email || '--'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
