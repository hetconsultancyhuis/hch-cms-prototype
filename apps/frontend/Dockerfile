# =========================
# Build stage
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package*.json ./

# Copy frontend package definition
COPY apps/frontend/package.json apps/frontend/

# Install dependencies
RUN npm install

# Copy entire repo
COPY . .

# Build frontend workspace
RUN npm run build --workspace=frontend


# =========================
# Production stage
# =========================
FROM nginx:alpine

# Copy built frontend
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]