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

function fallbackExpenseParser(text, members) {
  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
  const lower = text.toLowerCase();
  const paidMatch = text.match(/([a-zA-Z]+)\s+paid/i);
  const paidCandidate = paidMatch ? paidMatch[1].toLowerCase() : '';
  const paidBy =
    members.find((m) => m.toLowerCase() === paidCandidate) ||
    members.find((m) => lower.startsWith(m.toLowerCase())) ||
    members[0];
  const mentioned = members.filter((m) => lower.includes(m.toLowerCase()));
  const splitAmong = mentioned.length > 1 ? mentioned : members;
  const descMatch = text.match(/for\s+(.+?)(?:\s+split|\s+between|\s+among|$)/i);
  const description = descMatch ? descMatch[1].trim() : text.slice(0, 40);
  return { description, amount, paidBy, splitAmong };
}

router.post('/:tripId/ai-expense', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Expense text is required' });

    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    let parsed;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Extract expense from: "${text}". Valid members ONLY: ${JSON.stringify(trip.members)}.`,
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
      parsed = JSON.parse(response.text);
    } catch (_) {
      parsed = fallbackExpenseParser(text, trip.members);
    }

    const validSplit = (parsed.splitAmong || []).filter((m) => trip.members.includes(m));
    const expense = await prisma.expense.create({
      data: {
        description: parsed.description,
        amount: parsed.amount,
        paidBy: trip.members.includes(parsed.paidBy) ? parsed.paidBy : trip.members[0],
        splitAmong: validSplit.length > 0 ? validSplit : trip.members,
        tripId: trip.id,
      },
    });

    res.status(201).json({ expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
