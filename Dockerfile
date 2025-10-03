FROM node:18-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl zlib libgcc

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Copy Prisma schema
COPY src/prisma ./src/prisma

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate --schema=./src/prisma/schema.prisma

# Copy application code
COPY src ./src

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S safu -u 1001

# Change ownership
USER safu

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]