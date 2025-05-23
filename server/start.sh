#!/bin/sh

# Start the backend server in the background
node /app/backend/index.js &

# Start Nginx in the foreground
nginx -g 'daemon off;'