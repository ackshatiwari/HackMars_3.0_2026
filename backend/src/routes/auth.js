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
        res.status(201).json({ message: 'User created successfully', user: { username, email, phone_number } })

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
            res.status(200).json({ message: 'Sign-in successful', user: { username: result[0].username, email: result[0].email, phone_number: result[0].phone_number } })
        }

    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})
    

export default router