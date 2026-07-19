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

# Expose the port (Render defaults to 10000 but we can expose 3000)
ENV PORT=3000
EXPOSE 3000

# Start the Express server
CMD ["npm", "start"]
