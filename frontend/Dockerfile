# ============================================
# Frontend Dockerfile
# Context: ./frontend (has its own package.json)
# ============================================

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite with host flag for Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]