import React from 'react'

export default function UploadFootage() {

    const handleSubmit = async (event) => {
        event.preventDefault()
        const formData = new FormData(event.target)

        // call an endpoint called /api/footage/upload_footage with the form data
        const res = await fetch('/api/footage/upload_footage', {
            method: 'POST',
            body: formData,
        })
        if (!res.ok) {
            const ct = res.headers.get('content-type') || ''
            let errorBody
            try {
                if (ct.includes('application/json')) errorBody = await res.json()
                else errorBody = await res.text()
            } catch (e) {
                errorBody = await res.text().catch(() => 'Unable to read response')
            }
            console.error('Upload failed', res.status, errorBody)
            return
        }
        console.log('Upload succeeded')
        // After a successful upload, ask backend to run Gemini analysis and log the results
        try {
            const a = await fetch('/api/footage/analyze')
            const analysis = await a.json().catch(() => null)
            console.log('Gemini analysis result:', analysis)
        } catch (e) {
            console.error('Failed to fetch analysis:', e)
        }

    }
        
    
    return (
        <div>
            <h2>Upload Footage Component</h2>
            
            <form id="submit_footage" onSubmit={handleSubmit}>
                <input type="file" name="file" accept=".mp4"/>
                <button type="submit">Upload</button>
            </form>
        </div>
    )
}