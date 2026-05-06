import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import VolunteerPortal from './pages/volunteer/VolunteerPortal'
import AdminPortal from './pages/admin/AdminPortal'

function Guard({ role, children }) {
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('role')
  if (!token) return <Navigate to="/" replace />
  if (userRole !== role) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/volunteer" element={<Guard role="volunteer"><VolunteerPortal /></Guard>} />
      <Route path="/admin" element={<Guard role="admin"><AdminPortal /></Guard>} />
    </Routes>
  )
}
