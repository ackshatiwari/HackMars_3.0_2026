import { useEffect, useMemo, useState } from 'react'
import '../styles/family_dashboard.css'

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

function resolveThumbnailUrl(thumbnailUrl) {
	if (!thumbnailUrl) return null
	if (/^https?:\/\//i.test(thumbnailUrl) || thumbnailUrl.startsWith('data:')) return thumbnailUrl
	const normalizedPath = thumbnailUrl.startsWith('/') ? thumbnailUrl : `/${thumbnailUrl}`
	return `${backendBaseUrl}${normalizedPath}`
}

function formatValue(value, fallback = 'Not provided') {
	if (value === null || value === undefined || value === '') return fallback
	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	return JSON.stringify(value)
}

function toMinuteKey(value) {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Unknown minute'
	const pad = (num) => String(num).padStart(2, '0')
	return [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		pad(date.getHours()),
		pad(date.getMinutes()),
	].join('-')
}

function toLabelTime(value) {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return 'Unknown time'
	return date.toLocaleString()
}

function normalizeTitle(reports) {
	const classifications = new Set((reports || []).map((report) => String(report.classification || '').toLowerCase()))
	const hasAggressive = classifications.has('aggressive_handling')
	const hasPhysical = classifications.has('potential_physical_abuse') || classifications.has('physical_abuse')

	if (hasAggressive && hasPhysical) return 'Physical Abuse and Aggressive Handling Detected'
	if (hasPhysical) return 'Physical Abuse Detected'
	if (hasAggressive) return 'Aggressive Handling Detected'
	return 'Alert Group Detected'
}

function isPhysicalClassification(value) {
	const normalized = String(value || '').toLowerCase()
	return normalized === 'potential_physical_abuse' || normalized === 'physical_abuse'
}

function averageConfidence(items) {
	const numeric = (items || [])
		.map((item) => Number(item.confidence))
		.filter((value) => Number.isFinite(value))
	if (!numeric.length) return null
	return numeric.reduce((sum, value) => sum + value, 0) / numeric.length
}

function FamilyDashboard() {
	const raw = localStorage.getItem('user')
	const [alertData, setAlertData] = useState(null); // placeholder for fetched alert data
	const localUser = raw ? JSON.parse(raw) : null
	const [profile, setProfile] = useState(null)
	const [linkedMember, setLinkedMember] = useState(null)
	const [profileError, setProfileError] = useState('')
	const [linkedMemberError, setLinkedMemberError] = useState('')
	const [selectedGroupId, setSelectedGroupId] = useState(null)
	const [selectedImageIndex, setSelectedImageIndex] = useState(0)
	const [alertPage, setAlertPage] = useState(0)
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

	const groupedAlerts = useMemo(() => {
		const reports = Array.isArray(alertData) ? [...alertData] : []
		reports.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())

		const groupsMap = new Map()
		for (const report of reports) {
			const key = toMinuteKey(report.created_at)
			if (!groupsMap.has(key)) {
				groupsMap.set(key, [])
			}
			groupsMap.get(key).push(report)
		}

		return Array.from(groupsMap.entries()).map(([minuteKey, reportsInMinute]) => {
			const sortedReports = [...reportsInMinute].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
			const physicalReports = sortedReports.filter((report) => isPhysicalClassification(report.classification))
			const averagePhysicalConfidence = averageConfidence(physicalReports)
			const firstReport = sortedReports[0]

			return {
				id: minuteKey,
				minuteKey,
				reports: sortedReports,
				title: normalizeTitle(sortedReports),
				startedAt: firstReport?.created_at,
				thumbnailCount: sortedReports.filter((report) => resolveThumbnailUrl(report.thumbnail_url)).length,
				averagePhysicalConfidence,
			}
		})
	}, [alertData])

	const pageSize = 3
	const totalAlertPages = Math.max(1, Math.ceil(groupedAlerts.length / pageSize))
	const visibleAlertGroups = groupedAlerts.slice(alertPage * pageSize, (alertPage + 1) * pageSize)

	const selectedGroup = useMemo(() => {
		if (!groupedAlerts.length) return null
		return groupedAlerts.find((group) => group.id === selectedGroupId) || groupedAlerts[0]
	}, [groupedAlerts, selectedGroupId])

	const selectedGroupImages = useMemo(() => {
		const images = (selectedGroup?.reports || [])
			.map((report) => ({
				...report,
				resolvedThumbnailUrl: resolveThumbnailUrl(report.thumbnail_url),
			}))
			.filter((report) => Boolean(report.resolvedThumbnailUrl))
		return images
	}, [selectedGroup])

	useEffect(() => {
		if (!selectedGroup && groupedAlerts.length > 0) {
			setSelectedGroupId(groupedAlerts[0].id)
			setSelectedImageIndex(0)
		}
	}, [groupedAlerts, selectedGroup])

	useEffect(() => {
		setAlertPage((current) => Math.min(current, Math.max(0, totalAlertPages - 1)))
	}, [totalAlertPages])

	useEffect(() => {
		setSelectedImageIndex(0)
	}, [selectedGroupId])

	const handleSelectGroup = (groupId) => {
		setSelectedGroupId(groupId)
		setSelectedImageIndex(0)
	}

	const goPrevAlertPage = () => {
		setAlertPage((current) => Math.max(0, current - 1))
	}

	const goNextAlertPage = () => {
		setAlertPage((current) => Math.min(totalAlertPages - 1, current + 1))
	}

	const goPrevImage = () => {
		setSelectedImageIndex((current) => (selectedGroupImages.length ? (current - 1 + selectedGroupImages.length) % selectedGroupImages.length : 0))
	}

	const goNextImage = () => {
		setSelectedImageIndex((current) => (selectedGroupImages.length ? (current + 1) % selectedGroupImages.length : 0))
	}

	const selectedImage = selectedGroupImages[selectedImageIndex] || null

	

	const alerts = [
		{ id: 'alert-1', title: 'Potential distress detected', time: 'Just now', status: 'Pending review' },
		{ id: 'alert-2', title: 'Motion anomaly detected', time: '15 min ago', status: 'Needs attention' },
	]

	if (!displayUser) {
		return <p>No family account found</p>
	}

	return (
		<div className='dashboard-container family-layout'>
			<aside className='dashboard-sidebar'>
				<div className='dashboard-card family-card'>
					<p className='dashboard-label'>Family Account</p>
					<h2 className='dashboard-username'>{formatValue(localUser?.username, 'Family member')}</h2>
					<p className='dashboard-value'>{formatValue(localUser?.email)}</p>
					<p className='dashboard-value'>{formatValue(localUser?.role, 'Family')}</p>
					{profileError ? <p className='dashboard-error'>{profileError}</p> : null}
				</div>

				<div className='dashboard-card family-members-card'>
					<p className='dashboard-label'>Family Members</p>
					{linkedMember ? (
						<div className='family-member-template'>
							<div className='family-member-row'>
								<span className='dashboard-title'>Name: </span>
								<span className='dashboard-value'>{formatValue(linkedMember.username)}</span>
							</div>
							<div className='family-member-row'>
								<span className='dashboard-title'>Email: </span>
								<span className='dashboard-value'>{formatValue(linkedMember.email)}</span>
							</div>
							<div className='family-member-row'>
								<span className='dashboard-title'>Phone: </span>
								<span className='dashboard-value'>{formatValue(linkedMember.phone_number)}</span>
							</div>
						</div>
					) : (
						<p className='dashboard-muted'>{linkedMemberError || 'Linked member will appear here.'}</p>
					)}
				</div>
			</aside>

			<main className='dashboard-main'>
				<div className='dashboard-alerts-panel'>
					<div className='dashboard-alerts-header'>
						<div>
							<h3 className='dashboard-settings-title'>Captured alert feed</h3>
							<p className='dashboard-feed-note'>Click one of the grouped alerts below to view more info, thumbnails, and motion timeline.</p>
						</div>
						<div className='dashboard-feed-pagination'>
							<button type='button' onClick={goPrevAlertPage} disabled={alertPage === 0}>Previous</button>
							<span>Page {alertPage + 1} of {totalAlertPages}</span>
							<button type='button' onClick={goNextAlertPage} disabled={alertPage >= totalAlertPages - 1}>Next</button>
						</div>
					</div>

					<div className='dashboard-alerts-grid'>
						{visibleAlertGroups.length > 0 ? (
							visibleAlertGroups.map((group) => {
								const isActive = group.id === selectedGroup?.id
								return (
									<article
										className={`dashboard-alert-card dashboard-group-card ${isActive ? 'is-active' : ''}`}
										key={group.id}
										onClick={() => handleSelectGroup(group.id)}
									>
										<div className='dashboard-alert-thumbnail'>
											{resolveThumbnailUrl(group.reports[0]?.thumbnail_url) ? (
												<img src={resolveThumbnailUrl(group.reports[0]?.thumbnail_url)} alt={`Alert motion ${toLabelTime(group.startedAt)}`} />
											) : (
												<span>No frame</span>
											)}
										</div>
										<div className='dashboard-alert-body'>
											<h4 className='alert-classification'>{group.title}</h4>
											<p className='alert-reason'>
												{group.reports.length} alert{group.reports.length === 1 ? '' : 's'} in this minute.
											</p>
											<p className='alert-confidence'>Average physical abuse confidence: {group.averagePhysicalConfidence !== null ? group.averagePhysicalConfidence.toFixed(2) : 'N/A'}</p>
											<p className='alert-timestamp'>{toLabelTime(group.startedAt)}</p>
										</div>
									</article>
								)
							})
						) : (
							<p className='dashboard-muted'>No alerts yet. Alerts will appear here when the system detects potential issues.</p>
						)}
					</div>
				</div>

				<div className='dashboard-detail-panel'>
					<div className='dashboard-detail-header'>
						<h3 className='dashboard-settings-title'>Grouped Alert Details</h3>
						<p className='dashboard-feed-note'>Click one of the groups in order to view more info, all thumbnails, and a timeline you can move through.</p>
					</div>

					{selectedGroup ? (
						<>
							<div className='dashboard-detail-summary'>
								<div>
									<p className='dashboard-detail-label'>Selected group</p>
									<h4 className='dashboard-detail-title'>{selectedGroup.title}</h4>
								</div>
								<div className='dashboard-detail-stats'>
									<span>{selectedGroup.reports.length} reports</span>
									<span>{selectedGroup.thumbnailCount} thumbnails</span>
									<span>{selectedGroup.averagePhysicalConfidence !== null ? `Avg physical confidence ${selectedGroup.averagePhysicalConfidence.toFixed(2)}` : 'No physical abuse avg yet'}</span>
								</div>
							</div>

							<div className='dashboard-timeline-shell'>
								<div className='dashboard-timeline-image'>
									{selectedImage ? (
										<img src={selectedImage.resolvedThumbnailUrl} alt={`Timeline frame ${selectedImageIndex + 1}`} />
									) : (
										<div className='dashboard-empty-frame'>No thumbnails available for this group.</div>
									)}
								</div>

								<div className='dashboard-timeline-controls'>
									<button type='button' onClick={goPrevImage} disabled={!selectedGroupImages.length}>Back</button>
									<span>
										{selectedGroupImages.length ? `${selectedImageIndex + 1} / ${selectedGroupImages.length}` : '0 / 0'}
									</span>
									<button type='button' onClick={goNextImage} disabled={!selectedGroupImages.length}>Next</button>
								</div>

								<div className='dashboard-timeline-strip'>
									{selectedGroupImages.length > 0 ? selectedGroupImages.map((image, index) => (
										<button
											type='button'
											key={`${image.created_at}-${index}`}
											className={`dashboard-timeline-thumb ${index === selectedImageIndex ? 'is-active' : ''}`}
											onClick={() => setSelectedImageIndex(index)}
										>
											<img src={image.resolvedThumbnailUrl} alt={`Timeline thumbnail ${index + 1}`} />
											<span>{new Date(image.created_at).toLocaleTimeString()}</span>
										</button>
									)) : <p className='dashboard-muted'>No images to show in the timeline yet.</p>}
								</div>
							</div>
						</>
					) : (
						<p className='dashboard-muted'>Click one of the groups in order to view more info.</p>
					)}
				</div>
			</main>
		</div>
	)
}

export default FamilyDashboard
