import { useState, useEffect } from 'react'
import Auth from './components/auth'
import PatientDashboard from './components/patient_dashboard'
import FamilyDashboard from './components/family_dashboard'
import LandingPage from './components/landing_page'
import './App.css'
// compact UI overrides to reduce whitespace
import './styles/compact_overrides.css'

function App() {
  const [activeView, setActiveView] = useState('landing')
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

  const handleOpenAuth = () => setActiveView('auth')
  const handleViewProfile = () => setActiveView('dashboard')
  const handleBackToLanding = () => setActiveView('landing')

  const normalizedRole = (user?.role || '').toString().toLowerCase()
  const renderDashboard = normalizedRole === 'family' ? <FamilyDashboard /> : <PatientDashboard />

  let content
  if (activeView === 'dashboard') {
    content = renderDashboard
  } else if (activeView === 'auth') {
    content = (
      <>
        <div style={{ padding: '12px 16px' }}>
          <button type="button" onClick={handleBackToLanding}>Back</button>
        </div>
        <Auth />
      </>
    )
  } else {
    content = (
      <LandingPage
        isSignedIn={Boolean(user)}
        user={user}
        onSignIn={handleOpenAuth}
        onViewProfile={handleViewProfile}
      />
    )
  }

  return (
    <div className='app-shell'>
      <header className='app-topbar'>
        <img src='/GuardSight_Logo.png' alt='GuardSight' className='app-logo' />
      </header>
      <div className='app-content'>
        {content}
      </div>
    </div>
  )
}

export default App
