# Workbench UI Redesign — Blank-Slate Plan

## Goal

Redesign the Workbench UI from scratch, as if it were a brand-new product nobody has seen, while making sure the new design covers every capability the current app has.

**Core principle:** keep *what the app does*, throw away *how it looks*. The only thing that crosses from the old app to the new design is a written, layout-free list of user needs. No screenshots, CSS, markup, class names, colors, fonts, icons, terminology from the UI, or screen order are carried over.

**The firewall:** the person or agent who sees the old app never designs, and the one who designs never sees the old app.

> Note: `CLAUDE.md` is out of date (it says Quill, but the app uses Tiptap; it doesn't mention share links, RBAC, PWA, prospect journal, bulk actions, or Playwright tests). The inventory must be extracted from the **code**, not from the docs or memory.

---

## The firewall: what crosses and what doesn't

### Allowed into the design session (the handoff package)
Only these files, copied into an **empty folder outside the repo**:

1. `inventory.md` — user needs, written as job stories (Step 1)
2. `priorities.md` — how often each job happens (Step 2)
3. `brief.md` — personality, outside references, constraints (Step 3)

### Never allowed into the design session
- The repo, or any session started inside it (it auto-loads `CLAUDE.md`, which describes the old UI)
- `CLAUDE.md`, `AGENTS.md`, `index.html`, `css/`, `js/`, `tests/`
- Screenshots, screen recordings, or descriptions of the current app
- `brand-proposal/`, `favicon.svg`, the Dock icon, current colors or fonts (unless deliberately kept, see Step 3)
- Class names, element IDs, `data-testid`s, Firestore field names
- Phrases like "like the current one but…" or "improve the existing…"

---

## Process

### Step 1 — Capability inventory (Agent A, has repo access)

Agent A reads the code (`js/app.js`, `js/auth.js`, `js/rbac.js`, `js/tiptap.js`, `js/pwa.js`, `sw.js`, `tests/`) and writes `inventory.md`.

**Rule 1: no layout vocabulary.** Banned words: sidebar, tab, drawer, modal, popup, dialog, menu, ⋯, toolbar, panel, pane, list, grid, card, header, footer, column, row, button, icon, badge, toggle, dropdown, arrow, tree, page, screen, view, left, right, top, bottom.

**Rule 2: no UI terminology.** Describe the need, not the current label. "Starred" → "mark items as important". "Lock" → "restrict access with a password". Keep only real domain words the user would say out loud (e.g. "MoM", "minutes of meeting", "prospect").

**Rule 3: group by user jobs, not by current screens.** Ordering it "folders section → MoM section → docs section" repeats the current structure. Use job groups instead, such as:
- Capture (write notes, record meetings, add files and links)
- Find (search, browse, recall recent or important things)
- Organise (nest, move, rename, bulk-act)
- Share & control access (share links, passwords, roles)
- Work anywhere (mobile, installable, offline, live sync)

**Rule 4: write each need as a job story.**
> When I ___, I want to ___, so that ___.

| ❌ Leaks the old design | ✅ Job story |
|---|---|
| "Sidebar tree with collapse arrows" | "When I have many nested projects, I want to move between any of them quickly and always know where I am, so that I don't lose context." |
| "⋯ context menu on folders" | "When a project changes, I want to rename, relocate, restrict, or share it, so that the structure stays accurate." |
| "Starred tab per folder" | "When something matters a lot, I want to flag it and find all flagged things together, so that I can get back to them fast." |

The inventory must also list, in neutral language:
- **States** — nothing yet, loading, failure, no connection, restricted by password, read-only, visiting via a shared link, live-synced
- **Roles & permissions** — what each kind of user can see and do
- **Hard constraints** — works on phones, installable, file size limits, rich text editing, export to PDF

### Step 1b — Sanitisation pass (you, plus a fresh agent)

1. Search `inventory.md` for every banned word from Rule 1. Rewrite any hit.
2. A **fresh agent that has never seen the repo** reads the inventory and is asked: *"Describe what you imagine this app's current layout looks like."* If it can guess the current layout, something leaked. Find it and rewrite it.

### Step 2 — Priorities (you)

Tag every job story **daily / weekly / rare** in `priorities.md`. Do this from memory of *what you do*, not by opening the app.

These rankings decide visual hierarchy and should drive the design more than anything else.

### Step 3 — Design brief (you)

Write `brief.md`:
- **Personality** — calm/editorial? dense/tool-like? playful? warm or clinical?
- **References** — 2–3 apps you admire that are *not* this one (e.g. Linear, Notion, Things, Craft, Arc)
- **Constraints** — phone + desktop, installable, light + dark mode, signed-in vs. visiting-via-link, role-based visibility
- **Branding decision** — default for maximum blank slate: **name, logo, and colors are all open**. If you decide to keep something (e.g. the name "Workbench"), write only that word in the brief. Never pass the existing logo files or palette.
- **Permission to challenge the model** — the designer may propose merging, splitting, or removing concepts (e.g. "should notes and files really be separate things?", "are folders the right structure?"). Proposals get flagged for your decision; they are not silently adopted.

### Step 4 — Design from zero (Agent B, no repo access)

- Run in a **new claude.ai chat or Claude Code started in an empty folder**, never a subagent spawned from this repo
- Give it only the handoff package (inventory, priorities, brief)
- First produce **3 deliberately divergent directions** (e.g. different navigation models, densities, and personalities), each as a standalone HTML prototype with mock data
- Pick one direction, then expand it to every job story and every state: nothing yet, loading, failure, no connection, password-restricted, read-only role, shared-link visitor, bulk selection, phone + desktop, light + dark
- Agent B also produces a small **design system**: tokens (color, type, spacing, radius, elevation, motion) and core components

**Mid-design rule:** if you catch yourself saying "the current app does it like X", stop. Translate it into a need ("I need to get to X in one step from anywhere") and give the designer the need, not X.

### Step 5 — Coverage audit

Go through `inventory.md` line by line against the prototype. Every job story and every state must have a home. Anything missing is a design gap to send back to Agent B as a *need*, not solved by borrowing from the old UI.

### Step 6 — Rebuild (on a `redesign` branch)

The rebuild is where old design most often creeps back, because the implementer sees the old code. Guard rails:

- **Branch:** work on a `redesign` branch, **not `main`**. The auto-push rule deploys every commit to production through Vercel. Use Vercel preview URLs for review. This is a deliberate exception to the CLAUDE.md auto-push rule.
- **Source of truth:** the prototype is the spec. Compare the build against the prototype, never against the old app.
- **Delete, don't modify:** remove the old CSS entirely and start from the new tokens. Write new markup; don't rename or restyle old elements. Don't reuse old class names.
- **Keep only the plumbing:** reuse Firebase, Cloudinary, auth, RBAC, PWA, and data logic. Separate data logic from the HTML-building code in `app.js` first, then throw away the rendering half.
- **Tests follow the design, not the other way round:** the Playwright tests are a checklist of *behaviours* to preserve. Rewrite their steps and selectors to fit the new design. Never bend the new design to fit an old test.
- **No "quick fixes" from the old UI:** if something in the prototype is unclear, ask the designer (Agent B) for an answer rather than falling back to how the old app did it.
- **After merge:** update `CLAUDE.md` so future sessions describe the new UI, not the old one.

---

## Where old design can still leak in

| Leak | Why | Guard |
|---|---|---|
| **AI reading the code** | Markup, class names, screen order | Agent A only writes needs; Agent B never sees the repo |
| **`CLAUDE.md` auto-loading** | Any session in this repo loads it, and it describes the old UI | Agent B runs outside the repo |
| **Inventory wording** | "Tab", "menu", "Starred" bring the layout back | Banned-word rules + sanitisation pass + "guess the layout" test |
| **Inventory structure** | Grouping by current screens recreates them | Group by user jobs |
| **Your memory** | Daily use makes the current layout feel natural | Don't open the app during Steps 2–5; translate habits into needs |
| **Branding** | Logo and palette constrain the visual direction | Open by default; only names passed if kept |
| **The data model** | Folder nesting and notes-vs-files split shape the design | Designer may challenge it; you decide |
| **The rebuild** | Implementer sees old code and reaches for it | Prototype is the spec; delete old CSS; new markup; ask the designer |
| **Tests** | Old tests encode old flows | Tests preserve behaviour only; rewrite steps to fit the new design |

The only influence that should remain is the feature set itself, which the new design has to cover anyway.

---

## Checklist

**Discovery (sees old app)**
- [ ] Step 1: `inventory.md` written as job stories, grouped by jobs (Agent A)
- [ ] Step 1b: banned-word scan clean
- [ ] Step 1b: fresh agent can't guess the current layout

**Brief (you, without opening the app)**
- [ ] Step 2: `priorities.md`, every job tagged daily / weekly / rare
- [ ] Step 3: `brief.md` written, including the branding decision
- [ ] Handoff package copied to an empty folder outside the repo

**Design (never sees old app)**
- [ ] Step 4: 3 divergent directions prototyped (Agent B)
- [ ] Direction chosen; all job stories and states prototyped
- [ ] Design tokens + core components defined
- [ ] Step 5: coverage audit passed; gaps sent back as needs

**Rebuild**
- [ ] Step 6: `redesign` branch created
- [ ] Old CSS deleted; new tokens + CSS written
- [ ] Data logic separated from rendering in `app.js`; old rendering removed
- [ ] New UI wired to existing logic, matching the prototype
- [ ] Playwright tests rewritten for the new design and passing
- [ ] Merged to `main`; `CLAUDE.md` updated to describe the new UI
