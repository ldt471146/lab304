import { useRef, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SetupProfile from './pages/SetupProfile'
import PendingApprovalPage from './pages/PendingApprovalPage'
import Dashboard from './pages/Dashboard'
import CheckinPage from './pages/CheckinPage'
import ReservePage from './pages/ReservePage'
import LeaderboardPage from './pages/LeaderboardPage'
import DutyPage from './pages/DutyPage'
import ProfilePage from './pages/ProfilePage'
import AdminUsersPage from './pages/AdminUsersPage'
import NavBar from './components/NavBar'
import UpdatePrompt from './components/UpdatePrompt'

function AppRoutes() {
  const { session, profile, passwordRecovery } = useAuth()
  const mainRef = useRef(null)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  function onTouchStart(e) {
    if (refreshing) return
    const main = mainRef.current
    if (!main) return
    if (main.scrollTop > 0) return
    startYRef.current = e.touches[0].clientY
    pullingRef.current = true
  }

  function onTouchMove(e) {
    if (!pullingRef.current || refreshing) return
    const dy = e.touches[0].clientY - startYRef.current
    if (dy <= 0) {
      setPullDistance(0)
      return
    }
    e.preventDefault()
    setPullDistance(Math.min(96, dy * 0.55))
  }

  function onTouchEnd() {
    if (!pullingRef.current || refreshing) return
    pullingRef.current = false
    if (pullDistance >= 72) {
      setRefreshing(true)
      setPullDistance(56)
      setTimeout(() => window.location.reload(), 450)
      return
    }
    setPullDistance(0)
  }

  if (session === undefined || (session && profile === undefined)) return <div className="loading full">加载中...</div>
  if (passwordRecovery) return <ResetPasswordPage />
  if (!session) return <AuthPage />
  if (profile === null) return <SetupProfile />
  if (profile.approval_status !== 'approved') return <PendingApprovalPage status={profile.approval_status} />
  return (
    <div className="app-layout">
      <NavBar />
      <main
        ref={mainRef}
        className="main-content"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className={`pull-refresh ${refreshing ? 'refreshing' : ''}`} style={{ height: `${Math.max(pullDistance, refreshing ? 56 : 0)}px` }}>
          <span>
            {refreshing ? '刷新中...' : pullDistance >= 72 ? '松开刷新' : pullDistance > 0 ? '下拉刷新' : ''}
          </span>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checkin" element={<CheckinPage />} />
          <Route path="/reserve" element={<ReservePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/duty" element={<DutyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <AuthProvider>
          <UpdatePrompt />
          <AppRoutes />
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  )
}
