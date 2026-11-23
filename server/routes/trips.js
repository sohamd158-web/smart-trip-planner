const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, destination, startDate, endDate, budget, members } = req.body;
    if (!title || !destination || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, destination, start date, and end date are required' });
    }

    const userExists = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!userExists) {
      return res.status(401).json({ error: 'Session expired — please log out and log in again' });
    }

    const cleanMembers = Array.isArray(members) && members.length > 0 ? members : [userExists.name || 'Soham'];
    const trip = await prisma.trip.create({
      data: {
        title: String(title).trim(),
        destination: String(destination).trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        budget: Number(budget) || 10000,
        members: cleanMembers,
        userId: req.userId,
      },
    });
    res.status(201).json(trip);
  } catch (err) {
    res.status(500).json({ error: 'Create trip error: ' + err.message });
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
    await prisma.trip.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/activities', async (req, res) => {
  try {
    const { dayNumber, title, category, estimatedCost, notes } = req.body;
    const activity = await prisma.activity.create({
      data: {
        dayNumber: Number(dayNumber) || 1,
        title: String(title).trim(),
        category: category || 'Sightseeing',
        estimatedCost: Number(estimatedCost) || 0,
        notes: notes || '',
        tripId: req.params.id,
      },
    });
    res.status(201).json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/activities/:actId', async (req, res) => {
  try {
    await prisma.activity.deleteMany({ where: { id: req.params.actId, tripId: req.params.id } });
    res.json({ message: 'Activity deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/expenses', async (req, res) => {
  try {
    const { description, amount, paidBy, splitAmong } = req.body;
    const expense = await prisma.expense.create({
      data: {
        description: String(description).trim(),
        amount: Number(amount) || 0,
        paidBy,
        splitAmong: Array.isArray(splitAmong) && splitAmong.length > 0 ? splitAmong : [paidBy],
        tripId: req.params.id,
      },
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/expenses/:expId', async (req, res) => {
  try {
    await prisma.expense.deleteMany({ where: { id: req.params.expId, tripId: req.params.id } });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/settlements', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { expenses: true },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const balances = {};
    trip.members.forEach((m) => { balances[m] = 0; });

    let totalSpent = 0;
    trip.expenses.forEach((exp) => {
      const amt = Number(exp.amount) || 0;
      totalSpent += amt;
      if (balances[exp.paidBy] === undefined) balances[exp.paidBy] = 0;
      balances[exp.paidBy] += amt;

      const splitters = Array.isArray(exp.splitAmong) && exp.splitAmong.length > 0 ? exp.splitAmong : trip.members;
      const share = amt / splitters.length;
      splitters.forEach((m) => {
        if (balances[m] === undefined) balances[m] = 0;
        balances[m] -= share;
      });
    });

    const debtors = [];
    const creditors = [];
    Object.entries(balances).forEach(([person, bal]) => {
      const rounded = Math.round(bal * 100) / 100;
      balances[person] = rounded;
      if (rounded < -0.01) debtors.push({ person, amount: -rounded });
      if (rounded > 0.01) creditors.push({ person, amount: rounded });
    });

    const settlements = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].amount, creditors[j].amount);
      settlements.push({
        from: debtors[i].person,
        to: creditors[j].person,
        amount: Math.round(pay * 100) / 100,
      });
      debtors[i].amount -= pay;
      creditors[j].amount -= pay;
      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    res.json({
      totalSpent: Math.round(totalSpent * 100) / 100,
      remainingBudget: Math.round((trip.budget - totalSpent) * 100) / 100,
      balances,
      settlements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
