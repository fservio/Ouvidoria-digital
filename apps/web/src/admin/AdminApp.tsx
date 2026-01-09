import React, { useState } from 'react'
import Login from './Login'
import Tickets from './Tickets'
import Users from './Users'
import Relatorios from './Relatorios'

const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'))

  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken(null)
    window.location.href = '/'
  }

  const path = window.location.pathname.replace('/admin', '') || '/'

  if (!token && path !== '/login' && path !== '/') {
    window.location.href = '/admin/login'
    return null
  }

  if (!token && (path === '/login' || path === '/')) {
    return <Login onLogin={(t) => setToken(t)} />
  }

  if (path.startsWith('/tickets')) return <Tickets token={token!} onLogout={logout} />
  if (path.startsWith('/users')) return <Users token={token!} onLogout={logout} />
  if (path.startsWith('/relatorios')) return <Relatorios token={token!} onLogout={logout} />

  // default
  return <Tickets token={token!} onLogout={logout} />
}

export default AdminApp
