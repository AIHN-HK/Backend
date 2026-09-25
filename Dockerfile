# Base stage with dependencies
FROM node:20-alpine AS base

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Dependencies stage
FROM base AS dependencies

RUN npm ci

# Build stage
FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client and build
RUN npx prisma generate && \
    npm run build

# Production dependencies stage
FROM base AS prod-dependencies

RUN npm ci --only=production && \
    npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Copy built application and production dependencies
COPY --from=build /app/dist ./dist
COPY --from=prod-dependencies /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

CMD ["node", "dist/src/main"]
