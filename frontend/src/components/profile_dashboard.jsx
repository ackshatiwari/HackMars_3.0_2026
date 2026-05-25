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
import MainPage from "./main_page/main_page"
import '../styles/profile_dashboard.css'

function ProfileDashboard() {
    const [loadUser, setLoadUser] = useState(false)

    const raw = localStorage.getItem('user')
    const user = raw ? JSON.parse(raw) : null

    if (!user) {
        return <p>No user data found</p>
    }



    if (loadUser) {
        return <MainPage />
    }

    return (
        <div className='profile-dashboard pd-container'>
            <aside className='pd-sidebar'>
                <div className='pd-card'>
                    <h2 className='pd-username'>{user.username}</h2>
                    <p className='pd-info'><strong>Email:</strong> {user.email}</p>
                    <p className='pd-info'><strong>Phone:</strong> {user.phone_number}</p>
                </div>
                <p className='pd-medical'><strong>Medical Conditions:</strong> {user.medical_conditions}</p>
                
            </aside>

            <main className='pd-main'>
                <div className='pd-actions'>
                    <button className='pd-start' onClick={() => setLoadUser(true)}>Proceed</button>
                </div>
                <div className='pd-empty'>
                    <p>Click "Proceed" to open the workspace for recording or uploading footage.</p>
                </div>
            </main>
        </div>
    )
}

export default ProfileDashboard