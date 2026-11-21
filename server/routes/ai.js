const express = require("express");
const { GoogleGenAI, Type } = require("@google/genai");
const { PrismaClient } = require("@prisma/client");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(authMiddleware);

async function callGeminiFast(ai, contents, responseSchema) {
  const models = ["gemini-3.8-flash", "gemini-3.8-flash-lite"];
  let lastError;

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema,
          thinkingConfig: { thinkingBudget: 0 },
          httpOptions: { signal: controller.signal },
        },
      });

      clearTimeout(timer);
      return JSON.parse(response.text);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function fallbackExpenseParser(text, members) {
  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  const lower = text.toLowerCase();
  const paidMatch = text.match(/([a-zA-Z]+)\s+paid/i);
  const paidCandidate = paidMatch ? paidMatch[1].toLowerCase() : "";
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

function fallbackItinerary(destination, days, budget, preferences) {
  const perDay = Math.round(budget / Math.max(days, 1) / 2);
  const items = [];
  for (let d = 1; d <= days; d++) {
    items.push(
      {
        dayNumber: d,
        title: "Explore " + destination + " Highlights (Day " + d + ")",
        category: "Sightseeing",
        estimatedCost: perDay,
        notes: "Tailored around: " + (preferences || "local culture & viewpoints"),
      },
      {
        dayNumber: d,
        title: "Local Street Food & Dinner Experience",
        category: "Food",
        estimatedCost: Math.round(perDay * 0.6),
        notes: "Authentic regional cuisine in " + destination,
      }
    );
  }
  return items;
}

router.post("/:tripId/ai-itinerary", async (req, res) => {
  try {
    const { preferences } = req.body;
    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const days = Math.max(
      1,
      Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)) + 1
    );

    let generatedActivities;
    let source = "gemini-ai";

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = "Create a " + days + "-day travel itinerary for " + trip.destination + " with total budget INR " + trip.budget + " for " + trip.members.length + " people (" + trip.members.join(", ") + "). Preferences: " + (preferences || "sightseeing and local food") + ". Return 2 activities per day with realistic INR costs.";

      generatedActivities = await callGeminiFast(ai, prompt, {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dayNumber: { type: Type.INTEGER },
            title: { type: Type.STRING },
            category: { type: Type.STRING },
            estimatedCost: { type: Type.NUMBER },
            notes: { type: Type.STRING },
          },
          required: ["dayNumber", "title", "category", "estimatedCost", "notes"],
        },
      });
    } catch (_) {
      source = "smart-fallback";
      generatedActivities = fallbackItinerary(trip.destination, days, trip.budget, preferences);
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
      orderBy: { dayNumber: "asc" },
    });

    res.status(201).json({ message: "Itinerary generated", source, activities: allActivities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:tripId/ai-expense", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Expense text is required" });

    const trip = await prisma.trip.findFirst({
      where: { id: req.params.tripId, userId: req.userId },
    });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    let parsed;
    let source = "gemini-ai";

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = "Extract expense details from: \"" + text + "\". Valid members ONLY: " + JSON.stringify(trip.members) + ". Match paidBy and splitAmong strictly to valid members.";

      parsed = await callGeminiFast(ai, prompt, {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          paidBy: { type: Type.STRING },
          splitAmong: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["description", "amount", "paidBy", "splitAmong"],
      });
    } catch (_) {
      source = "smart-fallback";
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

    res.status(201).json({ source, expense });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
