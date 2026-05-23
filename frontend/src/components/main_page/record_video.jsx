import React, { useEffect, useRef, useState } from 'react'

export default function RecordVideo() {
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const canvasRef = useRef(null)
    const frameBufferRef = useRef([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [geminiResults, setGeminiResults] = useState([])

    const startWebcam = async () => {
        if (streamRef.current) return

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
            })

            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }

            frameBufferRef.current = []
            setIsStreaming(true)
        } catch (error) {
            console.error('Unable to access webcam:', error)
        }
    }

    const stopWebcam = () => {
        if (!streamRef.current) return

        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        if (videoRef.current) {
            videoRef.current.srcObject = null
        }

        frameBufferRef.current = []
        setIsStreaming(false)
    }

    useEffect(() => {
        return () => {
            stopWebcam()
        }
    }, [])

    const captureFrame = async () => {
        if (!videoRef.current || !canvasRef.current) return

        // get current video and canvas elements
        const video = videoRef.current
        const canvas = canvasRef.current

        // context of the canvas
        const ctx = canvas.getContext('2d')

        if (!ctx) return

        canvas.width = 640
        canvas.height = 480
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(async (blob) => {
            if (!blob) return

            frameBufferRef.current.push(blob)

            if (frameBufferRef.current.length < 4) return

            const [frameBefore, frame, frameAfter1, frameAfter2] = frameBufferRef.current.slice(0, 4)
            frameBufferRef.current.shift()

            const form = new FormData()
            form.append('frame_before', frameBefore, 'frame_before.jpg')
            form.append('frame', frame, 'frame.jpg')
            form.append('frame_after_1', frameAfter1, 'frame_after_1.jpg')
            form.append('frame_after_2', frameAfter2, 'frame_after_2.jpg')

            try {
                const resp = await fetch('/api/footage/parse_live_video_frame', {
                    method: 'POST',
                    body: form,
                })

                const data = await resp.json().catch(() => null)

                if (!resp.ok) {
                    console.error('Upload failed', resp.status, data)
                    return
                }

                const perFrame = data?.gemini_analysis?.per_frame || []
                const summary = perFrame
                    .map((item) => `${item.frame || 'unknown'} | ${item.side || 'unknown'} | ${item.analysis || 'no analysis'}`)
                    .join(' || ')

                setGeminiResults((prev) => [summary || JSON.stringify(data?.gemini_analysis || data), ...prev].slice(0, 10))
            } catch (err) {
                console.error('Upload error', err)
            }
        }, 'image/jpeg', 0.8)

    }

    // capture a frame every second while streaming
    useEffect(() => {
        if (!isStreaming) return

        const intervalId = setInterval(captureFrame, 1000)


        return () => clearInterval(intervalId)
    }, [isStreaming])

    return (
        <div>
            <h2>Webcam Preview</h2>
            <div id="webcam-container">
                <video ref={videoRef} autoPlay muted playsInline />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
            <button type="button" onClick={startWebcam} disabled={isStreaming}>
                Start
            </button>
            <button type="button" onClick={stopWebcam} disabled={!isStreaming}>
                Stop
            </button>
            <p>Gemini results:</p>
            <ul>
                {geminiResults.map((result, index) => (
                    <li key={`${index}-${result.slice(0, 20)}`}>{result}</li>
                ))}
            </ul>
        </div>
    )
}
