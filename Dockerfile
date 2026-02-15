FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm install

# Copy source
COPY . .

# Build shared package
RUN npm run build:shared

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build API
WORKDIR /app
RUN npm run build:api

# Production stage
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma apps/api/node_modules/.prisma

WORKDIR /app/apps/api

EXPOSE 10000
CMD ["node", "dist/index.js"]
