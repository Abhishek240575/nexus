# Nexus — Microblogging Platform

A full-featured microblogging platform built with React 18, Node.js, Express, TypeScript, and PostgreSQL.

## Project structure

```
nexus/
├── apps/
│   ├── api/          — Node.js + Express + TypeScript backend
│   └── web/          — React 18 + Vite + Tailwind frontend
└── packages/
    └── shared/       — Shared types (future)
```

## Quick start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Fill in your values
```

### 3. Create the database
```bash
createdb nexus_db
psql -d nexus_db -f 001_microblog_full_migration.sql
```

### 4. Start development servers
```bash
npm run dev            # starts both API (4000) and web (5173)
npm run dev:api        # API only
npm run dev:web        # frontend only
```

## Ports
| Service    | Port  |
|------------|-------|
| API        | 4000  |
| Frontend   | 5173  |
| PostgreSQL | 5432  |
| Redis      | 6379  |

## Build order (sprints)
1. Auth ✅ (this scaffold)
2. Posts + feed
3. Social graph (follow, like, repost, hashtags)
4. Profile + media uploads (Cloudinary)
5. Notifications (Socket.io)
6. Direct messages
7. Polls + bookmarks + lists
8. Communities
9. Verified badges + premium tiers (Stripe)
10. Spaces (LiveKit WebRTC)
11. Creator analytics dashboard
12. Admin panel + moderation

## Tech stack
| Layer       | Technology                            |
|-------------|---------------------------------------|
| Frontend    | React 18, Vite, Tailwind, Zustand, React Query |
| Backend     | Node.js, Express, TypeScript          |
| Database    | PostgreSQL 15                         |
| Cache       | Redis                                 |
| Realtime    | Socket.io                             |
| Spaces      | LiveKit (WebRTC)                      |
| Media       | Cloudinary                            |
| Payments    | Stripe                                |
| Auth        | JWT + Passport.js (Google, GitHub)    |
| Email       | Nodemailer                            |
| Deploy      | Render                                |
