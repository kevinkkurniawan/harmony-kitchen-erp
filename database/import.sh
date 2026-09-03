#!/bin/bash

echo "🚀 Starting PostgreSQL container..."
docker run -d --name postgres-erp -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=harmony_erp -p 5432:5432 postgres:15-alpine

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

echo "📥 Importing database schema & 8,995 inventory items..."
docker exec -i postgres-erp psql -U postgres -d harmony_erp < database/postgres_dump.sql

echo "✅ Database import finished successfully!"
