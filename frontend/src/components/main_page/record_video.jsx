import React, { useEffect, useRef, useState } from 'react'

export default function RecordVideo() {
    const pythonServiceUrl = import.meta.env.VITE_PYTHON_SERVICE_URL || 'http://localhost:8000'
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const canvasRef = useRef(null)
    const frameBufferRef = useRef([])
    const requestInFlightRef = useRef(false)
    const analysisInFlightRef = useRef(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const [geminiResults, setGeminiResults] = useState([])

    const upsertGeminiResult = (jobId, text) => {
        setGeminiResults((prev) => {
            const next = prev.filter((item) => item.id !== jobId)
            return [{ id: jobId, text }, ...next].slice(0, 50)
        })
    }

    const formatGeminiResult = (j) => {
        const status = j?.status || 'unknown'
        const stage = j?.stage ? ` | stage: ${j.stage}` : ''
        const elapsed = typeof j?.elapsed_ms === 'number' ? ` | elapsed: ${j.elapsed_ms}ms` : ''
        const error = j?.last_error ? ` | error: ${j.last_error}` : ''

        const perFrame = j?.gemini_analysis?.per_frame || []
        const summary = perFrame
            .map((item) => `${item.frame || 'unknown'} | ${item.side || 'unknown'} | ${item.analysis || 'no analysis'}`)
            .join(' || ')

        return `${status}${stage}${elapsed}${error}${summary ? ` | ${summary}` : ''}`
    }

    // Poll a job id until it's no longer pending, then update results
    const pollGemini = async (jobId) => {
        if (!jobId) return
        let attempts = 0
        const maxAttempts = 120 // allow longer polling (up to a few minutes with backoff)
        while (attempts < maxAttempts) {
            try {
                const resp = await fetch(`${pythonServiceUrl}/gemini-result/${jobId}`)
                if (resp.ok) {
                    const j = await resp.json().catch(() => null)
                    if (j && j.status && j.status !== 'pending') {
                        upsertGeminiResult(jobId, formatGeminiResult(j))
                        analysisInFlightRef.current = false
                        return
                    }
                }
            } catch (err) {
                console.error('Poll error', err)
            }

            // adaptive backoff: 1s for first 60 attempts, then 2s thereafter
            const delay = attempts < 60 ? 1000 : 2000
            await new Promise((r) => setTimeout(r, delay))
            attempts += 1
        }

        // timed out
        upsertGeminiResult(jobId, `job ${jobId} timed out`)
        analysisInFlightRef.current = false
    }

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
        if (requestInFlightRef.current || analysisInFlightRef.current) return

        // get current video and canvas elements
        const video = videoRef.current
        const canvas = canvasRef.current

        // context of the canvas
        const ctx = canvas.getContext('2d')

        if (!ctx) return

        canvas.width = 320
        canvas.height = 240
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(async (blob) => {
            if (!blob) return

            frameBufferRef.current.push(blob)

            if (frameBufferRef.current.length < 3) return

            const [frameBefore, frame, frameAfter] = frameBufferRef.current.slice(0, 3)
            frameBufferRef.current.shift()

            const form = new FormData()
            form.append('frame_before', frameBefore, 'frame_before.jpg')
            form.append('frame', frame, 'frame.jpg')
            form.append('frame_after', frameAfter, 'frame_after.jpg')

            requestInFlightRef.current = true
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

                const jobId = data?.job_id
                if (!jobId) {
                    const perFrame = data?.gemini_analysis?.per_frame || []
                    const summary = perFrame
                        .map((item) => `${item.frame || 'unknown'} | ${item.side || 'unknown'} | ${item.analysis || 'no analysis'}`)
                        .join(' || ')

                    upsertGeminiResult(`local-${Date.now()}`, summary || JSON.stringify(data?.gemini_analysis || data))
                } else {
                    // show pending immediately and poll in background
                    analysisInFlightRef.current = true
                    upsertGeminiResult(jobId, `pending | job ${jobId}`)
                    // start polling but don't block the UI
                    pollGemini(jobId)
                }
            } catch (err) {
                console.error('Upload error', err)
            } finally {
                requestInFlightRef.current = false
            }
        }, 'image/jpeg', 0.6)

    }

    // capture a frame every 500 ms while streaming
    useEffect(() => {
        if (!isStreaming) return

        const intervalId = setInterval(captureFrame, 500)


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
                {geminiResults.map((result) => (
                    <li key={result.id}>{result.text}</li>
                ))}
            </ul>
        </div>
    )
}
