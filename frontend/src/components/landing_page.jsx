import '../styles/landing_page.css'

function LandingPage({ isSignedIn, user, onSignIn, onViewProfile }) {
	const firstName = (user?.username || 'Care User').toString().split(' ')[0]

	return (
		<div className="landing-root">
			<header className="landing-topbar">
				<div className="landing-brand">GuardSight</div>
				<button
					type="button"
					className="landing-cta"
					onClick={isSignedIn ? onViewProfile : onSignIn}
				>
					{isSignedIn ? 'View Profile' : 'Sign In'}
				</button>
			</header>

			<main className="landing-main">
				<section className="landing-hero-card">
					<p className="landing-kicker">Care Safety Monitoring</p>
					<h1 className="landing-title">Real-time caregiver behavior insight</h1>
					<p className="landing-subtitle">
						Upload footage or run live analysis to detect high-risk motion and notify trusted contacts.
					</p>

					<div className="landing-action-row">
						<button
							type="button"
							className="landing-cta landing-cta-primary"
							onClick={isSignedIn ? onViewProfile : onSignIn}
						>
							{isSignedIn ? `Continue as ${firstName}` : 'Start with Sign In'}
						</button>
						{!isSignedIn && (
							<span className="landing-note">Create an account in under a minute.</span>
						)}
					</div>
				</section>

				<section className="landing-grid">
					<article className="landing-feature-card">
						<h3>Live Video Monitoring</h3>
						<p>Analyze live frames with pose detection and contextual scoring.</p>
					</article>
					<article className="landing-feature-card">
						<h3>Evidence-backed Alerts</h3>
						<p>Capture timestamps, confidence, and reason summaries for each incident.</p>
					</article>
					<article className="landing-feature-card">
						<h3>Family Visibility</h3>
						<p>Give family members a clear feed of recent alerts and profile info.</p>
					</article>
				</section>
			</main>
		</div>
	)
}

export default LandingPage
