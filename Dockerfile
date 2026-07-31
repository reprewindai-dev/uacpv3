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

# Expose the Golden Bible GPC frontend port used by Coolify/Traefik.
ENV PORT=3012
ENV NODE_ENV=production
EXPOSE 3012

LABEL org.opencontainers.image.source="uacpv3"
LABEL org.opencontainers.image.revision="d54955caeaadd6663f8080b956d2aa6bea9e95c4"

# Start the Express server
CMD ["npm", "start"]
