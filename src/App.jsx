import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SetupProfile from './pages/SetupProfile'
import Dashboard from './pages/Dashboard'
import CheckinPage from './pages/CheckinPage'
import ReservePage from './pages/ReservePage'
import LeaderboardPage from './pages/LeaderboardPage'
import DutyPage from './pages/DutyPage'
import ProfilePage from './pages/ProfilePage'
import AdminUsersPage from './pages/AdminUsersPage'
import NavBar from './components/NavBar'

function AppRoutes() {
  const { session, profile, passwordRecovery } = useAuth()
  if (session === undefined || (session && profile === undefined)) return <div className="loading full">加载中...</div>
  if (passwordRecovery) return <ResetPasswordPage />
  if (!session) return <AuthPage />
  if (profile === null) return <SetupProfile />
  return (
    <div className="app-layout">
      <NavBar />
      <main className="main-content">
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
      <BrowserRouter basename="/lab304">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
