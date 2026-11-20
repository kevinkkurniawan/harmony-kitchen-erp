<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Client review doc
- Client feedback lives in the Google Doc "Clarimity HM":
  https://docs.google.com/document/d/1X9LMSmG_JXEAA2GIZUAxsavoxAQlBsXjLl6wkLzUcRY/edit
- Tabs under "Komplain Kasir": Master Barang, Inventory Stock, Cetak Barcode, Sales Monitoring.
- Black font = still to fix; green font = already fixed. Work through them one tab at a time, in tab order.
- Progress, open questions to the client and verification notes: `docs/client-review-progress.md` (keep it updated).
- Every note is a complaint about the current app: "X tidak keluar" / "tidak tertampil" means X is missing and must be
  shown; "X tidak perlu" means remove X. Read it as a request to fix, not as a description.

# Messages to the client (Luki, WhatsApp group "Harmony Kitchenware x Clarimity Tech")
- Casual lowercase Indonesian; address as "luk", self as "aku"; "klo", "yg", "nya", "ga" are fine.
- Opener like "luk, ijin konfirmasi beberapa point ya," then numbered points when there is more than one question.
- Short questions ending in "kah?", "gitu ya?", "ini bener kah?"; give concrete examples with numbers
  (e.g. "barang 30.000 dipotong 2.000 jadi 28.000 per pcs").
- Ask only what the client must answer; no technical details (tables, code, ids).
- Plain text, no blockquote or box. Acks: "okeoke luk", "okok luk noted, on it thankyou".
