import { useState } from 'react'
import UploadFootage from './upload_footage'

function MainPage() {
    const [loadUploadFootage, setLoadUploadFootage] = useState(false)
    const [loadRecordVideo, setLoadRecordVideo] = useState(false)
    const uploadFootage = () => {
        // Logic to handle footage upload
        console.log('Upload footage button clicked')
        setLoadUploadFootage(true)
    }

    const recordVideo = () => {
        // Logic to handle video recording
        console.log('Record video button clicked')
        setLoadRecordVideo(true)
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

		</div>
            
	)
}
export default MainPage
