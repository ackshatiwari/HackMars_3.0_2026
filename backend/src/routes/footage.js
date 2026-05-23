import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import FormData from 'form-data'
import fetch from 'node-fetch'

const router = express.Router()
let frameNumber = 0

const upload = multer({ dest: 'uploads/' })

// POST /api/footage/upload_footage
// Accepts multipart file upload from frontend and forwards it to the
// Python FastAPI service at /upload-video/ for processing.
router.post('/upload_footage', upload.single('file'), async (req, res) => {
    try {
        console.log('upload_footage: req.file=', req.file && { originalname: req.file.originalname, path: req.file.path, size: req.file.size })
        if (!req.file) return res.status(400).json({ error: 'No file uploaded. Field name must be `file` in the form.' })

        const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'

        const form = new FormData()
        const readStream = fs.createReadStream(req.file.path)
        form.append('file', readStream, req.file.originalname)

        const resp = await fetch(`${pythonUrl}/upload-video/`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        })

        const ct = resp.headers.get('content-type') || ''
        let data
        if (ct.includes('application/json')) data = await resp.json().catch(() => ({}))
        else data = await resp.text().catch(() => ({}))

        console.log('Forwarded to python:', `${pythonUrl}/upload-video/`, 'status=', resp.status)

        // cleanup temp file
        fs.unlink(req.file.path, () => { })

        // return text or json depending on python response
        if (typeof data === 'string') return res.status(resp.status).send(data)
        return res.status(resp.status).json(data)
    } catch (err) {
        console.error('Error forwarding upload to python service:', err)
        return res.status(500).json({ error: 'Failed to forward file to python service' })
    }
})


router.post('/parse_live_video_frame', upload.fields([
    { name: 'frame_before', maxCount: 1 },
    { name: 'frame', maxCount: 1 },
    { name: 'frame_after_1', maxCount: 1 },
    { name: 'frame_after_2', maxCount: 1 },
]), async (req, res) => {

    try {

        const uploadedFiles = req.files || {}
        console.log('parse_live_video_frame: req.files=', Object.fromEntries(Object.entries(uploadedFiles).map(([key, value]) => [key, value && value[0] && { originalname: value[0].originalname, path: value[0].path, size: value[0].size }])))

        if (!uploadedFiles.frame || !uploadedFiles.frame[0]) return res.status(400).json({ error: 'No frame uploaded. Field name must be `frame` in the form.' })
        const uploadsDir = path.resolve(process.cwd(), 'uploads')
        const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'

        const now = new Date()
        const pad = (value) => String(value).padStart(2, '0')
        const timestamp = [
            now.getFullYear(),
            pad(now.getMonth() + 1),
            pad(now.getDate()),
            pad(now.getHours()),
            pad(now.getMinutes()),
            pad(now.getSeconds()),
        ].join('-')
        const currentFrameNumber = frameNumber++
        const currentFileName = `${timestamp}-${currentFrameNumber}.jpg`
        const saveUploadedFrame = (file, targetName) => {
            if (!file) return null
            const targetPath = path.join(uploadsDir, targetName)
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { force: true })
            }
            try {
                fs.renameSync(file.path, targetPath)
            } catch (renameError) {
                fs.copyFileSync(file.path, targetPath)
                fs.unlinkSync(file.path)
            }
            return targetPath
        }

        const previousFramePath = saveUploadedFrame(uploadedFiles.frame_before && uploadedFiles.frame_before[0], `${timestamp}-${currentFrameNumber - 1}.jpg`)
        const currentFramePath = saveUploadedFrame(uploadedFiles.frame[0], currentFileName)
        const nextFramePath1 = saveUploadedFrame(uploadedFiles.frame_after_1 && uploadedFiles.frame_after_1[0], `${timestamp}-${currentFrameNumber + 1}.jpg`)
        const nextFramePath2 = saveUploadedFrame(uploadedFiles.frame_after_2 && uploadedFiles.frame_after_2[0], `${timestamp}-${currentFrameNumber + 2}.jpg`)

        const form = new FormData()
        const appendIfExists = (filePath, fieldName) => {
            if (!filePath) return
            form.append(fieldName, fs.createReadStream(filePath), path.basename(filePath))
        }

        appendIfExists(previousFramePath, 'frame_before')
        appendIfExists(currentFramePath, 'frame')
        appendIfExists(nextFramePath1, 'frame_after_1')
        appendIfExists(nextFramePath2, 'frame_after_2')

        const resp = await fetch(`${pythonUrl}/analyze-frame/`, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
        })

        const ct = resp.headers.get('content-type') || ''
        let data
        if (ct.includes('application/json')) data = await resp.json().catch(() => ({}))
        else data = await resp.text().catch(() => ({}))

        console.log('Forwarded frame window to python:', `${pythonUrl}/analyze-frame/`, 'status=', resp.status)

        if (typeof data === 'string') return res.status(resp.status).send(data)
            
        console.log('Python analysis result:', data)
        console.log(JSON.stringify(data.gemini_analysis, null, 2))
        return res.status(resp.status).json(data)
    } catch (err) {
        console.error('Error forwarding frame window to python service:', err)
        return res.status(500).json({ error: 'Failed to forward frame window to python service', details: err.message })
    }


})

export default router