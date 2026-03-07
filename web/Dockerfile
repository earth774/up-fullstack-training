# -----------------------------
# Base image
# -----------------------------
    FROM node:20-alpine AS base
    WORKDIR /app
    RUN apk add --no-cache libc6-compat
    
    # -----------------------------
    # Dependencies stage
    # -----------------------------
    FROM base AS deps
    
    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    
    # -----------------------------
    # Build stage
    # -----------------------------
    FROM base AS builder
    
    WORKDIR /app
    
    COPY --from=deps /app/node_modules ./node_modules
    COPY . .
    
    # Prisma client
    RUN npx prisma generate
    
    # Next build
    RUN npm run build
    
    # -----------------------------
    # Production stage
    # -----------------------------
    FROM node:20-alpine AS runner
    
    WORKDIR /app
    
    ENV NODE_ENV=production
    
    # copy standalone build
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder /app/.next/static ./.next/static
    COPY --from=builder /app/public ./public
    
    # prisma + lib (needed for migrate + seed)
    COPY --from=builder /app/prisma ./prisma
    COPY --from=builder /app/lib ./lib
    COPY --from=builder /app/app/generated ./app/generated
    COPY --from=builder /app/node_modules ./node_modules
    
    EXPOSE 3000
    
    CMD sh -c "npx prisma migrate deploy && npx prisma db seed && node server.js"