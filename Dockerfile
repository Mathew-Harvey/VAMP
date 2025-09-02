# VAMP - Vessel Asset Management Platform
# Production Docker Image

FROM node:18-alpine

# Install system dependencies for Sharp image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p uploads/temp uploads/works database logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S vamp -u 1001

# Change ownership of app directory
RUN chown -R vamp:nodejs /app
USER vamp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "scripts/start-production.js"]
