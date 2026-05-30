import { useState, useEffect } from 'react'
import Auth from './components/auth'
import PatientDashboard from './components/patient_dashboard'
import FamilyDashboard from './components/family_dashboard'
import './App.css'

function App() {
  const [loadAuth, setLoadAuth] = useState(false)
  const [user, setUser] = useState(null)

  // read user from localStorage once on mount
  useEffect(() => {
    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        console.log('User data from localStorage:', parsed)
        setUser(parsed)
      } catch (err) {
        console.error('Failed to parse user from localStorage', err)
        setUser(null)
      }
    } else {
      console.log('No user data found in localStorage')
      setUser(null)
    }
  }, [])

  const handleAuth = () => {
    console.log('Auth button clicked')
    setLoadAuth(true)
  }

  const normalizedRole = (user?.role || '').toString().toLowerCase()

  return (
    <>
      {user ? (
        normalizedRole === 'family' ? <FamilyDashboard /> : <PatientDashboard />
      ) : loadAuth ? (
        <Auth />
      ) : (
        <button id="auth" onClick={handleAuth}>Login</button>
      )}
    </>
  )
}

export default App
