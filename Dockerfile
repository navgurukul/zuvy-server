# # syntax=docker/dockerfile:1
FROM node:20.10.0-alpine
# Set the working directory in the container
WORKDIR /app
# Copy package.json and package-lock.json to the container
COPY package*.json ./
# Install dependencies
RUN npm install
# Copy the rest of the application code to the container
COPY . .
# Expose the port the app runs on
EXPOSE 5000
# Command to run the application
CMD ["npm", "run", "start"]
