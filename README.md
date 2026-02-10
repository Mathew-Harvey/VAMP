# MarineStream Platform

A multi-party vessel maintenance and compliance platform for managing biofouling inspections, hull cleaning, engineering maintenance, and compliance reporting across defence and commercial maritime fleets.

## Architecture

This is a TypeScript monorepo with three packages:

- **`packages/shared`** — Shared types, Zod validation schemas, and constants
- **`apps/api`** — Express.js REST API with Prisma ORM and PostgreSQL
- **`apps/web`** — React SPA with Vite, Tailwind CSS, and shadcn/ui components

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16
- Redis (optional, for BullMQ job queue)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` with your database URL and JWT secret.

### 3. Set up database

```bash
cd apps/api
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Seed demo data

```bash
cd apps/api
npm run db:seed
```

### 5. Start development

```bash
# Start API (port 3001)
npm run dev:api

# In another terminal, start frontend (port 5173)
npm run dev:web
```

### 6. Open the app

Visit `http://localhost:5173` and log in with:

- **Email:** `mharvey@marinestream.com.au`
- **Password:** `changeme123`

## Demo Users

| Email | Password | Role |
|-------|----------|------|
| mharvey@marinestream.com.au | changeme123 | Ecosystem Admin |
| manager@franmarine.com.au | changeme123 | Manager |
| operator@franmarine.com.au | changeme123 | Operator |

## API Documentation

Base URL: `/api/v1`

### Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Current user profile |
| GET | `/vessels` | List vessels |
| POST | `/vessels` | Create vessel |
| GET | `/work-orders` | List work orders |
| POST | `/work-orders` | Create work order |
| GET | `/inspections` | List inspections |
| POST | `/inspections` | Create inspection |
| GET | `/dashboard/overview` | Dashboard stats |
| GET | `/audit` | Audit log |
| GET | `/audit/verify` | Verify audit chain integrity |

## Testing

```bash
npm test
```

## Deployment

The platform is configured for deployment on Render.com. See `render.yaml` for the blueprint.

## Tech Stack

**Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod, JWT

**Frontend:** React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Router v6, Recharts, Zustand
