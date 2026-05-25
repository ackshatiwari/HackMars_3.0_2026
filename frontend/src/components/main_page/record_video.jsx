import React, { useEffect, useRef, useState } from 'react'
import '../../styles/record_video.css'

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
    const [riskFilter, setRiskFilter] = useState('all') // 'all' | 'low' | 'high' | 'critical'


    var color_to_movement = new Map()
    color_to_movement.set('normal_caregiving_assistance', 'green')
    color_to_movement.set('accidental_movement', 'yellow')
    color_to_movement.set('aggressive_handling', 'orange')
    color_to_movement.set('potential_physical_abuse', 'red')

    const extractJsonText = (text) => {
        if (!text) return ''
        if (typeof text !== 'string') return JSON.stringify(text, null, 2)

        const jsonMatch = /```json\s*([\s\S]*?)\s*```/i.exec(text)
        if (jsonMatch?.[1]) {
            return jsonMatch[1].trim()
        }

        const trimmed = text.trim()
        try {
            return JSON.stringify(JSON.parse(trimmed), null, 2)
        } catch (e) {
            return trimmed
        }
    }

    // Minimal helper: extract a short classification from the Gemini result
    const extractClassification = (result) => {
        if (!result) return null
        const payload = result.text
        if (!payload) return null

        if (typeof payload === 'object') return payload.classification || null

        const jsonText = extractJsonText(payload)
        try {
            const parsed = JSON.parse(jsonText)
            if (parsed && typeof parsed === 'object') return parsed.classification || null
        } catch (e) {
            return null
        }

        return null
    }

    const classificationToRisk = (classification) => {
        if (!classification) return 'unknown'
        const c = classification.toLowerCase()
        if (c === 'normal_caregiving_assistance' || c === 'accidental_movement') return 'low'
        if (c === 'aggressive_handling') return 'high'
        if (c === 'potential_physical_abuse') return 'critical'
        return 'unknown'
    }


    const upsertGeminiResult = (jobId, text) => {
        setGeminiResults((prev) => {
            const next = prev.filter((item) => item.id !== jobId)
            return [{ id: jobId, text }, ...next].slice(0, 50)
        })
    }

    const formatGeminiResult = (j) => {
        const perFrame = j?.gemini_analysis?.per_frame || []
        const primary = perFrame[0] || {}
        const jsonText = extractJsonText(primary.analysis || '')

        return {
            text: jsonText,
            elapsedMs: typeof j?.elapsed_ms === 'number' ? j.elapsed_ms : (typeof primary?.gemini_elapsed_ms === 'number' ? primary.gemini_elapsed_ms : null),
            classification: primary?.classification || null,
        }
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
                    const primary = perFrame[0] || {}
                    upsertGeminiResult(`local-${Date.now()}`, {
                        text: extractJsonText(primary.analysis || JSON.stringify(data?.gemini_analysis || data)),
                        elapsedMs: typeof data?.elapsed_ms === 'number' ? data.elapsed_ms : (typeof primary?.gemini_elapsed_ms === 'number' ? primary.gemini_elapsed_ms : null),
                        classification: primary?.classification || null,
                    })
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

        const intervalId = setInterval(captureFrame, 200)


        return () => clearInterval(intervalId)
    }, [isStreaming])

    return (
        <>
            <div>
                <h2>Live Video Analysis</h2>
            </div>

            <div className='flex-container'>
                <div className='container-webcam'>
                    <div id="webcam-container">
                        <video ref={videoRef} id="webcam" autoPlay muted playsInline />
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>
                    <button type="button" onClick={startWebcam} disabled={isStreaming}>
                        Start
                    </button>
                    <button type="button" onClick={stopWebcam} disabled={!isStreaming}>
                        Stop
                    </button>
                </div>


                <div className='gemini-panel'>
                    <div className='gemini-header'>
                        <p>Gemini results:</p>
                        <div className='gemini-filters'>
                            <label>Show:</label>
                            <button onClick={() => setRiskFilter('all')} className={riskFilter === 'all' ? 'active' : ''}>All</button>
                            <button onClick={() => setRiskFilter('low')} className={riskFilter === 'low' ? 'active' : ''}>Low</button>
                            <button onClick={() => setRiskFilter('high')} className={riskFilter === 'high' ? 'active' : ''}>High</button>
                            <button onClick={() => setRiskFilter('critical')} className={riskFilter === 'critical' ? 'active' : ''}>Critical</button>
                        </div>
                    </div>

                    {/* Replace this simple unordered list with a card-like system.
                     change id to the color depending on the analysis from the map called color_to_movement */}
                    <div className='container-gemini'>
                        {geminiResults
                            .filter((result) => {
                                if (riskFilter === 'all') return true
                                const cls = extractClassification(result)
                                const risk = classificationToRisk(cls)
                                return risk === riskFilter
                            })
                            .map((result) => {
                                const classification = extractClassification(result)
                                const cardColor = color_to_movement.get(classification) || 'gray'
                                const payload = result.text
                                const displayText = typeof payload === 'object' ? payload.text : payload
                                const elapsedMs = typeof payload === 'object' ? payload.elapsedMs : null

                                return (
                                    <div key={result.id} id={cardColor} className='card-gemini'>
                                        <div className='card-gemini-row'>
                                            <p className='card-gemini-text'>{displayText}</p>
                                            {typeof elapsedMs === 'number' ? (
                                                <span className='card-gemini-time'>{elapsedMs}ms</span>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                </div>
            </div>
        </>
    )
}
