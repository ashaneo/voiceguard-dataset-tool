#!/bin/bash
set -e

echo "→ Pulling latest code..."
git pull origin main

echo "→ Building React frontend..."
docker run --rm \
  -v "$(pwd)/frontend":/app \
  -w /app node:20-alpine \
  sh -c "npm install && npm run build"

echo "→ Restarting services..."
docker compose up -d --build

echo "✓ Deploy complete"
