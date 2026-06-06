import { useState } from 'react'
import UploadFootage from './upload_footage'
import RecordVideo from './record_video'
import '../../styles/main_page.css'
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
        <div className="main-page-wrapper">
            {!loadRecordVideo && !loadUploadFootage && (
                <>
                    <h1 className='header'>Choose how you want to analyze footage</h1>
                    <div className="action-column">
                        <button className="action-button" id="record-video" onClick={recordVideo}>
                            Record Video
                        </button>
                        <button className="action-button" id="upload-footage" onClick={uploadFootage}>
                            Upload existing footage
                        </button>
                    </div>
                </>
            )}
            {loadUploadFootage && <UploadFootage />}
            {loadRecordVideo && <RecordVideo />}

        </div>
            
	)
}
export default MainPage
