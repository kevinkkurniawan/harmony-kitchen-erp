# 🚀 Harmony Kitchen ERP - Easy Setup Guide

All database setup files are neatly organized inside the **`database/`** directory.

---

## 1. Start & Import Database (One-Click Command)

### 🐧 Linux / macOS:
```bash
./database/import.sh
```

### 🪟 Windows (Command Prompt / PowerShell):
Double click **`database/import.bat`** or run in terminal:
```cmd
database\import.bat
```

*(Or manual Docker command for any OS:)*
```bash
docker run -d --name postgres-erp -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=harmony_erp -p 5432:5432 postgres:15-alpine
docker exec -i postgres-erp psql -U postgres -d harmony_erp < database/postgres_dump.sql
```

---

## 2. Start Web Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Database Directory (`database/`)

- **`database/import.bat`**: 1-Click setup script for **Windows**.
- **`database/import.sh`**: 1-Click setup script for **Linux / macOS**.
- **`database/postgres_dump.sql`**: Full database dump containing schema + 8,995 inventory items (`m_inventory`), suppliers (`m_supplier`), and promo rules (`m_promo_group`).
