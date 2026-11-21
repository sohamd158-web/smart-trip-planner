const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { calculateSettlements } = require('../utils/debtSimplifier');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

// POST /api/trips/:tripId/expenses - Log a new expense
router.post('/:tripId/expenses', async (req, res) => {
  try {
    const { description, amount, paidBy, splitAmong } = req.body;
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const expense = await prisma.expense.create({
      data: {
        description,
        amount: parseFloat(amount),
        paidBy,
        splitAmong: Array.isArray(splitAmong) && splitAmong.length > 0 ? splitAmong : trip.members,
        tripId: trip.id,
      },
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/:tripId/settlements - Get total spent, remaining budget, and who owes whom
router.get('/:tripId/settlements', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
      include: { expenses: true },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const totalSpent = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
    const { balances, settlements } = calculateSettlements(trip.members, trip.expenses);

    res.json({
      budget: trip.budget,
      totalSpent,
      remainingBudget: trip.budget - totalSpent,
      balances,
      settlements,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trips/:tripId/expenses/:expenseId
router.delete('/:tripId/expenses/:expenseId', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    await prisma.expense.delete({ where: { id: req.params.expenseId } });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
