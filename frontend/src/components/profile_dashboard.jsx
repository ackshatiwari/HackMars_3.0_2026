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
    const [loadPhoneTextField, setLoadPhoneTextField] = useState(false)
    const [loadEmailTextField, setLoadEmailTextField] = useState(false)

    const loadTextFieldsForPhone = (event) => {
        setLoadPhoneTextField(event.target.checked)
    }

    const loadTextFieldsForEmail = (event) => {
        setLoadEmailTextField(event.target.checked)
    }

    const raw = localStorage.getItem('user')
    const user = raw ? JSON.parse(raw) : null

    if (!user) {
        return <p>No user data found</p>
    }

    const applyChanges = async (event) => {
        const phoneNumberForNotifications = document.getElementById('phone-number') ? document.getElementById('phone-number').value : null
        const emailForNotifications = document.getElementById('email') ? document.getElementById('email').value : null

        try {
            const res = await fetch('/api/auth/update_notification_preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: user.email,
                    phone_number_for_notifications: phoneNumberForNotifications,
                    email_for_notifications: emailForNotifications
                })
            })

            const contentType = res.headers.get('content-type') || ''
            const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null
            if (res.ok) {
                alert('Notification preferences updated successfully')
                // clear the text fields and uncheck the checkboxes
                document.getElementById('phone-number').value = ''
                document.getElementById('email').value = ''
                document.getElementById('distress-notification-phone').checked = false
                document.getElementById('distress-notification-email').checked = false
                setLoadPhoneTextField(false)
                setLoadEmailTextField(false)
            } else {
                alert(data?.error || 'Error updating notification preferences')
            }
        }
        catch (error) {
            console.error('Error updating notification preferences:', error)
            alert('Error updating notification preferences')
        }

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
                <h3 className='pd-settings'>Profile Settings</h3>
                {/* Add checkboxes */}
                <div className='pd-checkbox'>
                    <label className='checkbox-label'>
                        <input type="checkbox" /> Inform detector of my medical conditions for better analysis
                    </label>
                    <label className='checkbox-label'>
                        <input type="checkbox" id="distress-notification-phone" onChange={loadTextFieldsForPhone} /> Send a push notification to my loved one if I am detected to be in distress
                    </label>
                    {loadPhoneTextField && (
                        <div className='pd-textfield'>
                            <label htmlFor="phone-number" className='checkbox-label' id="phone-number-label">Phone Number for Notifications:</label>
                            <input type="text" id="phone-number" placeholder="Enter phone number for notifications" />
                        </div>
                    )}
                    <label className='checkbox-label'>
                        <input type="checkbox" id="distress-notification-email" onChange={loadTextFieldsForEmail} /> Send an email notification to my loved one if I am detected to be in distress
                    </label>
                    {loadEmailTextField && (
                        <div className='pd-textfield'>
                            <label htmlFor="email" className='checkbox-label' id="email-label">Email for Notifications:</label>
                            <input type="text" id="email" placeholder="Enter email for notifications" />
                        </div>
                    )}
                </div>

                <button onClick={applyChanges}>Apply Changes</button>
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