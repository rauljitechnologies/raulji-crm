# Raulji CRM

Multi-tenant SaaS CRM — Lead Management, Sales Pipeline, Quotations, Invoices, Analytics, AI Insights.

## Local Setup (5 steps)

### Prerequisites
- Node.js 18+ 
- PostgreSQL 16 (already installed on your Mac)

### Step 1 — Create .env
```bash
# In project root
cp .env.example .env
```
Edit `.env` — set your DATABASE_URL:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/raulji_crm"
JWT_SECRET=raulji_crm_local_dev_secret_minimum_32_chars
```

### Step 2 — Install & setup database
```bash
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
```

### Step 3 — Start API (Terminal 1)
```bash
npm run dev
# API running at http://localhost:4000
# Test: http://localhost:4000/health
```

### Step 4 — Setup & start frontend (Terminal 2)
```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local: NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm run dev
# Frontend at http://localhost:3000
```

### Step 5 — Login
Open http://localhost:3000

| Role         | Email                  | Password   |
|-------------|------------------------|------------|
| Super Admin  | admin@raulji.com       | Admin@123  |
| Company Admin| ariya@raulji.com       | Admin@123  |
| Sales Manager| priya@raulji.com       | Admin@123  |
| Sales Rep    | kiran@raulji.com       | Admin@123  |

## API
- Base URL: `http://localhost:4000/api/v1`
- Health check: `http://localhost:4000/health`
- Full docs: `API_REFERENCE.md`

## Project Structure
```
raulji-crm/
├── server.js                 # API entry point
├── package.json              # Backend dependencies
├── .env                      # Environment variables
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.js               # Demo data
├── backend/
│   ├── controllers/          # Route handlers
│   ├── middleware/           # Auth middleware
│   └── routes/               # API routes
└── frontend/                 # Next.js 14 app
    ├── src/app/              # Pages (App Router)
    │   ├── login/            # Login page
    │   └── dashboard/        # All CRM pages
    ├── src/components/       # Reusable components
    └── src/lib/api.ts        # API client
```

## Pages
| URL | Page |
|-----|------|
| /dashboard | Main dashboard with KPIs |
| /dashboard/companies | Company management |
| /dashboard/leads | Lead management |
| /dashboard/pipeline | Kanban deal pipeline |
| /dashboard/deals | Deals list view |
| /dashboard/quotations | Create & send quotations |
| /dashboard/invoices | Invoices & payments |
| /dashboard/analytics | Charts & team stats |
| /dashboard/ai | AI insights & chat |
| /dashboard/users | Team & roles |
| /dashboard/settings | Settings & API keys |
