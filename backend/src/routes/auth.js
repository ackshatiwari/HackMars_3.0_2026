import express from 'express'
import sql from '../config/neon_client.js'
const router = express.Router()

// sign-up endpoint
router.post('/signup', async (req, res) => {
    // username, password, phone_number, email
    const { username, password, phone_number, email } = req.body

    try {

        const result = await sql`
            INSERT INTO hackmars_users (username, password, phone_number, email)
            VALUES (${username}, ${password}, ${phone_number}, ${email})
        `
        res.status(201).json({ message: 'User created successfully' })

    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

// sign-in endpoint
router.post('/signin', async (req, res) => {
    const { email, password } = req.body
    try {
        const result = await sql`
            SELECT * FROM users WHERE email = ${email} AND password = ${password}
        `

        if (result.length === 0) {
            res.status(401).json({ error: 'Invalid email or password' })
        } else {
            res.status(200).json({ message: 'Sign-in successful', user: result[0] })
        }

    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})
    

export default router