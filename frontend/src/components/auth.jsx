import { useState } from 'react'
import '../styles/auth.css'

function Auth() {
  const [isSignIn, setIsSignIn] = useState(true)


  // submits sign-up form
  const handleSignUpSubmit = async (event) => {
    event.preventDefault()
    // endpoint is /api/auth/signup
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: event.target.username.value,
        password: event.target.password.value,
        phone_number: event.target.phone_number.value,
        email: event.target.email.value,
        medical_conditions: event.target.medical_conditions.value,
      }),
    })
    // extract error
    if (!res.ok) {
      const errorData = await res.json()
      console.error('Error:', errorData.error)
      return
    }
    const data = await res.json()
    console.log(data)

    // locall storage set user data
    localStorage.setItem('user', JSON.stringify(data.user))
    window.location.reload()
  }

  const handleSignInSubmit = async (event) => {
    event.preventDefault()

    
    // endpoint is /api/auth/signin
    const res = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: event.target.email.value,
        password: event.target.password.value,

      }),
    })
    // extract error    
    if (!res.ok) {
      const errorData = await res.json()
      console.error('Error:', errorData.error)
      return
    }

    const data = await res.json()
    console.log(data)
    localStorage.setItem('user', JSON.stringify(data.user))
    window.location.reload()
  }

  const handleToggle = () => {
    setIsSignIn((current) => !current)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isSignIn) {
      handleSignInSubmit(event)
    } else {
      handleSignUpSubmit(event)
    }
  }

  return (
    <div className='auth-page'>
        <h1 className='auth-header'>Authentication</h1>
        <button className="auth-button" type="button" onClick={handleToggle}>
        {isSignIn ? 'Switch to sign up' : 'Switch to sign in'}
      </button>

      {isSignIn ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1 className="auth-title">Sign in</h1>
          <input className="auth-input" type="email" name="email" placeholder="Email" />
          <input className="auth-input" type="password" name="password" placeholder="Password" />
          <button className="auth-button" type="submit">Sign in</button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <h1 className="auth-title">Sign up</h1>
          <input className="auth-input" type="text" name="username" placeholder="Username" />
          <input className="auth-input" type="email" name="email" placeholder="Email" />
          <input className="auth-input" type="password" name="password" placeholder="Password" />
          <input className="auth-input" type="text" name="phone_number" placeholder="Phone Number" />
          <textarea className="auth-input" name="medical_conditions" placeholder="Medical Conditions (optional)" />
          <button className="auth-button" type="submit">Sign up</button>
        </form>
      )}

      
    </div>
  )
}

export default Auth