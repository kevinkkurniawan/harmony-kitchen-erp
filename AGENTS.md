<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Client review doc
- Client feedback lives in the Google Doc "Clarimity HM":
  https://docs.google.com/document/d/1X9LMSmG_JXEAA2GIZUAxsavoxAQlBsXjLl6wkLzUcRY/edit
- Tabs: Primary, Komplain Kasir (the POS app, repo `harmony-kitchen-pos`), Master Barang, Inventory Stock,
  Stock Opname, Cetak Barcode, Sales Monitoring.
- Black font = still to fix; green font = already fixed. Work through them one tab at a time, in tab order.
- Read a tab as text with images via `.../mobilebasic?tab=<tab id>` (span colors show black / green).
- Once a point is fixed AND live: edit the doc yourself (Chrome, edit view). Under the point add a bold
  "Note: ..." line in plain Indonesian that Luki (non-technical) understands: what changed, and when something was
  removed, what it was for. Then turn the point and its note green (Docs palette "dark green 1", rgb(56,118,29)).
  In a numbered-list tab use Shift+Enter for the note line. Don't jump with Ctrl+F (the query was once typed into
  the doc). Re-read the tab via `/mobilebasic` afterwards: a click can land one letter early.
- "Seperti program lama": answer it from the old app before asking Luki; ask him only what the old app / data
  can't answer. Old sources (on the original dev PC only): POS `~/git/POS/pos_decompiled.cs`; ERP
  `~/git/Module Manager/*.dll` (decompile with `DOTNET_ROOT=~/git/POS/dotnet ~/.dotnet/tools/ilspycmd`);
  stored procedures in `~/git/Module Manager/database_backup/HM_241115.bak` (`strings -n 4 ... | awk ...`).
- Progress, open questions to the client and verification notes: `docs/client-review-progress.md` (keep it updated).
- Every note is a complaint about the current app: "X tidak keluar" / "tidak tertampil" means X is missing and must be
  shown; "X tidak perlu" means remove X. Read it as a request to fix, not as a description.

# Testing and deploy
- Never run e2e / API tests against the Supabase DB in `.env` (live data; `tests/user-access.spec.ts` once left
  Admin test users there). Use a local Postgres: docker `postgres-erp`, db `harmony_local` (ERP) /
  `harmony_pos_local` (POS), schema via `prisma db push`, a few rows seeded; start the app with
  `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/<db> npx next dev -p <port>`. Read-only queries on
  live to pick sample data are fine.
- A push to `main` auto-deploys to Vercel Production: ERP https://harmonykitchenerp.vercel.app, POS
  https://harmonykitchenpos.vercel.app. Check `gh api repos/kevinkkurniawan/<repo>/commits/<sha>/status`.
- Stock changes (opname / sync / reset) are for the login `admin` (Luki) only; other Admins (e.g. Siti, User Type
  Admin) keep every other right. See `src/lib/owner.ts`.

# Messages to the client (Luki, WhatsApp group "Harmony Kitchenware x Clarimity Tech")
- Casual lowercase Indonesian; address as "luk", self as "aku"; "klo", "yg", "nya", "ga" are fine.
- Opener like "luk, ijin konfirmasi beberapa point ya," then numbered points when there is more than one question.
- Short questions ending in "kah?", "gitu ya?", "ini bener kah?"; give concrete examples with numbers
  (e.g. "barang 30.000 dipotong 2.000 jadi 28.000 per pcs").
- Ask only what the client must answer; no technical details (tables, code, ids).
- Plain text, no blockquote or box. Acks: "okeoke luk", "okok luk noted, on it thankyou".
