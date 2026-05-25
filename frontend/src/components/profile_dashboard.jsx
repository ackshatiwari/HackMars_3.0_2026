import React, { useEffect, useMemo, useState } from 'react'
import MainPage from './main_page/main_page'
import '../styles/profile_dashboard.css'

function toList(value) {
    if (Array.isArray(value)) return value
    if (value === null || value === undefined || value === '') return []
    return [value]
}

function ProfileDashboard() {
    const [loadUser, setLoadUser] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [loadPhoneTextField, setLoadPhoneTextField] = useState(false)
    const [loadEmailTextField, setLoadEmailTextField] = useState(false)
    const [profile, setProfile] = useState(null)
    const [profileError, setProfileError] = useState('')

    const raw = localStorage.getItem('user')
    const localUser = raw ? JSON.parse(raw) : null

    useEffect(() => {
        let isMounted = true

        const loadProfile = async () => {
            if (!localUser?.email) return

            try {
                const resp = await fetch(`/api/auth/profile?email=${encodeURIComponent(localUser.email)}`)
                const data = await resp.json().catch(() => null)

                if (!resp.ok) {
                    throw new Error(data?.error || 'Failed to load profile')
                }

                if (isMounted) {
                    setProfile(data)
                    setProfileError('')
                }
            } catch (error) {
                if (isMounted) {
                    setProfileError(error.message)
                    setProfile(null)
                }
            }
        }

        loadProfile()

        return () => {
            isMounted = false
        }
    }, [localUser?.email])

    const displayUser = useMemo(() => profile || localUser, [profile, localUser])

    if (!displayUser) {
        return <p>No user data found</p>
    }

    const medicalConditions = displayUser.medical_conditions || 'Not provided'
    const emergencyPhoneContacts = toList(profile?.emergency_phone_contacts || displayUser.emergency_phone_contacts)
    const emergencyEmailContacts = toList(profile?.emergency_email_contacts || displayUser.emergency_email_contacts)

    const loadTextFieldsForPhone = (event) => {
        setLoadPhoneTextField(event.target.checked)
    }

    const loadTextFieldsForEmail = (event) => {
        setLoadEmailTextField(event.target.checked)
    }

    const applyChanges = async () => {
        const phoneNumberForNotifications = document.getElementById('phone-number') ? document.getElementById('phone-number').value : null
        const emailForNotifications = document.getElementById('email') ? document.getElementById('email').value : null

        try {
            const res = await fetch('/api/auth/update_notification_preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: displayUser.email,
                    phone_number_for_notifications: phoneNumberForNotifications,
                    email_for_notifications: emailForNotifications
                })
            })

            const contentType = res.headers.get('content-type') || ''
            const data = contentType.includes('application/json') ? await res.json().catch(() => null) : null
            if (res.ok) {
                alert('Notification preferences updated successfully')
                document.getElementById('phone-number').value = ''
                document.getElementById('email').value = ''
                document.getElementById('distress-notification-phone').checked = false
                document.getElementById('distress-notification-email').checked = false
                setLoadPhoneTextField(false)
                setLoadEmailTextField(false)
                setProfile((prev) => prev ? {
                    ...prev,
                    emergency_phone_contacts: data?.emergency_phone_contacts || prev.emergency_phone_contacts,
                    emergency_email_contacts: data?.emergency_email_contacts || prev.emergency_email_contacts,
                } : prev)
            } else {
                alert(data?.error || 'Error updating notification preferences')
            }
        } catch (error) {
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
                <div className='pd-card pd-card-hero'>
                    <p className='pd-label'>Profile</p>
                    <h2 className='pd-username'>{displayUser.username}</h2>
                    {profileError ? <p className='pd-error'>{profileError}</p> : null}
                </div>

                <div className='pd-card-grid'>
                    <div className='pd-mini-card'>
                        <span className='pd-card-title'>Email</span>
                        <span className='pd-card-value'>{displayUser.email}</span>
                    </div>
                    <div className='pd-mini-card'>
                        <span className='pd-card-title'>Phone</span>
                        <span className='pd-card-value'>{displayUser.phone_number || 'Not provided'}</span>
                    </div>
                    <div className='pd-mini-card pd-mini-card-wide'>
                        <span className='pd-card-title'>Medical Conditions</span>
                        <span className='pd-card-value'>{medicalConditions}</span>
                    </div>
                    <div className='pd-mini-card'>
                        <span className='pd-card-title'>Emergency Phones</span>
                        <div className='pd-chip-list'>
                            {emergencyPhoneContacts.length > 0 ? emergencyPhoneContacts.map((contact, index) => (
                                <span className='pd-chip' key={`${contact}-${index}`}>{contact}</span>
                            )) : <span className='pd-muted'>None added</span>}
                        </div>
                    </div>
                    <div className='pd-mini-card'>
                        <span className='pd-card-title'>Emergency Emails</span>
                        <div className='pd-chip-list'>
                            {emergencyEmailContacts.length > 0 ? emergencyEmailContacts.map((contact, index) => (
                                <span className='pd-chip' key={`${contact}-${index}`}>{contact}</span>
                            )) : <span className='pd-muted'>None added</span>}
                        </div>
                    </div>
                </div>
            </aside>

            <main className='pd-main'>
                <div className='pd-actions'>
                    <button className='pd-start' onClick={() => setLoadUser(true)}>Proceed</button>
                    <button className='pd-settings-toggle' onClick={() => setShowSettings((prev) => !prev)}>
                        {showSettings ? 'Hide Settings' : 'Settings'}
                    </button>
                </div>

                {showSettings ? (
                    <section className='pd-settings-panel'>
                        <div className='pd-settings-card'>
                            <h3 className='pd-settings'>Profile Settings</h3>
                            <label className='checkbox-label'>
                                <input type="checkbox" /> Inform detector of my medical conditions for better analysis
                            </label>
                            <label className='checkbox-label'>
                                <input type="checkbox" id="distress-notification-phone" onChange={loadTextFieldsForPhone} /> Send a push notification to my loved one if I am detected to be in distress
                            </label>
                            {loadPhoneTextField && (
                                <div className='pd-textfield'>
                                    <label htmlFor="phone-number" className='checkbox-label' id="phone-number-label">Emergency phone contact:</label>
                                    <input type="text" id="phone-number" placeholder="Enter emergency phone" />
                                </div>
                            )}
                            <label className='checkbox-label'>
                                <input type="checkbox" id="distress-notification-email" onChange={loadTextFieldsForEmail} /> Send an email notification to my loved one if I am detected to be in distress
                            </label>
                            {loadEmailTextField && (
                                <div className='pd-textfield'>
                                    <label htmlFor="email" className='checkbox-label' id="email-label">Emergency email contact:</label>
                                    <input type="text" id="email" placeholder="Enter emergency email" />
                                </div>
                            )}
                            <button onClick={applyChanges}>Apply Changes</button>
                        </div>
                    </section>
                ) : (
                    <div className='pd-empty'>
                        <p>Click "Settings" to view and update emergency contact preferences.</p>
                    </div>
                )}
            </main>
        </div>
    )
}

export default ProfileDashboard