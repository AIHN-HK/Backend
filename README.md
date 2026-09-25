# AIHN Backend API

NestJS backend with TypeScript, PostgreSQL, Prisma, and JWT authentication.

## Quick Start

```bash
npm install
createdb aihn_dev
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

## URLs

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Scalar: http://localhost:3000/api/reference

## Features

- JWT auth (access + refresh tokens)
- Swagger + Scalar API docs
- Global error handling & validation
- Request logging
- Docker support

## Commands

```bash
npm run start:dev       # Development
npm run build           # Build
npx prisma studio       # Database GUI
npx prisma migrate dev  # Migrations
npm run test            # Tests
```

## Environment

Copy `.env.example` to `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aihn_dev?schema=public"
JWT_ACCESS_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

## Project Structure

```
src/
├── core/       # Config, guards, filters, interceptors
├── modules/    # Auth, users, health
├── app.module.ts
└── main.ts
```

## API Examples

### Register
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Get Profile
```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Endpoints

**Public:**
- `POST /api/v1/auth/register` - Register
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/health` - Health check

**Protected (JWT required):**
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/users/me` - Get profile
- `PATCH /api/v1/users/me` - Update profile
- `GET /api/v1/users/:id` - Get user

## Docker

```bash
docker-compose up -d    # Start
docker-compose logs -f  # Logs
docker-compose down     # Stop
```

## Troubleshooting

**Database error:** `brew services start postgresql@14`

**Port in use:** `lsof -ti:3000 | xargs kill -9`

**Prisma error:** `npx prisma generate`

## Tech Stack

- NestJS 11
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT + Passport
- Swagger + Scalar
