# Workbench UI Redesign — Blank-Slate Plan

## Goal

Redesign the Workbench UI from scratch, as if it were a new product, while making sure the new design covers every capability the current app has.

**Core principle:** keep *what the app does*, throw away *how it looks*. The only thing that crosses from the old app to the new design is a written capability inventory. No screenshots, CSS, or layouts are carried over.

> Note: `CLAUDE.md` is out of date (it says Quill, but the app uses Tiptap; it doesn't mention share links, RBAC, PWA, prospect journal, bulk actions, or Playwright tests). The inventory must be extracted from the **code**, not from the docs or memory.

---

## Process

### Step 1 — Capability inventory (layout-free)

Extract every entity, action, state, and permission from the code (`js/app.js`, `js/auth.js`, `js/rbac.js`, `js/tiptap.js`, `js/pwa.js`, `sw.js`, `tests/`).

**Rule: no layout vocabulary.** Banned words: sidebar, tab, drawer, modal, popup, ⋯ menu, toolbar, panel, list view, card, header, column.

| ❌ Leaks the old design | ✅ Describes the need |
|---|---|
| "Sidebar tree with collapse arrows" | "User navigates nested folders of any depth, can see where they are, and can jump between distant folders" |
| "⋯ context menu on folders" | "User can rename, move, delete, lock, and share a folder" |
| "Starred tab per folder" | "User can mark items as important and see them together" |

The inventory should cover:
- **Entities** — folders, MoMs, documents, prospect journal entries, users/roles, share links
- **Actions** — create, edit, move, rename, delete, star, lock, share, upload, link, export, bulk operations
- **States** — empty, loading, error, offline, locked, read-only, guest (shared link), syncing/live
- **Roles & permissions** — what each role can see and do
- **Constraints** — mobile, PWA/installable, file size limits, cross-origin downloads

### Step 2 — Rank workflows by how often you use them

Tag each job **daily / weekly / rare** (e.g. write a MoM, find a doc, upload a file, share a folder, lock with a password, move items).

These rankings decide visual hierarchy, so they should drive the new design more than anything else. Daily actions get prominence; rare ones can live a layer deeper.

### Step 3 — Design brief

Write a short brief covering:
- **Personality** — calm/editorial? dense/tool-like? playful?
- **References** — 2–3 apps you like that are *not* this one (e.g. Linear, Notion, Things, Craft)
- **Constraints** — mobile + PWA, light + dark mode, logged-in vs. guest share view, role-based visibility

### Step 4 — Prototype in isolation

- Standalone HTML prototype with **mock data**: no Firebase, doesn't touch `index.html`
- Start with **2–3 divergent directions** for the key screens, pick one, then expand to every screen
- Design every **state**, not just the happy path: empty, loading, error, offline, locked, guest share view, each role, bulk selection, mobile

### Step 5 — Coverage audit

Go through the Step 1 inventory line by line against the prototype. Anything without a home is a design gap to solve, not something to quietly squeeze in.

### Step 6 — Rebuild on a branch

- **Branch:** work on a `redesign` branch, **not `main`**. The auto-push rule deploys every commit to production through Vercel, so a half-finished redesign would go live. Use Vercel preview URLs for review. This is a deliberate exception to the CLAUDE.md auto-push rule.
- **CSS:** new CSS from scratch, starting with design tokens (color, type, spacing, radius, elevation, motion)
- **Logic:** keep the Firebase, Cloudinary, auth, and RBAC logic, and replace the rendering. `app.js` likely mixes data logic with HTML building, so first separate the two.
- **Tests:** treat the Playwright tests as the behaviour contract. Keep stable `data-testid` hooks so they keep passing, or update the tests on purpose. Never update them by accident.

---

## Keeping the old design out

Some influence will always remain because the features themselves don't change. That influence is fine because it comes from what the app does. Influence from how it currently looks is what we want to avoid.

| Where it leaks in | Why | Fix |
|---|---|---|
| **The AI reading the code** | Code contains markup, class names (`.sidebar`, `.ctx-menu`), and screen order | Agent A writes the inventory under strict "no layout words" rules. Design is done by **Agent B in a fresh session with no repo access**, given only the inventory and brief |
| **Your own memory** | Daily use makes the current layout feel "natural" | Don't open the app while designing. When a design looks familiar, ask whether it's there because of a real need or out of habit |
| **Wording in the inventory** | "Tab" or "⋯ menu" quietly brings the old layout back | Scan the inventory for layout words before handing it off |
| **The data model** | Nested folders and the MoM/doc split shape the design | Acceptable, since it's what the app *is*. Still worth questioning (e.g. should docs and MoMs really be separate?) |

### Agent setup

1. **Agent A** (has repo access) → produces the layout-free capability inventory
2. **You** → check it for layout words and add usage frequency (Step 2) and the brief (Step 3)
3. **Agent B** (no repo access, only inventory + brief) → designs from scratch, starting with 2–3 divergent directions
4. **Back in the repo** → the chosen design is wired to the existing logic on the `redesign` branch

---

## Checklist

- [ ] Step 1: Capability inventory extracted from code (Agent A)
- [ ] Inventory scanned for layout vocabulary
- [ ] Step 2: Workflows ranked daily / weekly / rare
- [ ] Step 3: Design brief written
- [ ] Step 4: 2–3 divergent directions explored (Agent B)
- [ ] Direction chosen; all screens and states prototyped
- [ ] Step 5: Coverage audit passed
- [ ] Step 6: `redesign` branch created; tokens + new CSS
- [ ] Data logic separated from rendering in `app.js`
- [ ] New UI wired to existing logic
- [ ] Playwright tests passing
- [ ] Merged to `main`
