import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import VolunteerPortal from './pages/volunteer/VolunteerPortal'
import Assignments from './pages/volunteer/Assignments'
import Recordings from './pages/volunteer/Recordings'
import Guide from './pages/volunteer/Guide'
import Consent from './pages/volunteer/Consent'
import About from './pages/volunteer/About'
import Account from './pages/volunteer/Account'
import AdminPortal from './pages/admin/AdminPortal'
import Dashboard from './pages/admin/Dashboard'
import AdminRecordings from './pages/admin/AdminRecordings'
import Scripts from './pages/admin/Scripts'
import Volunteers from './pages/admin/Volunteers'
import AdminAssignments from './pages/admin/AdminAssignments'
import CallRoom from './pages/volunteer/CallRoom'

function Guard({ role, children }) {
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('role')
  if (!token) return <Navigate to="/" replace />
  if (userRole !== role) return <Navigate to="/" replace />
  return children
}

function AuthGuard({ children }) {
  if (!localStorage.getItem('token')) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route path="/volunteer" element={<Guard role="volunteer"><VolunteerPortal /></Guard>}>
        <Route index             element={<Navigate to="assignments" replace />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="recordings"  element={<Recordings />} />
        <Route path="guide"       element={<Guide />} />
        <Route path="consent"     element={<Consent />} />
        <Route path="about"       element={<About />} />
        <Route path="account"     element={<Account />} />
      </Route>

      <Route path="/admin" element={<Guard role="admin"><AdminPortal /></Guard>}>
        <Route index             element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"   element={<Dashboard />} />
        <Route path="recordings"  element={<AdminRecordings />} />
        <Route path="scripts"     element={<Scripts />} />
        <Route path="volunteers"  element={<Volunteers />} />
        <Route path="assignments" element={<AdminAssignments />} />
      </Route>

      <Route path="/call/:roomId" element={<AuthGuard><CallRoom /></AuthGuard>} />
    </Routes>
  )
}
