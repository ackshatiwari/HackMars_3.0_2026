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
                    <button id="record-video" onClick={recordVideo}>
                        Record Video
                    </button>
                    <button id="upload-footage" onClick={uploadFootage}>
                        Upload existing footage
                    </button>
                </>
            )}
            {loadUploadFootage && <UploadFootage />}
            {loadRecordVideo && <RecordVideo />}

		</div>
            
	)
}
export default MainPage
