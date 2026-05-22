import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import "dotenv/config";

// set up routers
import authRouter from './routes/auth.js';
import footageRouter from './routes/footage.js';

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/footage', footageRouter);



// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

