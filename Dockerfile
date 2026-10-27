# ============================================
# Wiki MCP - Multi-stage Docker build
# ============================================

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S wiki -u 1001

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built files
COPY --from=builder /app/dist ./dist

# Create directories for volumes
RUN mkdir -p /app/content /app/data && \
    chown -R wiki:nodejs /app

# Switch to non-root user
USER wiki

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default to HTTP transport (for Docker)
ENV MCP_TRANSPORT=http
ENV PORT=3000
ENV DATABASE_PATH=/app/data/wiki.db
ENV CONTENT_PATH=/app/content

CMD ["node", "dist/server.js"]
