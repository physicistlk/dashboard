# Multi-platform lightweight Dockerfile for Dashboard (Dashdot + Heimdall)
FROM node:22-alpine

# Install essential system utilities for hardware and network telemetry
RUN apk add --no-cache \
    procps \
    iproute2 \
    util-linux \
    lm-sensors \
    pciutils \
    curl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --loglevel=info

# Copy application files
COPY server.js ./
COPY preset-apps.json ./
COPY defaults/ ./defaults/
COPY public/ ./public/

# Create persistent data volume directory with open permissions for rootless containers
RUN mkdir -p /app/data && chmod -R 777 /app/data

# Environment configuration
ENV NODE_ENV=production \
    PORT=3110 \
    DATA_DIR=/app/data

# Expose port
EXPOSE 3110

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3110/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
