const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// POST /api/trips/:tripId/activities - Add an activity
router.post('/:tripId/activities', async (req, res) => {
  try {
    const { dayNumber, title, category, estimatedCost, notes } = req.body;
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const activity = await prisma.activity.create({
      data: {
        dayNumber: parseInt(dayNumber, 10) || 1,
        title,
        category: category || 'Sightseeing',
        estimatedCost: parseFloat(estimatedCost) || 0,
        notes: notes || '',
        tripId: trip.id,
      },
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trips/:tripId/activities/:activityId - Remove an activity
router.delete('/:tripId/activities/:activityId', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    await prisma.activity.delete({ where: { id: req.params.activityId } });
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
