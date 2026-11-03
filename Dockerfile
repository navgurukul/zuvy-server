# # syntax=docker/dockerfile:1
FROM mirror.gcr.io/library/node:20-alpine
# ffmpeg/ffprobe are required by the recording worker to merge multi-segment
# Zoom recordings (recording-worker.service.ts mergeRecording()) — node:20-alpine
# doesn't ship them, so every multi-segment meeting failed merge with
# "spawnSync ffmpeg ENOENT" until every retry was exhausted.
RUN apk add --no-cache ffmpeg
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
