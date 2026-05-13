FROM node:22-slim

# better-sqlite3 native build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Copy backend package definition
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN npm install

# Copy full repo
COPY . .

# Move into backend workspace
WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["npm", "start"]