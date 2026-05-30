import { useEffect, useMemo, useState } from 'react'
import '../styles/family_dashboard.css'

function formatValue(value, fallback = 'Not provided') {
	if (value === null || value === undefined || value === '') return fallback
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	return JSON.stringify(value)
}

function FamilyDashboard() {
	const raw = localStorage.getItem('user')
	const [alertData, setAlertData] = useState(null); // placeholder for fetched alert data
	const localUser = raw ? JSON.parse(raw) : null
	const [profile, setProfile] = useState(null)
	const [linkedMember, setLinkedMember] = useState(null)
	const [profileError, setProfileError] = useState('')
	const [linkedMemberError, setLinkedMemberError] = useState('')
	const linkedEmail = profile?.linked_family_account_email || localUser?.linked_family_account_email

    // print the user's username, email, phone number, medical conditions, role, linked family account email, emergency phone contacts, and emergency email contacts in the console on mount
    console.log('Local username:', localUser?.username)
    console.log('Local email:', localUser?.email)
    console.log('Local phone number:', localUser?.phone_number)
    console.log('Local medical conditions:', localUser?.medical_conditions)
    console.log('Local role:', localUser?.role)
    console.log('Linked family account email:', localUser?.linked_family_account_email)
    console.log('Emergency phone contacts:', localUser?.emergency_phone_contacts)
    console.log('Emergency email contacts:', localUser?.emergency_email_contacts)
	console.log('Family Dashboard Profile State:', profile?.linked_family_account_email)

	useEffect(() => {
		let isMounted = true

		const loadFamilyProfile = async () => {
			if (!localUser?.email) return

			try {
				const resp = await fetch(`/api/auth/profile?email=${encodeURIComponent(localUser.email)}`)
				const data = await resp.json().catch(() => null)

				if (!resp.ok) {
					throw new Error(data?.error || 'Failed to load family profile')
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

		loadFamilyProfile()

		return () => {
			isMounted = false
		}
	}, [localUser?.email])

	useEffect(() => {
		let isMounted = true

		const loadLinkedMember = async () => {
			if (!linkedEmail) {
				if (isMounted) {
					setLinkedMember(null)
					setLinkedMemberError('Add a linked family account email to show the family member here.')
				}
				return
			}

			try {
				const resp = await fetch(`/api/auth/profile?email=${encodeURIComponent(linkedEmail)}`)
				const data = await resp.json().catch(() => null)

				if (!resp.ok) {
					throw new Error(data?.error || 'Failed to load linked family member')
				}

				if (isMounted) {
					setLinkedMember(data)
					setLinkedMemberError('')
				}
			} catch (error) {
				if (isMounted) {
					setLinkedMember(null)
					setLinkedMemberError(error.message)
				}
			}
		}

		loadLinkedMember()

		return () => {
			isMounted = false
		}
	}, [linkedEmail])

	// useEffect to fetch alerts from the table 'caregiver_abuse_reports' 
	// get the classification, reason, confidence, and created_at fields
	// get the report where the email equals the linked family account email
	// order by created_at desc

	useEffect(() => {
		const fetchAlerts = async () => {
			if (!linkedEmail) {
				console.log('fetchAlerts skipped: no linked email yet')
				return
			}

			console.log('Fetching alerts for linked email:', linkedEmail)

			try {
				const resp = await fetch(`/api/email/get_reports?email=${encodeURIComponent(linkedEmail)}`)
				const data = await resp.json().catch(() => null)

				if (!resp.ok) {
					throw new Error(data?.error || 'Failed to load alerts')
				}
				console.log('Fetched alerts:', data)
				console.log('Fetched alerts count:', data?.reports?.length ?? 0)

				setAlertData(data?.reports || [])

			} catch (error) {
				console.error('Error fetching alerts:', error)
			}
		}

		fetchAlerts()
	}, [linkedEmail])

	const displayUser = useMemo(() => profile || localUser, [profile, localUser])

	

	const alerts = [
		{ id: 'alert-1', title: 'Potential distress detected', time: 'Just now', status: 'Pending review' },
		{ id: 'alert-2', title: 'Motion anomaly detected', time: '15 min ago', status: 'Needs attention' },
	]

	if (!displayUser) {
		return <p>No family account found</p>
	}

	return (
		<div className='profile-dashboard pd-family-layout'>
			<aside className='pd-family-left'>
				<div className='pd-card pd-family-card'>
					<p className='pd-label'>Family Account</p>
					<h2 className='pd-username'>{formatValue(localUser?.username, 'Family member')}</h2>
					<p className='pd-card-value'>{formatValue(localUser?.email)}</p>
					<p className='pd-card-value'>{formatValue(localUser?.role, 'Family')}</p>
					{profileError ? <p className='pd-error'>{profileError}</p> : null}
				</div>

				<div className='pd-card pd-family-members-card'>
					<p className='pd-label'>Family Members</p>
					{linkedMember ? (
						<div className='pd-family-member-template'>
							<div className='pd-family-member-row'>
								<span className='pd-card-title'>Name: </span>
								<span className='pd-card-value'>{formatValue(linkedMember.username)}</span>
							</div>
							<div className='pd-family-member-row'>
								<span className='pd-card-title'>Email: </span>
								<span className='pd-card-value'>{formatValue(linkedMember.email)}</span>
							</div>
							<div className='pd-family-member-row'>
								<span className='pd-card-title'>Phone: </span>
								<span className='pd-card-value'>{formatValue(linkedMember.phone_number)}</span>
							</div>
						</div>
					) : (
						<p className='pd-muted'>{linkedMemberError || 'Linked member will appear here.'}</p>
					)}
				</div>
			</aside>

			<main className='pd-family-right'>
				<div className='pd-family-alerts-panel'>
					<div className='pd-family-alerts-header'>
						<div>
							<h3 className='pd-settings'>Captured alert feed</h3>
						</div>
					</div>

					<div className='pd-family-alerts-grid'>
						{/* alert data will be displayed here */}
						{alertData && alertData.length > 0 ? (
							alertData.map((report) => (
								<article className='pd-family-alert-card' key={report.created_at}>
									<div className='pd-family-alert-body'>
										<h4 className='alert-classification'>{report.classification}</h4>
										<p className='alert-reason'>{report.reason}</p>
										<p className='alert-confidence'>Confidence: {report.confidence}</p>
										<p className='alert-timestamp'>{new Date(report.created_at).toLocaleString()}</p>
									</div>
								</article>
							))
						) : (
							<p className='pd-muted'>No alerts yet. Alerts will appear here when the system detects potential issues.</p>
						)}
					</div>
				</div>
			</main>
		</div>
	)
}

export default FamilyDashboard
