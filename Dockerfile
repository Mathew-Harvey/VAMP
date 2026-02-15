FROM node:22-slim AS builder

WORKDIR /app

# Copy everything (monorepo workspaces need full structure for npm install)
COPY . .

# Install all dependencies
RUN npm install

# Build shared package
RUN npm run build:shared

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build API
RUN npm run build:api

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy the full node_modules and built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

EXPOSE 10000
CMD ["node", "dist/index.js"]
