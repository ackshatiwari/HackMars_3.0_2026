import express from 'express'
import multer from 'multer'
import fs from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'

const router = express.Router()

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
        fs.unlink(req.file.path, () => {})

        // return text or json depending on python response
        if (typeof data === 'string') return res.status(resp.status).send(data)
        return res.status(resp.status).json(data)
    } catch (err) {
        console.error('Error forwarding upload to python service:', err)
        return res.status(500).json({ error: 'Failed to forward file to python service' })
    }
})

// Trigger the Gemini analysis on the Python side and return results
router.get('/analyze', async (req, res) => {
    try {
        const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000'
        const resp = await fetch(`${pythonUrl}/pass-to-gemini/`)
        const data = await resp.json().catch(() => ({}))
        console.log('Analyze result from python:', data)
        return res.status(resp.status).json(data)
    } catch (err) {
        console.error('Error calling python gemini endpoint:', err)
        return res.status(500).json({ error: 'Failed to call python gemini endpoint' })
    }
})

export default router