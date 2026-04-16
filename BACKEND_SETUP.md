# Backend API Setup Guide

This document guides you through setting up a separate backend service for EmailVault after migrating from Next.js to Create React App.

## Overview

The frontend (React app) is now a client-side SPA that communicates with a separate backend API. The backend handles:
- Prisma ORM integration with PostgreSQL
- Vault API endpoints (`GET` and `POST` to `/api/vault`)
- CORS handling for cross-origin requests

## Backend Requirements

### Technologies
- Node.js (v16+)
- Express.js (recommended) or any Node.js framework
- PostgreSQL database
- Prisma ORM
- npm or yarn

### Environment Variables
The backend needs the following environment variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/emailvault

# Server
PORT=5000
NODE_ENV=development

# CORS (allow your frontend URL)
CORS_ORIGIN=http://localhost:3000
```

## Recommended Backend Structure

Create a separate backend repository with this structure:

```
backend/
├── src/
│   ├── api/
│   │   ├── vault.ts        # Vault endpoint handler
│   │   └── index.ts        # Route definitions
│   ├── middleware/
│   │   ├── cors.ts         # CORS configuration
│   │   └── errorHandler.ts # Global error handler
│   ├── db/
│   │   └── client.ts       # Prisma client
│   ├── types/
│   │   └── index.ts        # TypeScript types
│   └── index.ts            # Express app setup
├── prisma/
│   └── schema.prisma       # Database schema (same as original)
├── .env.example
├── .env.local
├── package.json
├── tsconfig.json
└── README.md
```

## Step 1: Create Backend Project

```bash
# Create backend directory
mkdir emailvault-backend
cd emailvault-backend

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express cors dotenv prisma @prisma/client typescript ts-node @types/express @types/node
npm install -D @types/node typescript

# Create src directory
mkdir -p src/api src/middleware src/db src/types
```

## Step 2: Setup Prisma

Copy your Prisma schema from the original project:

```bash
mkdir prisma
# Copy schema.prisma from original project
cp ../EmailsValut2/prisma/schema.prisma ./prisma/schema.prisma

# Initialize Prisma
npx prisma init

# Update DATABASE_URL in .env.local
# Then run migrations
npx prisma migrate dev --name init
```

## Step 3: Implement Express Server

Create `src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import vaultRouter from './api/vault';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware
app.use(express.json());

// Routes
app.use('/api', vaultRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
```

## Step 4: Implement Vault Endpoints

Create `src/api/vault.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/vault - Fetch vault data
router.get('/vault', async (req: Request, res: Response) => {
  try {
    // Return serialized vault state from your database
    // This should reconstruct the AppState structure from Prisma models
    const data = {
      items: [],
      categories: [],
      deliveryMen: [],
      orders: [],
      credentials: [],
      history: [],
      settings: {},
    };
    res.json(data);
  } catch (err) {
    console.error('Error fetching vault:', err);
    res.status(500).json({ error: 'Failed to fetch vault data' });
  }
});

// POST /api/vault - Save vault data
router.post('/vault', async (req: Request, res: Response) => {
  try {
    const state = req.body;
    // Save vault state to database
    // Implement logic to store items, orders, credentials, etc.
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving vault:', err);
    res.status(500).json({ error: 'Failed to save vault data' });
  }
});

export default router;
```

## Step 5: Configure Environment

Create `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/emailvault"
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

Create `.env.example`:

```env
DATABASE_URL=postgresql://user:password@host:port/dbname
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

## Step 6: Add Scripts to package.json

```json
{
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate"
  }
}
```

## Step 7: Run Backend

```bash
# Development
npm run dev

# Should output: Backend server running on http://localhost:5000
```

## Frontend Configuration

Make sure your frontend `.env.local` points to the backend:

```env
REACT_APP_API_URL=http://localhost:5000
```

For production, change to your deployed backend URL:

```env
REACT_APP_API_URL=https://api.yourdomain.com
```

## Testing the Integration

1. Start backend:
```bash
cd backend
npm run dev
```

2. Start frontend (in another terminal):
```bash
cd EmailsValut2
npm start
```

3. The frontend should now:
   - Load data from `http://localhost:5000/api/vault`
   - Save data to the same endpoint
   - Display data in the UI

## Production Deployment

### Backend Deployment Options
- **Heroku**: Free tier available, easy PostgreSQL setup
- **Railway**: Modern alternative to Heroku
- **AWS**: EC2 + RDS
- **DigitalOcean**: App Platform + PostgreSQL
- **Render**: Free tier available

### Frontend Deployment Options
- **Vercel**: Optimized for React
- **Netlify**: Zero-config deployment
- **AWS Amplify**: Full AWS integration
- **GitHub Pages**: Static hosting only

### Environment Variables for Production

Backend:
```env
DATABASE_URL=postgresql://prod_user:password@prod_host:5432/emailvault_prod
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

Frontend:
```env
REACT_APP_API_URL=https://api.yourdomain.com
```

## Troubleshooting

### CORS Errors
If you see CORS errors in browser console:
1. Check `CORS_ORIGIN` in backend `.env.local`
2. Ensure it matches your frontend URL
3. Restart backend after changing `.env`

### Database Connection Issues
1. Verify PostgreSQL is running
2. Check `DATABASE_URL` is correct
3. Run `npx prisma db push` to sync schema
4. Check database exists: `psql -l`

### API Not Responding
1. Verify backend is running: `curl http://localhost:5000/health`
2. Check network tab in browser DevTools
3. Verify `REACT_APP_API_URL` in frontend `.env.local`

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [CORS Explanation](https://enable-cors.org/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
