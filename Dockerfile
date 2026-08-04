FROM node:22-alpine

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .
# Install missing peer dependency
RUN npm install react-is --legacy-peer-deps

# Build the frontend (Vite)
RUN npm run build

# Canonical root GPC runtime used by Coolify/Traefik.
ENV PORT=3010
ENV NODE_ENV=production
EXPOSE 3010

LABEL org.opencontainers.image.source="uacpv3"

# Start the Express server through the canonical runtime wrapper.
CMD ["npm", "start"]
