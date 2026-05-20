// get the profile dashboard component, rendering 
/*
<div>
          <h1>Welcome, {user.username}</h1>
          <p>Email: {user.email}</p>
          <p>Phone Number: {user.phone_number}</p>
        </div>

from localStorage user data, and display it on the profile dashboard. 
*/
import React, { useState } from 'react'
import MainPage from "./main_page"

function ProfileDashboard() {
    const [loadUser, setLoadUser] = useState(false)

    const raw = localStorage.getItem('user')
    const user = raw ? JSON.parse(raw) : null

    if (!user) {
        return <p>No user data found</p>
    }



    return (
        <div>
            {loadUser ? (
                <MainPage />
            ) : (
                <>
                    <div>
                        <h1>Welcome, {user.username}</h1>
                        <p>Email: {user.email}</p>
                        <p>Phone Number: {user.phone_number}</p>
                    </div>
                    <div>
                        <button onClick={() => { localStorage.removeItem('user'); window.location.reload(); }}>Logout</button>
                    </div>
                    <div>
                        <button onClick={() => setLoadUser(true)}>Start Work</button>
                    </div>
                </>
            )}
        </div>
    )
}

export default ProfileDashboard