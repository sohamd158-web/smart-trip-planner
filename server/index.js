require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const activityRoutes = require('./routes/activities');
const expenseRoutes = require('./routes/expenses');
const aiRoutes = require('./routes/ai');

const app = express();
const prisma = new PrismaClient();

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin.includes("localhost") || origin.endsWith(".vercel.app")) {
      return cb(null, true);
    }
    return cb(null, true);
  },
  credentials: true
}));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/trips', activityRoutes);
app.use('/api/trips', expenseRoutes);
app.use('/api/trips', aiRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
