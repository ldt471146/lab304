import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckCheck, CalendarCheck, Trophy, LogOut, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { AVATAR_FALLBACK } from '../lib/constants'

const NAV = [
  { to: '/', icon: <LayoutDashboard size={16} />, label: '主页' },
  { to: '/checkin', icon: <CheckCheck size={16} />, label: '签到' },
  { to: '/reserve', icon: <CalendarCheck size={16} />, label: '预约' },
  { to: '/leaderboard', icon: <Trophy size={16} />, label: '排行' },
  { to: '/profile', icon: <User size={16} />, label: '资料' },
]

export default function NavBar() {
  const { profile } = useAuth()
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
      </div>
      <div className="nav-bottom">
        <button className="nav-logout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={16} />
          <span>退出登录</span>
        </button>
      </div>
    </nav>
  )
}
