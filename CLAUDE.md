# Workbench App — Claude Code Instructions

## Auto-push rule
After EVERY change, automatically run:
```
git add .
git commit -m "<short description of what changed>"
git push
```
Do not wait for me to ask. Every change = immediate push to GitHub. Vercel auto-deploys from there.

## Project structure
- `index.html` — HTML + CSS + script tags only (~318 lines)
- `js/app.js` — all app logic (~884 lines)
- `js/auth.js` — Firebase Auth + login screen (added separately)
- `js/rbac.js` — role-based access control (added separately)

No framework, no build step, no node_modules.

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

### 1. Edit specific files, not full rewrites
- Edit `js/app.js` directly for app logic changes (use Edit tool, not full rewrite)
- Edit `index.html` directly for HTML/CSS changes
- New features go in new files under `js/` and get a `<script src>` tag in index.html
- Full rewrites are no longer needed or safe

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
- `G_signin_email` — the email a sign-in link was asked for (removed once signed in)
- `G_signin_stay` — `0` when "Stay signed in on this device" was off for that link (removed once signed in)

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

## UI redesign (in progress)
- The plan is in `ui-redesign-plan.md`. The design happens in a separate studio folder (`../workspace-studio`, branch `design-studio`) that never sees this codebase.
- Never read from the studio folder, and never send anything from this codebase into it.
- When the owner says **"Import the approved design"**: run `redesign/studio.sh import`, confirm `redesign/design/` arrived (design guide, tokens, prototype, coverage, decisions), tick Step 5b in the plan's checklist, and then offer to start Step 6 (the implementation plan).

## UI rebuild (Step 7, in progress)
Parts of this file describe the old app and are out of date (for example, the editor is Tiptap, not Quill). For rebuild work, the plan and the design win.

- **The route:** `redesign/ui-implementation-plan.md` (approved 2026-10-13). **The spec:** `redesign/design/` (design guide v1.0, tokens, prototype). The prototype is the reference rendering; the old app is never a reference.
- **Branch:** all rebuild work happens on the `redesign` branch. At the start of a rebuild session, run `git switch redesign`, and `git merge main` if `main` has moved. The auto-push rule then pushes to `redesign`, which deploys a Vercel preview, never production. Never merge `redesign` into `main` until Phase 8 is done and the owner says so.
- **One task per session.** Read only what the task needs: its plan sections, the design-guide section, and the matching prototype file and function. Only read `js/app.js`, `js/auth.js`, `js/rbac.js` or `css/styles.css` when the task's plan row names them (Phase 1 moves code out of them; later phases replace them).
- **Model check:** plan §7.0 names the model and effort for each task. If the current model is a lower tier than the task needs, say so before starting and suggest switching.
- **Never copy from the old UI:** no markup, CSS, class names, element ids or wording from the old files go into new files. New code follows the plan's §2.3–2.4.
- **Design gaps:** if the prototype and design guide don't answer something, stop and add it to the plan's §9.1 as a need. Don't fill it from the old app. Never send anything to the studio folder; the owner carries needs over.
- **Before each commit:** `node -c` on changed JS files, the relevant Playwright tests, and (once it exists) the old-names check from plan §10.
- **Track progress:** tick the plan's §5 and §10 rows as they're done, and the phase checkboxes in `ui-redesign-plan.md`.
- Don't save memories that describe the old UI.
