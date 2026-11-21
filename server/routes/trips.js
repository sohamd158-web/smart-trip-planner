const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.post('/', async (req, res) => {
  try {
    const { title, destination, startDate, endDate, budget, members } = req.body;
    if (!title || !destination || !startDate || !endDate || budget === undefined) {
      return res.status(400).json({ error: 'Missing required trip fields' });
    }

    const trip = await prisma.trip.create({
      data: {
        title,
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        budget: parseFloat(budget),
        members: Array.isArray(members) && members.length > 0 ? members : ['Me'],
        userId: req.userId,
      },
    });
    res.status(201).json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { activities: true, expenses: true } },
      },
    });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        activities: { orderBy: { dayNumber: 'asc' } },
        expenses: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deleted = await prisma.trip.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    if (deleted.count === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
