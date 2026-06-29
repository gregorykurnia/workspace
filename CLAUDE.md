# Greg's Workspace App — Claude Code Instructions

## Auto-push rule
After EVERY change, automatically run:
```
git add .
git commit -m "<short description of what changed>"
git push
```
Do not wait for me to ask. Every change = immediate push to GitHub. Vercel auto-deploys from there.

## Project structure
Single file: `index.html` — this is the entire app. No framework, no build step, no node_modules.

## Tech stack
- Pure HTML/CSS/JS — single file
- Firebase Firestore (compat SDK v9) — all data, real-time sync
- Cloudinary — file/image uploads
- Quill.js 1.3.7 (loaded from CDN) — rich text editor in MoM
- Hosted on Vercel via GitHub auto-deploy

## Firebase config
- Project: greg-project-5b838
- Collections: folders, moms, docs
- Uses Firebase COMPAT SDK (`firebase-app-compat.js` + `firebase-firestore-compat.js`)
- NOT the modular/ES module SDK — do not use `import { } from` Firebase URLs

## Cloudinary config
- Cloud name: dgznvawnm
- Upload preset: workspace_uploads (Unsigned)
- Upload routing: images → /image/upload, videos → /video/upload, everything else → /raw/upload

## Data structure (Firestore)
```
folders — { id, name, icon, parent, created, pw }
moms    — { id, folderId, title, date, content (Quill Delta JSON string), tags, starred, gdoc, pw }
docs    — { id, folderId, name, type, url, cloudType, format, note, added, starred, pw, uploaded }
```

## CRITICAL rules — read before touching anything

### 1. Always full rewrite, never patch
When making changes, rewrite the entire `index.html` from scratch incorporating the change.
Patching with sed/string replacement causes JS syntax errors from quote escaping.

### 2. Use addEventListener only
The script uses `type="module"` pattern (now compat but same rule applies).
NEVER use inline `onclick="..."` in HTML strings built with JS.
Always use `addEventListener` after inserting HTML.

### 3. Quill is module-scoped
`_quill` is a module-scoped variable. Quill loads from CDN after the script tag.
Do not try to access Quill from outside the script block.

### 4. localStorage keys
- `G_exp` — expanded folder IDs (JSON array)
- `G_mp` — master PIN hash (removed, do not re-add)

### 5. Passwords
Stored as SHA-256 hashes. `hw(pw)` is the hash function.

### 6. MoM content
Stored as Quill Delta JSON string in Firestore.

### 7. MoM links
Inserted as `https://mom.local/{momId}` — intercepted on click, never actually navigates to that URL.

## Features already built
- Infinite folder nesting + emoji icons
- ⋯ context menu on folders
- MoM rich text editor (Quill) — bold, italic, headings, colors, checklists, links
- MoM Google Doc link field
- MoM export PDF
- MoM search + sort
- Insert doc links into MoM (multi-select popup)
- Insert MoM links into MoM (navigates to linked MoM on click)
- ⭐ Star MoMs + docs
- Starred tab per folder
- Document upload (Cloudinary) — PNG, PDF, images all working
- Document add link
- Document search + sort
- Rename / download / move documents
- Move MoM/doc (full folder tree picker)
- Image lightbox
- Password lock on folders + docs
- Firebase realtime sync (● Live indicator)
- Sidebar hide/show toggle (☰)
- Folder arrow collapse/expand (independent from folder navigation)
- Mobile responsive (sidebar drawer, overlay, media queries ≤700px)

## Known issues
- PDFs >10MB fail on Cloudinary free plan — workaround: use Add Link with Google Drive URL
- Download attribute doesn't work cross-origin — app uses blob fetch with fallback to new tab
