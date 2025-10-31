# Use Node.js base image
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source files
COPY . .

# Build if script exists
RUN npm run build || echo "No build script"

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
