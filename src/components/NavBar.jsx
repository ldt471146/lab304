import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckCheck, CalendarCheck, Trophy, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/', icon: <LayoutDashboard size={20} />, label: '主页' },
  { to: '/checkin', icon: <CheckCheck size={20} />, label: '签到' },
  { to: '/reserve', icon: <CalendarCheck size={20} />, label: '预约' },
  { to: '/leaderboard', icon: <Trophy size={20} />, label: '排行' },
]

export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="nav-brand">Lab 304</div>
      <div className="nav-links">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {n.icon}
            <span>{n.label}</span>
          </NavLink>
        ))}
      </div>
      <button className="nav-logout" onClick={() => supabase.auth.signOut()}>
        <LogOut size={18} />
      </button>
    </nav>
  )
}
