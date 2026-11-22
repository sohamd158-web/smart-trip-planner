# TripSplit AI — Smart Collaborative Trip Planner & Expense Splitter

A full-stack AI-powered travel planning and group expense management web application built with **React, Node.js, Express, PostgreSQL, Prisma ORM, and Gemini AI**.

## Key Features
- **AI Day-by-Day Itinerary Generator:** Uses Gemini Structured Outputs (`responseSchema`) with a 7-second `AbortController` timeout and deterministic fallback to generate budget-aware schedules saved directly to PostgreSQL.
- **Natural-Language Expense Parser:** Converts plain English (e.g., *"Rahul paid 1500 for dinner split between Soham and Rahul"*) into validated database expense records.
- **Greedy Debt-Simplification Engine:** Computes net member balances and minimizes total peer-to-peer settlement transfers (`Who Owes Whom`).
- **JWT Authentication & Multi-Trip Workspaces:** Secure user registration/login with isolated trip budgets, activities, and expense histories.

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS, Axios, Lucide Icons
- **Backend:** Node.js, Express, Prisma ORM, JWT (`bcryptjs` + `jsonwebtoken`)
- **Database:** PostgreSQL (Supabase)
- **AI Integration:** Google `@google/genai` SDK

## Local Setup
1. **Backend:**
   ```bash
   cd server && npm install
   npx prisma generate
   npm start
   ```
2. **Frontend:**
   ```bash
   cd client && npm install
   npm run dev
   ```
