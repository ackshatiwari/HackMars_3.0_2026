import nodemailer from 'nodemailer';
import express from 'express';
import sql from '../config/neon_client.js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const router = express.Router()
const upload = multer({ dest: 'uploads/' })

// sends an email when aggressive behavior is detected
// Support both JSON posts and multipart/form-data with attachments.
router.post('/send_email', upload.fields([
    { name: 'frame_before', maxCount: 1 },
    { name: 'frame', maxCount: 1 },
    { name: 'frame_after', maxCount: 1 },
]), async (req, res) => {
    // If JSON was posted, body will be on req.body and req.is('application/json') is true.
    const isJson = req.is && req.is('application/json')
    let email, rawClassification, text, job_id, confidence

    if (isJson) {
        ({ email, classification: rawClassification, text, job_id, confidence } = req.body || {})
    } else {
        // multipart: fields are strings
        email = req.body.email
        rawClassification = req.body.classification
        text = req.body.text
        job_id = req.body.job_id
        confidence = req.body.confidence
    }

    // extract reason and confidence from request body or from embedded JSON in `text`
    let reason = req.body?.reason || ''
    try {
        // If confidence wasn't provided as a top-level field, try to extract from `text` JSON
        if ((!confidence || confidence === '') && text) {
            if (typeof text === 'string') {
                const maybe = text.trim()
                if (maybe.startsWith('{') || maybe.startsWith('[')) {
                    const parsed = JSON.parse(maybe)
                    confidence = confidence || parsed.confidence || parsed.confidence_score || parsed.score
                    reason = reason || parsed.reason || parsed.reasons || parsed.explanation || parsed.summary
                    rawClassification = rawClassification || parsed.classification || parsed.label || parsed.prediction
                } else {
                    // try to find JSON inside code fences (e.g. ```json {...}```)
                    const m = /```json\s*([\s\S]*?)\s*```/i.exec(maybe)
                    if (m && m[1]) {
                        const parsed = JSON.parse(m[1])
                        confidence = confidence || parsed.confidence || parsed.confidence_score || parsed.score
                        reason = reason || parsed.reason || parsed.reasons || parsed.explanation || parsed.summary
                        rawClassification = rawClassification || parsed.classification || parsed.label || parsed.prediction
                    }
                }
            } else if (typeof text === 'object') {
                const parsed = text
                confidence = confidence || parsed.confidence || parsed.confidence_score || parsed.score
                reason = reason || parsed.reason || parsed.reasons || parsed.explanation || parsed.summary
                rawClassification = rawClassification || parsed.classification || parsed.label || parsed.prediction
            }
        }
    } catch (e) {
        console.warn('send_email: failed to parse `text` for confidence/reason:', e && e.message)
    }

    

    console.log('POST /api/email/send_email - received', { email, classification: rawClassification, job_id })

    if (!email) {
        console.log('send_email: missing email in request body')
        return res.status(400).json({ error: 'Email is required' })
    }

    let classification = rawClassification || ''
    if (classification === 'aggressive_handling') {
        classification = 'AGGRESSIVE HANDLING'
    } else if (classification === 'potential_physical_abuse') {
        classification = 'POTENTIAL PHYSICAL ABUSE'
    }

    try {
        const result = await sql`
            SELECT emergency_email_contacts
            FROM public.hackmars_users
            WHERE email = ${email}
        `

        console.log('send_email: DB query returned', result.length, 'rows')
        const trustedEmailContacts = (result[0]?.emergency_email_contacts) || []
        console.log('send_email: trustedEmailContacts=', trustedEmailContacts)
        if (!Array.isArray(trustedEmailContacts) || trustedEmailContacts.length === 0) {
            console.log('send_email: no trustedEmailContacts found for', email)
            return res.status(400).json({ error: 'No trusted email contacts found for this user' })
        }
        const toList = trustedEmailContacts.join(',')

        // configure transporter using environment variables
        const mailUser = process.env.GMAIL_USER || process.env.SMTP_USER
        const mailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS
        const smtpHost = process.env.SMTP_HOST
        const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined

        const transportOptions = smtpHost
            ? { host: smtpHost, port: smtpPort || 587, secure: false, auth: { user: mailUser, pass: mailPass } }
            : { service: 'gmail', auth: { user: mailUser, pass: mailPass } }

        console.log('send_email: transportOptions=', transportOptions)
        const transporter = nodemailer.createTransport({ ...transportOptions, tls: { rejectUnauthorized: false } })

        try {
            await transporter.verify()
            console.log('send_email: transporter verified')
        } catch (error) {
            console.error('Email transporter verification failed:', error)
            return res.status(500).json({ error: 'Email transporter configuration error: ' + error.message })
        }
        try {
            console.log('send_email: sending mail to=', toList)

            // build attachments from multipart files if present
            const attachments = []
            if (req.files) {
                const fileFields = ['frame_before', 'frame', 'frame_after']
                for (const f of fileFields) {
                    const files = req.files[f]
                    if (files && files.length > 0) {
                        // keep first
                        const file = files[0]
                        attachments.push({ filename: file.originalname || path.basename(file.path), path: file.path })
                    }
                }
            }

            const mailOptions = {
                from: `${process.env.EMAIL_FROM_NAME || 'Caregiver'} <${mailUser}>`,
                to: toList,
                subject: `ALERT: ${classification || 'SUSPICIOUS MOVEMENT'} DETECTED - Immediate Attention Required (${new Date().toLocaleString()})`,
                html: `
                    <p>Alert classification: 
                        <strong>${classification}</strong>
                        </p><p>Details
                        <ul>
                            <li><strong>Confidence:</strong> ${confidence || 'N/A'}</li>
                            <li><strong>Reason:</strong> ${reason || 'N/A'}</li>
                            <li><strong>Additional Notes:</strong> ${text || 'N/A'}</li>
                            
                        `,
                attachments: attachments,
            }

            const info = await transporter.sendMail(mailOptions)

            console.log('send_email: sendMail result=', info)

            // cleanup any temp uploaded attachment files
            if (attachments.length > 0) {
                for (const a of attachments) {
                    try {
                        fs.unlinkSync(a.path)
                    } catch (e) {
                        // ignore cleanup errors
                    }
                }
            }

            return res.status(200).json({ message: 'Emails sent', info })
        } catch (err) {
            console.error('send_email: Error while sending mail:', err)
            return res.status(500).json({ error: 'Failed to send emails', details: err.message })
        }
        
    } catch (error) {
        console.error('Error sending email:', error)
        return res.status(500).json({ error: 'Failed to send email' })
    }
})

export default router