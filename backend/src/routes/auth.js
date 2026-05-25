import express from 'express'
import sql from '../config/neon_client.js'
const router = express.Router()

// sign-up endpoint
router.post('/signup', async (req, res) => {
    // username, password, phone_number, email, medical_conditions
    const { username, password, phone_number, email, medical_conditions } = req.body

    try {

        const result = await sql`
            INSERT INTO hackmars_users (username, password, phone_number, email, medical_conditions)
            VALUES (${username}, ${password}, ${phone_number}, ${email}, ${medical_conditions})
        `
        res.status(201).json({ message: 'User created successfully', user: { username, email, phone_number, medical_conditions } })

    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// sign-in endpoint
router.post('/signin', async (req, res) => {
    const { email, password } = req.body

    // print the email and password to the console
    
    try {
        const result = await sql`
            SELECT * FROM public.hackmars_users WHERE email = ${email} AND password = ${password}
        `

        if (result.length === 0) {
            res.status(401).json({ error: 'Invalid email or password' })
        } else {
            res.status(200).json({ message: 'Sign-in successful', user: { username: result[0].username, email: result[0].email, phone_number: result[0].phone_number, medical_conditions: result[0].medical_conditions } })
        }

    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

router.get('/profile', async (req, res) => {
    const { email } = req.query

    if (!email) {
        return res.status(400).json({ error: 'email query parameter is required' })
    }

    try {
        const result = await sql`
            SELECT username, email, phone_number, medical_conditions, emergency_phone_contacts, emergency_email_contacts
            FROM public.hackmars_users
            WHERE email = ${email}
        `

        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' })
        }

        const user = result[0]
        const normalizeList = (value) => {
            if (Array.isArray(value)) return value
            if (value === null || value === undefined || value === '') return []
            return [value]
        }

        return res.status(200).json({
            username: user.username,
            email: user.email,
            phone_number: user.phone_number,
            medical_conditions: user.medical_conditions,
            emergency_phone_contacts: normalizeList(user.emergency_phone_contacts),
            emergency_email_contacts: normalizeList(user.emergency_email_contacts),
        })
    } catch (error) {
        return res.status(500).json({ error: error.message })
    }
})

router.post('/update_notification_preferences', async (req, res) => {
    const { email, phone_number_for_notifications, email_for_notifications } = req.body

    try {
        // the columns to be updated, emergency_phone_contacts, and 
        // emergency_email_contacts are jsonB, so we need to append 
        // the new contact to the existing array
        
        const existing_phone_json = await sql`
            SELECT emergency_phone_contacts FROM public.hackmars_users WHERE email = ${email}
        `
        const existing_email_json = await sql`
            SELECT emergency_email_contacts FROM public.hackmars_users WHERE email = ${email}
        `

        const existing_phone_contacts_raw = existing_phone_json[0]?.emergency_phone_contacts || []
        const existing_email_contacts_raw = existing_email_json[0]?.emergency_email_contacts || []

        const existing_phone_contacts = Array.isArray(existing_phone_contacts_raw)
            ? existing_phone_contacts_raw
            : (existing_phone_contacts_raw ? [existing_phone_contacts_raw] : [])

        const existing_email_contacts = Array.isArray(existing_email_contacts_raw)
            ? existing_email_contacts_raw
            : (existing_email_contacts_raw ? [existing_email_contacts_raw] : [])

        // append the new contact to the existing array
        const updated_phone_contacts = phone_number_for_notifications ? [...existing_phone_contacts, phone_number_for_notifications] : existing_phone_contacts
        const updated_email_contacts = email_for_notifications ? [...existing_email_contacts, email_for_notifications] : existing_email_contacts

        // update the user's notification preferences
        await sql`
            UPDATE public.hackmars_users 
            SET emergency_phone_contacts = ${JSON.stringify(updated_phone_contacts)}, emergency_email_contacts = ${JSON.stringify(updated_email_contacts)}
            WHERE email = ${email}
        `

        res.status(200).json({
            message: 'Notification preferences updated successfully',
            emergency_phone_contacts: updated_phone_contacts,
            emergency_email_contacts: updated_email_contacts,
        })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

export default router