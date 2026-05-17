import { useState } from 'react'
import Auth from './components/auth'
import './App.css'

function App() {
  const [loadAuth, setLoadAuth] = useState(false)
  //function for auth
  const handleAuth = () => {
    console.log('Auth button clicked')
    setLoadAuth(true)
  }


  return (
    <>
      {loadAuth ? (
        <Auth />
      ) : (
        <button id='auth' onClick={handleAuth}>Login</button>
      )}
    </>
  )
}

export default App
