import nodemailer from 'nodemailer';
import express from 'express';
import sql from '../config/neon_client.js'

const router = express.Router()

// sends an email when aggressive behavior is detected
router.post('/send_email', async (req, res) => {
    const { email, classification: rawClassification, text } = req.body || {}

    console.log('POST /api/email/send_email - received', { email, classification: rawClassification })

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

        // send to all trusted contacts
        const toList = trustedEmailContacts.join(',')
        try {
            const info = await transporter.sendMail({
                from: `${process.env.EMAIL_FROM_NAME || 'Caregiver'} <${mailUser}>`,
                to: toList,
                subject: `ALERT: ${classification || 'SUSPICIOUS MOVEMENT'} DETECTED - Immediate Attention Required (${new Date().toLocaleString()})`,
                html: `<p>Alert classification: <strong>${classification}</strong></p><p>Details: ${text || 'No details provided'}</p>`,
            })

            console.log('send_email: Email sent:', info)

            return res.status(200).json({ message: 'Emails sent', info })
        } catch (err) {
            console.error('Error while sending mail:', err)
            return res.status(500).json({ error: 'Failed to send emails', details: err.message })
        }
    } catch (error) {
        console.error('Error sending email:', error)
        return res.status(500).json({ error: 'Failed to send email' })
    }
})

export default router