import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import "dotenv/config";
import path from 'path';

// set up routers
import authRouter from './routes/auth.js';
import footageRouter from './routes/footage.js';
import emailRouter from './routes/email.js';

const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api/auth', authRouter);
app.use('/api/footage', footageRouter);
app.use('/api/email', emailRouter);



// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

