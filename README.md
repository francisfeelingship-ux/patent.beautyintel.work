# Patent Library (Static Public Demonstration)

This repository hosts the code and static assets for the public demonstration version of the Patent Library, deployed at:

**[patent.beautyintel.work](https://patent.beautyintel.work)**

## Purpose of the Public Demo
The public demo provides a lightweight, client-side, static evaluation platform to preview the interface, visualizations, and capability workflows of the Patent Library without exposing production data systems, search databases, or executing live agent routines.

> [!IMPORTANT]
> **Data Security Boundary:**
> This demonstration environment is completely disconnected from the local 35 GB Patent Librarian database. It runs entirely on static JSON files placed in the `public/data/` directory. 
> It contains no actual claim texts, abstracts, description details, semantic vector embeddings, audit trails, or private customer records.

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
