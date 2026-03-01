import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckCheck, CalendarCheck, Trophy, CalendarClock, LogOut, User, Users, Sun, Moon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AVATAR_FALLBACK } from '../lib/constants'
import { useTheme } from '../context/ThemeContext'

const NAV = [
  { to: '/', icon: <LayoutDashboard size={16} />, label: '主页' },
  { to: '/checkin', icon: <CheckCheck size={16} />, label: '签到' },
  { to: '/reserve', icon: <CalendarCheck size={16} />, label: '预约' },
  { to: '/leaderboard', icon: <Trophy size={16} />, label: '排行' },
  { to: '/duty', icon: <CalendarClock size={16} />, label: '值日' },
  { to: '/profile', icon: <User size={16} />, label: '资料' },
]

export default function NavBar() {
  const { profile } = useAuth()
  const { theme, toggle } = useTheme()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!profile?.is_admin) return
    let mounted = true
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
      .then(({ count, error }) => {
        if (!mounted) return
        if (error) {
          console.error('fetchPendingCount:', error.message)
          setPendingCount(0)
          return
        }
        setPendingCount(count || 0)
      })
    return () => { mounted = false }
  }, [profile?.is_admin])

  return (
    <nav className="navbar">
      <div className="nav-brand cursor-blink">LAB_304</div>
      {profile && (
        <div className="nav-user-info">
          <img
            className="nav-avatar"
            src={profile.avatar_url || AVATAR_FALLBACK(profile.student_id)}
            alt=""
          />
          <span className="nav-username">{profile.name}</span>
        </div>
      )}
      <div className="nav-links">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {n.icon}
            <span>{n.label}</span>
          </NavLink>
        ))}
        {profile?.is_admin && (
          <NavLink to="/admin/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users size={16} />
            <span className="nav-label-wrap">
              <span>用户</span>
              {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
            </span>
          </NavLink>
        )}
      </div>
      <div className="nav-bottom">
        <button className="theme-toggle" onClick={toggle}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === 'dark' ? '浅色' : '深色'}</span>
        </button>
        <button className="nav-logout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} />
          <span>退出登录</span>
        </button>
      </div>
    </nav>
  )
}
