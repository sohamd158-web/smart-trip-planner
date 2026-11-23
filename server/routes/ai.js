const express = require('express');
const { GoogleGenAI, Type } = require('@google/genai');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { discoverWithin400Km, generateGeoItinerary } = require('../services/geoDiscovery');

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

router.get('/:tripId/discover', async (req, res) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const data = await discoverWithin400Km(trip.destination, req.query.q || '');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:tripId/ai-itinerary', async (req, res) => {
  try {
    const { preferences, replaceExisting } = req.body;
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const days = Math.max(
      1,
      Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)) + 1
    );

    const searchPref = (preferences || '').trim();
    const [discovery, generatedActivities] = await Promise.all([
      discoverWithin400Km(trip.destination, searchPref),
      generateGeoItinerary(trip.destination, days, trip.budget, searchPref)
    ]);

    if (replaceExisting !== false) {
      await prisma.activity.deleteMany({ where: { tripId: trip.id } });
    }

    await prisma.activity.createMany({
      data: generatedActivities.map((act) => ({
        dayNumber: act.dayNumber,
        title: act.title,
        category: act.category,
        estimatedCost: act.estimatedCost,
        notes: act.notes,
        tripId: trip.id,
      })),
    });

    const allActivities = await prisma.activity.findMany({
      where: { tripId: trip.id },
      orderBy: { dayNumber: 'asc' },
    });

    res.status(201).json({
      message: 'Itinerary generated',
      source: 'geo-100km-synced',
      discovery,
      activities: allActivities
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function smartExpenseParser(text, members) {
  const safeMembers = Array.isArray(members) && members.length > 0 ? members : ['Member'];
  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch.at(1)) : 0;

  const lower = text.toLowerCase();
  const paidBeforeMatch = text.match(/([a-zA-Z]+)\s+paid/i);
  const paidAfterMatch = text.match(/paid\s+by\s+([a-zA-Z]+)/i);
  const candidate = (paidBeforeMatch ? paidBeforeMatch.at(1) : paidAfterMatch ? paidAfterMatch.at(1) : '').toLowerCase();

  const paidBy =
    safeMembers.find((m) => m.toLowerCase() === candidate) ||
    safeMembers.find((m) => lower.startsWith(m.toLowerCase())) ||
    safeMembers.at(0);

  const mentioned = safeMembers.filter((m) => lower.includes(m.toLowerCase()));
  const splitAmong = mentioned.length > 1 ? mentioned : safeMembers;

  const forMatch = text.match(/for\s+(.+?)(?:\s+split|\s+between|\s+among|\s+paid|$)/i);
  let description = forMatch ? forMatch.at(1).trim() : '';
  if (!description) {
    description = text
      .replace(/(\d+(?:\.\d+)?)/g, '')
      .replace(/\b(paid|by|for|split|between|among|and|rs|inr|₹)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (!description) description = 'Trip Expense';
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return { description, amount, paidBy, splitAmong };
}

router.post('/:tripId/ai-expense', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Expense text is required' });

    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const safeMembers = Array.isArray(trip.members) && trip.members.length > 0 ? trip.members : ['Member'];
    let parsed = smartExpenseParser(text, safeMembers);

    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Extract expense from: "${text}". Valid members ONLY: ${JSON.stringify(safeMembers)}. Default paidBy to "${safeMembers.at(0)}" and splitAmong to all members if unspecified.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                paidBy: { type: Type.STRING },
                splitAmong: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['description', 'amount', 'paidBy', 'splitAmong'],
            },
            thinkingConfig: { thinkingBudget: 0 },
            httpOptions: { signal: controller.signal },
          },
        });
        clearTimeout(timer);
        const aiResult = JSON.parse(response.text);
        if (aiResult && Number(aiResult.amount) > 0) {
          parsed = aiResult;
        }
      } catch (_) {
        // Use instant smartExpenseParser fallback
      }
    }

    const finalAmount = Number(parsed.amount) || 0;
    if (finalAmount <= 0) {
      return res.status(400).json({ error: 'Please include an amount (e.g., "Soham paid 1200 for lunch")' });
    }

    const validPaidBy = safeMembers.find((m) => m.toLowerCase() === String(parsed.paidBy || '').toLowerCase()) || safeMembers.at(0);
    const validSplit = (Array.isArray(parsed.splitAmong) ? parsed.splitAmong : []).filter((m) => safeMembers.includes(m));

    const expense = await prisma.expense.create({
      data: {
        description: String(parsed.description || 'Trip Expense').slice(0, 80),
        amount: finalAmount,
        paidBy: validPaidBy,
        splitAmong: validSplit.length > 0 ? validSplit : safeMembers,
        tripId: trip.id,
      },
    });

    res.status(201).json({ expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
