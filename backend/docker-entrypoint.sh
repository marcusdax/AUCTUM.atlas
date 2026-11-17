#!/bin/sh
set -e

echo "🔄 Running Prisma DB push..."
npx prisma db push --skip-generate 2>&1 || echo "⚠️  prisma db push failed, continuing..."

echo "🚀 Starting RoofPro CRM API..."
npx tsx dist/src/server.js
