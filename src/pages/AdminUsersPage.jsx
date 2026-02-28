import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatMinutes } from '../lib/constants'
import { Users } from 'lucide-react'

export default function AdminUsersPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/', { replace: true })
  }, [profile, navigate])

  useEffect(() => {
    if (!profile?.is_admin) return
    supabase
      .from('users')
      .select('name, student_id, grade, points, total_minutes, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setUsers(data || []); setLoading(false) })
  }, [profile])

  if (!profile?.is_admin) return null

  return (
    <div className="page-container">
      <h2 className="page-title"><Users size={20} /> 用户列表</h2>
      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>学号</th>
                <th>年级</th>
                <th>积分</th>
                <th>学习时长</th>
                <th>注册时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.student_id}>
                  <td>{u.name}</td>
                  <td>{u.student_id}</td>
                  <td>{u.grade}</td>
                  <td>{u.points ?? 0}</td>
                  <td>{formatMinutes(u.total_minutes)}</td>
                  <td>{new Date(u.created_at).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
