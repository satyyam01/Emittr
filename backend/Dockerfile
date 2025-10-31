# Use Node 20 (Vite and newer libs need this)
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Optional: build step (for transpilation, if defined)
RUN npm run build || echo "No build script defined, skipping..."

# Expose backend port (ensure your server uses this port)
EXPOSE 3000

# Start the backend server
CMD ["npm", "start"]
