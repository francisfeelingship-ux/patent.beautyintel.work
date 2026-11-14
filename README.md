# Patent Library (D1-backed Demonstration)

This repository hosts the code and static assets for the public demonstration version of the Patent Library, deployed at:

**[patents.beautyintel.work](https://patents.beautyintel.work)**

## Purpose of the Public Demo
The demo provides a lightweight Patent Library interface. Static assets are served by a Cloudflare Worker, while `/api/*` routes query the separate `patent_library_lite` D1 database.

> [!IMPORTANT]
> **Data Security Boundary:**
> The D1 demo is separate from the local Patent Librarian database, but it exposes data from its own database through public API routes. Review database contents and configure Cloudflare Access before sharing proprietary demo data. A `Cache-Control` response header alone does not remove D1 query costs.

## D1 analytics snapshot cache (2026-11)

The homepage calls `/api/analytics`. Previously every request performed full-table `COUNT(*)` and `GROUP BY` queries. With approximately 250,000 rows in some tables, only a handful of page loads could exhaust D1's free 5-million-rows-read daily quota.

**Required deployment order:**

1. Apply the schema migration to the existing remote D1 database (it creates one new empty cache table and does not touch patent records):

   ```bash
   npx wrangler d1 execute patent_library_lite --remote --file=migrations/0001_create_analytics_snapshots.sql
   ```

2. Build and deploy the Worker:

   ```bash
   npm ci
   npm run build
   npx wrangler deploy
   ```

3. The **first** successful request for `/api/analytics` computes the aggregates once and stores JSON in `analytics_snapshots`. Later requests fetch just that indexed cache row, shared across regions. The `X-Analytics-Source` header is `generated` for the initial query and `snapshot` for later requests. Run the first load while enough D1 allowance remains, ideally just after the UTC reset.

4. Whenever the D1 data is refreshed, bump `ANALYTICS_DATA_VERSION` in `src/worker.ts` to intentionally regenerate statistics. Company-filtered variants are cached separately.

If the migration has not been applied, `/api/analytics` fails safely instead of silently repeating an expensive full-table query. When enabling Cloudflare Access, protect both `patents.beautyintel.work` and its `*.workers.dev` alternative to avoid an authentication bypass.

---

## Local Development

### Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Installation
Install the project dependencies locally:
```bash
npm install
```

### 2. Run Development Server
Start the local Vite development server:
```bash
npm run dev
```
Open the provided URL (typically `http://localhost:5173`) in your browser to inspect the application.

---

## Production Build

To compile and bundle the static application for deployment:
```bash
npm run build
```
Vite will compile the TypeScript code and compile all files into the `dist/` directory.

---

## Cloudflare Pages Configuration

This project is designed to be hosted directly as a static site on **Cloudflare Pages**. When linking your GitHub repository, apply the following build settings:

- **Framework Preset**: None (or Vite)
- **Production Branch**: `main`
- **Build Command**: `npm run build`
- **Build Output Directory**: `dist`
- **Root Directory**: `/` (repository root)

### Single-Page Application (SPA) Fallback
Cloudflare Pages uses `public/_redirects` to route all direct URL refreshes or deep client-side routes back to `index.html` via the rule:
```text
/* /index.html 200
```
This file is committed in `public/_redirects` and is copied to the `dist` directory during compilation.

---

## Guide: Adding Another Featured Family

To add a new featured patent family to the demo dashboard:

1. **Create the Family JSON File**:
   Create a new JSON file under `public/data/families/` (e.g., `family-004.json`) using the following schema:
   ```json
   {
     "familyPublicId": "DEMO-FAMILY-004",
     "displayName": "Descriptive technology title",
     "company": "Company Name",
     "priorityYear": 2022,
     "summary": "Short manually-reviewed technology description.",
     "representative": {
       "publicationNumber": "DEMO-PATENT-004",
       "title": "Representative Patent Title"
     },
     "jurisdictions": ["US", "EP"],
     "members": [
       {
         "publicationNumber": "DEMO-PATENT-004",
         "title": "Representative Patent Title",
         "jurisdiction": "US",
         "kind": "grant",
         "type": "core"
       }
     ],
     "nodes": [
       {"id": "DEMO-PATENT-004", "label": "DEMO-PATENT-004", "type": "core", "is_representative": true, "country": "US", "title": "Representative Patent Title", "assignee": "Company Name"}
     ],
     "edges": []
   }
   ```
2. **Update the Index File**:
   Add the family summary block to `public/data/families/index.json`:
   ```json
   {
     "familyPublicId": "DEMO-FAMILY-004",
     "displayName": "Descriptive technology title",
     "company": "Company Name",
     "priorityYear": 2022,
     "familySize": 1,
     "jurisdictionCount": 1,
     "representative": {
       "publicationNumber": "DEMO-PATENT-004",
       "title": "Representative Patent Title"
     }
   }
   ```
3. **Local Validation**:
   Start the development server (`npm run dev`) and click on the new family in the list to verify that the D3 force graph and equivalent details render correctly without console warnings.
4. **Compile Before Committing**:
   Verify compilation passes (`npm run build`) before pushing your commits to the remote.

---

## ⚠️ Security Warning: Data That Must Never Be Committed

To maintain compliance and protect proprietary assets, **never** commit or push the following file patterns to this public repository:

- Local databases (`*.sqlite`, `*.sqlite3`, `*.db`)
- SQLite journal files (`*.db-wal`, `*.db-shm`, `*.db-journal`)
- Raw EPO, USPTO, or Google Patents JSON payloads
- Data exports (`*.jsonl`, `*.parquet`, `*.npy`, `*.npz`, `*.faiss`, `*.index`)
- Environmental files (`.env`, `.env.local`)
- Streamlit secrets (`secrets.toml`)
- Internal audit reports or pipeline results
- Absolute local paths on Windows or Unix
