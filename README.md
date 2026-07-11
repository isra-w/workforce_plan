# Workforce Planning Application

A full-stack workforce planning system for creating and managing employee hiring plans, built with React, Express, PostgreSQL, and Prisma.

## Features

- **Workforce Plan Creation** (FR-01): Create strategic hiring plans
- **Planning Structure** (FR-02): Annual and quarterly planning cycles
- **Headcount Definition** (FR-03): Define positions with count, type, and priority
- **Justification** (FR-04): Business case and supporting documents
- **Draft Management** (FR-05): Save plans as drafts
- **Version Control** (FR-06): Track plan version history
- **Quarterly Cadence** (FR-07): Quarterly planning support
- **Submission** (FR-08): Submit plans for multi-stage approval (HR → Finance → CEO)

## Project Structure

```text
workforce/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       └── utils/
└── frontend/
    └── src/
        ├── app/
        │   ├── components/
        │   │   ├── auth/
        │   │   ├── common/
        │   │   ├── Core/
        │   │   ├── DefaultLayout/
        │   │   ├── Header/
        │   │   └── Sidebars/
        │   ├── context/
        │   ├── pages/
        │   │   ├── Auth/
        │   │   └── Workforce/
        │   ├── routes/
        │   └── services/
        └── utils/
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

### 1. Database

Create a PostgreSQL database:

```sql
CREATE DATABASE workforce_db;
```

### 2. Backend

```bash
cd backend
cp .env.example .env

npm install
npx prisma db push
npm run db:seed
npm run dev
```

Backend runs at `http://localhost:5001`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

## Getting Started

Create accounts directly from the signup page and choose one of the supported roles: Workforce Planner, HR, CEO, or Candidate.

## API Endpoints

### Auth

- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/verify/:token` - Verify email
- `GET /api/auth/me` - Get current user

### Workforce

- `GET /api/workforce/dashboard` - Dashboard KPIs
- `GET /api/workforce/plans` - List plans
- `POST /api/workforce/plans` - Create plan
- `PUT /api/workforce/plans/:id` - Update/save draft
- `POST /api/workforce/plans/:id/submit` - Submit for approval
- `POST /api/workforce/plans/:id/review` - Approve/reject
