import { useState } from 'react'
import UploadFootage from './upload_footage'
import RecordVideo from './record_video'

function MainPage() {
    const [loadUploadFootage, setLoadUploadFootage] = useState(false)
    const [loadRecordVideo, setLoadRecordVideo] = useState(false)
    const uploadFootage = () => {
        // Logic to handle footage upload
        console.log('Upload footage button clicked')
        setLoadUploadFootage(true)
        setLoadRecordVideo(false)
    }

    const recordVideo = () => {
        // Logic to handle video recording
        console.log('Record video button clicked')
        setLoadRecordVideo(true)
        setLoadUploadFootage(false)
    }



	return (
        <div>
            {!loadRecordVideo && !loadUploadFootage && (
                <>
                    <h1>Main Page</h1>
                    <div className="main-compact-grid">
                        <div className="action-column">
                            <button className="action-button" id="record-video" onClick={recordVideo}>
                                Record Video
                            </button>
                            <button className="action-button" id="upload-footage" onClick={uploadFootage}>
                                Upload existing footage
                            </button>
                            <div className="filler-card">
                                <strong>Quick Actions</strong>
                                <p style={{margin:'6px 0 0'}}>Use Record or Upload to analyze footage. Settings are in your profile.</p>
                            </div>
                        </div>
                        <div>
                            <div className="filler-card">
                                <strong>Recent Activity</strong>
                                <p style={{margin:'6px 0 0'}}>No recent alerts. Demo results will appear here.</p>
                            </div>
                            <div className="filler-card" style={{marginTop:12}}>
                                <strong>Tips</strong>
                                <p style={{margin:'6px 0 0'}}>Keep camera steady and ensure subjects are visible for best results.</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {loadUploadFootage && <UploadFootage />}
            {loadRecordVideo && <RecordVideo />}

        </div>
            
	)
}
export default MainPage
