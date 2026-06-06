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

function IconEmail() {
	return (
		<svg width='14' height='14' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<rect x='2' y='4' width='12' height='9' rx='1.5' stroke='currentColor' strokeWidth='1.5' />
			<path d='M2 5.5l6 4.5 6-4.5' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	)
}

function IconPhone() {
	return (
		<svg width='14' height='14' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<path d='M5.5 2.5h-1A1.5 1.5 0 0 0 3 4c0 5.5 4.5 10 10 10a1.5 1.5 0 0 0 1.5-1.5v-1a1.5 1.5 0 0 0-1.5-1.5l-1.5.75A7.5 7.5 0 0 1 8.25 6.5L9 5a1.5 1.5 0 0 0-1.5-1.5h-2Z' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	)
}

function IconHeart() {
	return (
		<svg width='14' height='14' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<path d='M8 13.5S2 9.5 2 5.5a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 8-6 8Z' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	)
}

function IconGear() {
	return (
		<svg width='15' height='15' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<path d='M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' stroke='currentColor' strokeWidth='1.5' />
			<path d='M13.3 8c0-.2 0-.5-.1-.7l1.5-1.2-1.5-2.6-1.8.7c-.4-.3-.8-.5-1.3-.7L9.8 2H6.2l-.3 1.5c-.5.2-.9.4-1.3.7l-1.8-.7L1.3 6l1.5 1.2c0 .2-.1.5-.1.7s0 .5.1.7L1.3 10l1.5 2.6 1.8-.7c.4.3.8.5 1.3.7L6.2 14h3.6l.3-1.5c.5-.2.9-.4 1.3-.7l1.8.7 1.5-2.6-1.5-1.2c0-.2.1-.4.1-.7Z' stroke='currentColor' strokeWidth='1.5' />
		</svg>
	)
}

function IconTarget() {
	return (
		<svg width='15' height='15' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<circle cx='8' cy='8' r='6' stroke='currentColor' strokeWidth='1.5' />
			<circle cx='8' cy='8' r='2.5' fill='currentColor' />
		</svg>
	)
}

function IconShield() {
	return (
		<svg width='20' height='20' viewBox='0 0 20 20' fill='none' xmlns='http://www.w3.org/2000/svg'>
			<path d='M10 2L3 5v5c0 4.4 3 8.5 7 9.5 4-1 7-5.1 7-9.5V5l-7-3Z' stroke='currentColor' strokeWidth='1.5' strokeLinejoin='round' />
		</svg>
	)
}

function PatientDashboard() {
	const [loadUser, setLoadUser] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [showNotification, setShowNotification] = useState(true)
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
	const profileStatus = profile ? 'Synced' : 'Local'

	const hasPhone = emergencyPhoneContacts.length > 0
	const hasEmail = emergencyEmailContacts.length > 0
	const hasMedical = medicalConditions !== 'Not provided'
	const completedChecks = [hasPhone, hasEmail, hasMedical].filter(Boolean).length

	const loadTextFieldsForPhone = (event) => setLoadPhoneTextField(event.target.checked)
	const loadTextFieldsForEmail = (event) => setLoadEmailTextField(event.target.checked)

	const applyChanges = async () => {
		const phoneNumberForNotifications = document.getElementById('phone-number') ? document.getElementById('phone-number').value : null
		const emailForNotifications = document.getElementById('email') ? document.getElementById('email').value : null

		try {
			const res = await fetch('/api/auth/update_notification_preferences', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: displayUser.email,
					phone_number_for_notifications: phoneNumberForNotifications,
					email_for_notifications: emailForNotifications,
				}),
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
				setProfile((prev) =>
					prev
						? {
								...prev,
								emergency_phone_contacts: data?.emergency_phone_contacts || prev.emergency_phone_contacts,
								emergency_email_contacts: data?.emergency_email_contacts || prev.emergency_email_contacts,
							}
						: prev,
				)
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

	const activityTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

	return (
		<div className='pd2-root'>
			{/* Page header */}
			<div className='pd2-page-header'>
				<div>
					<p className='pd2-page-label'>Profile</p>
					<div className='pd2-title-row'>
						<h1 className='pd2-page-title'>{displayUser.username}</h1>
						<span className={`pd2-status-badge ${profile ? 'pd2-badge-synced' : 'pd2-badge-local'}`}>{profileStatus}</span>
					</div>
					<p className='pd2-page-sub'>Manage personal and emergency information to help keep you safe.</p>
					{profileError ? <p className='pd2-page-error'>{profileError}</p> : null}
				</div>
				<div className='pd2-header-actions'>
					<button className='pd2-btn-analysis' onClick={() => setLoadUser(true)}>
						<IconTarget /> Begin Analysis
					</button>
					<button className='pd2-btn-settings' onClick={() => setShowSettings((prev) => !prev)}>
						<IconGear /> {showSettings ? 'Hide Settings' : 'Settings'}
					</button>
				</div>
			</div>

			{showSettings ? (
				<div className='pd2-card pd2-settings-card'>
					<h3 className='pd2-settings-title'>Profile Settings</h3>
					<label className='pd2-checkbox-label'>
						<input type='checkbox' /> Inform detector of my medical conditions for better analysis
					</label>
					<label className='pd2-checkbox-label'>
						<input type='checkbox' id='distress-notification-phone' onChange={loadTextFieldsForPhone} /> Send a push notification to my loved one if I am detected to be in distress
					</label>
					{loadPhoneTextField && (
						<div className='pd2-textfield'>
							<label htmlFor='phone-number' className='pd2-checkbox-label'>Emergency phone contact:</label>
							<input type='text' id='phone-number' placeholder='Enter emergency phone' />
						</div>
					)}
					<label className='pd2-checkbox-label'>
						<input type='checkbox' id='distress-notification-email' onChange={loadTextFieldsForEmail} /> Send an email notification to my loved one if I am detected to be in distress
					</label>
					{loadEmailTextField && (
						<div className='pd2-textfield'>
							<label htmlFor='email' className='pd2-checkbox-label'>Emergency email contact:</label>
							<input type='text' id='email' placeholder='Enter emergency email' />
						</div>
					)}
					<button className='pd2-apply-btn' onClick={applyChanges}>Apply Changes</button>
				</div>
			) : (
				<>
					{/* Top 3-column row */}
					<div className='pd2-top-grid'>
						<div className='pd2-card'>
							<h3 className='pd2-card-heading'>Personal Information</h3>
							<div className='pd2-info-field'>
								<span className='pd2-field-icon pd2-icon-email'><IconEmail /></span>
								<div>
									<p className='pd2-field-label'>Email</p>
									<p className='pd2-field-value'>{displayUser.email}</p>
								</div>
							</div>
							<div className='pd2-info-field'>
								<span className='pd2-field-icon pd2-icon-phone'><IconPhone /></span>
								<div>
									<p className='pd2-field-label'>Phone</p>
									<p className='pd2-field-value'>{displayUser.phone_number || 'Not provided'}</p>
								</div>
							</div>
							<div className='pd2-info-field'>
								<span className='pd2-field-icon pd2-icon-health'><IconHeart /></span>
								<div>
									<p className='pd2-field-label'>Medical Condition</p>
									<p className='pd2-field-value'>{medicalConditions}</p>
								</div>
							</div>
						</div>

						<div className='pd2-card'>
							<h3 className='pd2-card-heading'>Quick Summary</h3>
							<div className='pd2-summary-grid'>
								<div className='pd2-summary-cell'>
									<p className='pd2-summary-label'>Profile Status</p>
									<p className='pd2-summary-value'>{profileStatus}</p>
								</div>
								<div className='pd2-summary-cell'>
									<p className='pd2-summary-label'>Contacts Configured</p>
									<p className='pd2-summary-value'>{totalContactsConfigured}</p>
								</div>
								<div className='pd2-summary-cell'>
									<p className='pd2-summary-label'>Emergency Phones</p>
									<p className='pd2-summary-value'>{emergencyPhoneContacts.length}</p>
								</div>
								<div className='pd2-summary-cell'>
									<p className='pd2-summary-label'>Emergency Emails</p>
									<p className='pd2-summary-value'>{emergencyEmailContacts.length}</p>
								</div>
							</div>
						</div>

						<div className='pd2-card'>
							<h3 className='pd2-card-heading'>Emergency Contacts</h3>
							<div className='pd2-contact-row'>
								<span className='pd2-contact-icon pd2-contact-phone'><IconPhone /></span>
								<div className='pd2-contact-details'>
									<p className='pd2-contact-name'>Emergency Phones</p>
									<p className='pd2-contact-count'>{emergencyPhoneContacts.length} contact{emergencyPhoneContacts.length !== 1 ? 's' : ''}</p>
								</div>
								<span className='pd2-chevron'>›</span>
							</div>
							<div className='pd2-contact-row'>
								<span className='pd2-contact-icon pd2-contact-email'><IconEmail /></span>
								<div className='pd2-contact-details'>
									<p className='pd2-contact-name'>Emergency Emails</p>
									<p className='pd2-contact-count'>{emergencyEmailContacts.length} contact{emergencyEmailContacts.length !== 1 ? 's' : ''}</p>
								</div>
								<span className='pd2-chevron'>›</span>
							</div>
						</div>
					</div>

					{/* Bottom 2-column row */}
					<div className='pd2-bottom-grid'>
						<div className='pd2-card'>
							<h3 className='pd2-card-heading'>Recent Activity</h3>
							<div className='pd2-activity-list'>
								{[
									'Profile loaded successfully',
									'Emergency contacts synced from account',
									'Open Settings to update notification preferences',
								].map((text, i) => (
									<div className='pd2-activity-item' key={i}>
										<span className='pd2-activity-dot' />
										<span className='pd2-activity-text'>{text}</span>
										<span className='pd2-activity-time'>Today, {activityTime}</span>
									</div>
								))}
							</div>
							<button className='pd2-view-link'>View all activity <span>›</span></button>
						</div>

						<div className='pd2-card'>
							<div className='pd2-card-header-row'>
								<h3 className='pd2-card-heading'>Safety Checklist</h3>
								<span className='pd2-badge-complete'>{completedChecks}/3 Completed</span>
							</div>
							<div className='pd2-checklist'>
								<div className={`pd2-check-item ${hasPhone ? 'pd2-check-done' : ''}`}>
									<span className='pd2-check-circle'>{hasPhone ? '✓' : '○'}</span>
									<div>
										<p className='pd2-check-title'>At least one emergency phone is added</p>
										<p className='pd2-check-sub'>You have {emergencyPhoneContacts.length} emergency phone{emergencyPhoneContacts.length !== 1 ? 's' : ''}.</p>
									</div>
								</div>
								<div className={`pd2-check-item ${hasEmail ? 'pd2-check-done' : ''}`}>
									<span className='pd2-check-circle'>{hasEmail ? '✓' : '○'}</span>
									<div>
										<p className='pd2-check-title'>At least one emergency email is added</p>
										<p className='pd2-check-sub'>You have {emergencyEmailContacts.length} emergency email{emergencyEmailContacts.length !== 1 ? 's' : ''}.</p>
									</div>
								</div>
								<div className={`pd2-check-item ${hasMedical ? 'pd2-check-done' : ''}`}>
									<span className='pd2-check-circle'>{hasMedical ? '✓' : '○'}</span>
									<div>
										<p className='pd2-check-title'>Medical condition information is up to date</p>
										<p className='pd2-check-sub'>Last updated on {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.</p>
									</div>
								</div>
							</div>
							<button className='pd2-view-link'>View details <span>›</span></button>
						</div>
					</div>

					{showNotification && (
						<div className='pd2-notification'>
							<span className='pd2-notification-icon'><IconShield /></span>
							<div className='pd2-notification-body'>
								<p className='pd2-notification-title'>Keep your information up to date</p>
								<p className='pd2-notification-text'>Regularly review your emergency contacts and medical information to ensure we can reach the right people when it matters most.</p>
							</div>
							<button className='pd2-notification-close' onClick={() => setShowNotification(false)}>✕</button>
						</div>
					)}
				</>
			)}
		</div>
	)
}

export default PatientDashboard
