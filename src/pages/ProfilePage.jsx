import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AVATAR_FALLBACK, formatMinutes, formatPoints, formatGender, GENDER_OPTIONS } from '../lib/constants'
import { User, Upload, Loader2, LogOut, X } from 'lucide-react'

export default function ProfilePage() {
  const { session, profile, fetchProfile } = useAuth()
  const avatarRef = useRef(null)
  const idPhotoRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [idPhotoUploading, setIdPhotoUploading] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [editForm, setEditForm] = useState(null)
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
    setAvatarUploading(true); setMsg(null)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) { setMsg({ type: 'error', text: upErr.message }); setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase
      .from('users').update({ avatar_url: url }).eq('id', profile.id)
    if (dbErr) { setMsg({ type: 'error', text: dbErr.message }); setAvatarUploading(false); return }
    await fetchProfile(profile.id)
    setMsg({ type: 'success', text: '头像已更新' })
    setAvatarUploading(false)
  }

  async function handleIdPhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: '文件大小不能超过 2MB' })
      return
    }
    setIdPhotoUploading(true); setMsg(null)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/id-photo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) { setMsg({ type: 'error', text: upErr.message }); setIdPhotoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase
      .from('users').update({ id_photo_url: url }).eq('id', profile.id)
    if (dbErr) { setMsg({ type: 'error', text: dbErr.message }); setIdPhotoUploading(false); return }
    await fetchProfile(profile.id)
    setMsg({ type: 'success', text: '个人照片已更新' })
    setIdPhotoUploading(false)
  }

  function startEditInfo() {
    setEditForm({
      name: profile.name || '',
      class_name: profile.class_name || '',
      gender: profile.gender || 'male',
      phone: profile.phone || '',
    })
    setEditingInfo(true)
  }

  async function handleSaveInfo() {
    if (!editForm?.name?.trim()) return
    setSaving(true); setMsg(null)
    const { error } = await supabase
      .from('users')
      .update({
        name: editForm.name.trim(),
        class_name: editForm.class_name?.trim() || null,
        gender: editForm.gender || null,
        phone: editForm.phone?.trim() || null,
      })
      .eq('id', profile.id)
    if (error) { setMsg({ type: 'error', text: error.message }) }
    else {
      await fetchProfile(profile.id)
      setMsg({ type: 'success', text: '资料已更新' })
      setEditingInfo(false)
      setEditForm(null)
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
          <div className="profile-avatar-btn" onClick={() => !avatarUploading && avatarRef.current?.click()}>
            <img
              className="profile-avatar"
              src={profile.avatar_url || AVATAR_FALLBACK(profile.student_id)}
              alt=""
            />
            <div className="profile-avatar-overlay">
              {avatarUploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
            </div>
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
        </div>
        <div className="selected-hint" style={{ marginBottom: '0.8rem' }}>
          头像可自定义，用于个人资料展示。
        </div>
        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-num">{formatMinutes(profile.total_minutes ?? 0)}</div>
            <div className="profile-stat-label">学习</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-num">{formatPoints(profile.points)}</div>
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
            <span className="profile-field-value">{profile.name}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">学号</span>
            <span className="profile-field-value">{profile.student_id}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">邮箱</span>
            <span className="profile-field-value">{profile.email || session?.user?.email || '--'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">性别</span>
            <span className="profile-field-value">{formatGender(profile.gender)}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">班级</span>
            <span className="profile-field-value">{profile.class_name || '--'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">联系电话</span>
            <span className="profile-field-value">{profile.phone || '--'}</span>
          </div>
        </div>
        <div className="profile-id-card">
          <div className="profile-id-title">个人信息卡</div>
          <div className="profile-id-upload-row">
            <button
              type="button"
              className="btn-primary"
              onClick={() => !idPhotoUploading && idPhotoRef.current?.click()}
              disabled={idPhotoUploading}
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
            >
              {idPhotoUploading ? '上传中...' : '> 上传个人照片'}
            </button>
            <input
              ref={idPhotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handleIdPhotoUpload}
            />
          </div>
          <div className="profile-id-body">
            <img
              className="profile-id-photo"
              src={profile.id_photo_url || AVATAR_FALLBACK(`id-${profile.student_id}`)}
              alt=""
            />
            <div className="profile-id-meta">
              <div><b>姓名</b>：{profile.name || '--'}</div>
              <div><b>学号</b>：{profile.student_id || '--'}</div>
              <div><b>年级</b>：{profile.grade || '--'}级</div>
              <div><b>性别</b>：{formatGender(profile.gender)}</div>
              <div><b>班级</b>：{profile.class_name || '--'}</div>
              <div><b>联系电话</b>：{profile.phone || '--'}</div>
              <div><b>邮箱</b>：{profile.email || session?.user?.email || '--'}</div>
            </div>
          </div>
        </div>
        {!editingInfo ? (
          <button className="btn-primary" type="button" onClick={startEditInfo} style={{ marginTop: '0.8rem' }}>
            {'> 编辑资料'}
          </button>
        ) : (
          <div className="profile-edit-panel">
            <div className="field-group">
              <label>姓名</label>
              <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field-group">
              <label>班级</label>
              <input value={editForm.class_name} onChange={e => setEditForm(f => ({ ...f, class_name: e.target.value }))} />
            </div>
            <div className="field-group">
              <label>性别</label>
              <select value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                {GENDER_OPTIONS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>联系电话</label>
              <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="announcement-form-actions">
              <button className="btn-ann-save" type="button" onClick={handleSaveInfo} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button className="btn-ann-cancel" type="button" onClick={() => { setEditingInfo(false); setEditForm(null) }}>
                <X size={14} /> 取消
              </button>
            </div>
          </div>
        )}
        <div className="profile-actions">
          <button className="btn-primary btn-logout-profile" onClick={() => supabase.auth.signOut()}>
            <LogOut size={14} />
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </div>
  )
}
