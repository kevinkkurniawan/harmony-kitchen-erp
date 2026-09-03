@echo off
echo ===================================================
echo 🚀 Starting PostgreSQL container for Harmony ERP...
echo ===================================================

docker run -d --name postgres-erp -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=harmony_erp -p 5432:5432 postgres:15-alpine

echo.
echo ⏳ Waiting 5 seconds for PostgreSQL to start up...
timeout /t 5 /nobreak > NUL

echo.
echo 📥 Importing database schema and 8,995 inventory items...
docker exec -i postgres-erp psql -U postgres -d harmony_erp < database\postgres_dump.sql

echo.
echo ===================================================
echo ✅ Database import completed successfully!
echo ===================================================
pause
