FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application for production
RUN npm run build

# Install serve to serve the production build
RUN npm install -g serve

EXPOSE 3000

# Serve the production build with SPA support (handles React Router)
CMD ["serve", "-s", "build", "-l", "3000", "--single"]