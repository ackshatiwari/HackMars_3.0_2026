import React, { useEffect, useMemo, useState } from 'react'
import MainPage from './main_page/main_page'
import '../styles/patient_dashboard.css'

function toList(value) {
	if (Array.isArray(value)) return value
	if (value === null || value === undefined || value === '') return []
	return [value]
}

function toDisplayList(value) {
	return toList(value)
		.flatMap((item) => {
			if (item === null || item === undefined || item === '') return []
			if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
				return [String(item)]
			}
			if (Array.isArray(item)) {
				return item.map((nested) => String(nested))
			}
			if (typeof item === 'object') {
				const values = Object.values(item).filter((nested) => nested !== null && nested !== undefined && nested !== '')
				if (values.length > 0) {
					return values.map((nested) => String(nested))
				}
				return []
			}
			return [String(item)]
		})
		.filter(Boolean)
}

function formatDisplayValue(value, fallback = 'Not provided') {
	if (value === null || value === undefined || value === '') return fallback
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(', ') : fallback
	}
	return JSON.stringify(value)
}

function PatientDashboard() {
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

	const medicalConditions = formatDisplayValue(displayUser.medical_conditions)
	const emergencyPhoneContacts = toDisplayList(profile?.emergency_phone_contacts || displayUser.emergency_phone_contacts)
	const emergencyEmailContacts = toDisplayList(profile?.emergency_email_contacts || displayUser.emergency_email_contacts)
	const totalContactsConfigured = emergencyPhoneContacts.length + emergencyEmailContacts.length
	const profileStatus = profile ? 'Synced' : 'Using local profile'

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
		<div className='dashboard-root dashboard-container'>
			<aside className='dashboard-sidebar'>
				<div className='dashboard-card dashboard-hero'>
					<p className='dashboard-label'>Profile</p>
					<h2 className='dashboard-username'>{displayUser.username}</h2>
					{profileError ? <p className='dashboard-error'>{profileError}</p> : null}
				</div>

				<div className='dashboard-grid'>
					<div className='dashboard-mini'>
						<span className='dashboard-title'>Email</span>
						<span className='dashboard-value'>{displayUser.email}</span>
					</div>
					<div className='dashboard-mini'>
						<span className='dashboard-title'>Phone</span>
						<span className='dashboard-value'>{displayUser.phone_number || 'Not provided'}</span>
					</div>
					<div className='dashboard-mini dashboard-wide'>
						<span className='dashboard-title'>Medical Conditions</span>
						<span className='dashboard-value'>{medicalConditions}</span>
					</div>
					<div className='dashboard-mini'>
						<span className='dashboard-title'>Emergency Phones</span>
						<div className='dashboard-chip-list'>
							{emergencyPhoneContacts.length > 0 ? emergencyPhoneContacts.map((contact, index) => (
								<span className='dashboard-chip' key={`${contact}-${index}`}>{contact}</span>
							)) : <span className='dashboard-muted'>None added</span>}
						</div>
					</div>
					<div className='dashboard-mini'>
						<span className='dashboard-title'>Emergency Emails</span>
						<div className='dashboard-chip-list'>
							{emergencyEmailContacts.length > 0 ? emergencyEmailContacts.map((contact, index) => (
								<span className='dashboard-chip' key={`${contact}-${index}`}>{contact}</span>
							)) : <span className='dashboard-muted'>None added</span>}
						</div>
					</div>
				</div>
			</aside>

			<main className='dashboard-main'>
				<div className='dashboard-right-stack'>
					<div className='dashboard-card dashboard-actions-card'>
						<div className='dashboard-actions'>
							<button className='dashboard-start' onClick={() => setLoadUser(true)}>Begin Analysis</button>
							<button className='dashboard-settings-toggle' onClick={() => setShowSettings((prev) => !prev)}>
								{showSettings ? 'Hide Settings' : 'Settings'}
							</button>
						</div>
						<p className='dashboard-muted'>Click "Settings" to view and update emergency contact preferences.</p>
					</div>

					{showSettings ? (
						<section className='dashboard-settings-panel'>
							<div className='dashboard-settings-card'>
								<h3 className='dashboard-settings-title'>Profile Settings</h3>
								<label className='checkbox-label'>
									<input type="checkbox" /> Inform detector of my medical conditions for better analysis
								</label>
								<label className='checkbox-label'>
									<input type="checkbox" id="distress-notification-phone" onChange={loadTextFieldsForPhone} /> Send a push notification to my loved one if I am detected to be in distress
								</label>
								{loadPhoneTextField && (
									<div className='dashboard-textfield'>
										<label htmlFor="phone-number" className='checkbox-label' id="phone-number-label">Emergency phone contact:</label>
										<input type="text" id="phone-number" placeholder="Enter emergency phone" />
									</div>
								)}
								<label className='checkbox-label'>
									<input type="checkbox" id="distress-notification-email" onChange={loadTextFieldsForEmail} /> Send an email notification to my loved one if I am detected to be in distress
								</label>
								{loadEmailTextField && (
									<div className='dashboard-textfield'>
										<label htmlFor="email" className='checkbox-label' id="email-label">Emergency email contact:</label>
										<input type="text" id="email" placeholder="Enter emergency email" />
									</div>
								)}
								<button onClick={applyChanges}>Apply Changes</button>
							</div>
						</section>
					) : (
						<>
							<div className='dashboard-card dashboard-summary-card'>
								<h3 className='dashboard-section-title'>Quick Summary</h3>
								<div className='dashboard-summary-grid'>
									<div>
										<p className='dashboard-summary-label'>Profile Status</p>
										<p className='dashboard-summary-value'>{profileStatus}</p>
									</div>
									<div>
										<p className='dashboard-summary-label'>Contacts Configured</p>
										<p className='dashboard-summary-value'>{totalContactsConfigured}</p>
									</div>
									<div>
										<p className='dashboard-summary-label'>Emergency Phones</p>
										<p className='dashboard-summary-value'>{emergencyPhoneContacts.length}</p>
									</div>
									<div>
										<p className='dashboard-summary-label'>Emergency Emails</p>
										<p className='dashboard-summary-value'>{emergencyEmailContacts.length}</p>
									</div>
								</div>
							</div>

							<div className='dashboard-card dashboard-activity-card'>
								<h3 className='dashboard-section-title'>Recent Activity</h3>
								<ul className='dashboard-activity-list'>
									<li>Profile loaded successfully</li>
									<li>Emergency contacts synced from account</li>
									<li>Open Settings to update notification preferences</li>
								</ul>
							</div>

							<div className='dashboard-card dashboard-checklist-card'>
								<h3 className='dashboard-section-title'>Safety Checklist</h3>
								<ul className='dashboard-activity-list'>
									<li>At least one emergency phone is added</li>
									<li>At least one emergency email is added</li>
									<li>Medical condition information is up to date</li>
								</ul>
							</div>
						</>
					)}
				</div>
			</main>
		</div>
	)
}

export default PatientDashboard
