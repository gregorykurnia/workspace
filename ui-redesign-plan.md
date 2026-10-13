# Workbench UI Redesign — Blank-Slate Plan

## Goal

Redesign the Workbench UI from scratch, as if it were a brand-new product nobody has seen, while making sure the new design covers every capability the current app has.

**Core principle:** keep *what the app does*, throw away *how it looks*. The only thing that crosses from the old app to the new design is a written, layout-free list of user needs. No screenshots, CSS, markup, class names, colors, fonts, icons, terminology from the UI, or screen order are carried over.

**The firewall:** the person or agent who sees the old app never designs, and the one who designs never sees the old app.

> Note: `CLAUDE.md` is out of date (it says Quill, but the app uses Tiptap; it doesn't mention share links, RBAC, PWA, prospect journal, bulk actions, or Playwright tests). The inventory must be extracted from the **code**, not from the docs or memory.

---

## The firewall: what crosses and what doesn't

Design happens in **this same folder and Claude Code**, but on a separate **`design-studio` branch**. It's an *orphan* branch: it shares no history with `main`, and the old app's files aren't on it. When you switch to it, the old code disappears from disk.

| | `main` (the codebase) | `design-studio` (the design environment) |
|---|---|---|
| Old app code, tests, brand assets | ✅ | ❌ not on disk |
| `CLAUDE.md` | Describes the old app | Studio-only rules: designer role, firewall, process, deliverables |
| `.claude/settings.json` | (none) | Deny rules that block reading old files, git history, other branches, transcripts, the GitHub repo, and the live site |
| Git history shown to new sessions | Old commits | Studio commits only |
| `redesign/handoff/` | Where the handoff package is written | Synced copy (read-only input) |
| `redesign/design/` | Imported after approval (Step 5b) | Where the designer works |

Switching: `redesign/studio.sh enter` (from `main`) and `git switch main` (to leave).

### Allowed into the design session (the handoff package, `redesign/handoff/`)
1. `inventory.md`: user needs, written as job stories (Step 1)
2. `priorities.md`: how often each job happens (Step 2)
3. `brief.md`: who, personality, outside references, branding (Step 3)

### Never allowed into the design session
- The `main` branch, or any session that has been on it. Always start a **brand-new** Claude Code session in the studio, never `--continue` or `--resume`.
- `CLAUDE.md` (main version), `AGENTS.md`, `index.html`, `css/`, `js/`, `tests/`, this plan, `redesign/inventory-notes.md`
- Screenshots, screen recordings, or descriptions of the current app
- `brand-proposal/`, `favicon.svg`, the Dock icon, current colours or fonts (unless deliberately kept, see Step 3)
- Class names, element IDs, `data-testid`s, Firestore field names
- Phrases like "like the current one but…" or "improve the existing…"
- Memories about the old UI: Claude Code's memory folder is shared by both branches, so **sessions on `main` must not save memories describing the current UI**

---

## Process

### Step 1 — Capability inventory (Agent A, has repo access)

Agent A reads the code (`js/app.js`, `js/auth.js`, `js/rbac.js`, `js/tiptap.js`, `js/pwa.js`, `sw.js`, `tests/`) and writes `redesign/handoff/inventory.md`. Anything that references code or current behaviour goes into the owner-only `redesign/inventory-notes.md`, which never leaves `main`.

✅ **Done.** A second leak review rewrote the stories that still implied the current layout (F3–F7, F9, O1, O7, O8, P2, P3, W8, A1, A2, A6). The removed details are logged in `inventory-notes.md` §7 for Agent C.

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

1. Search `inventory.md` for every banned word from Rule 1. Rewrite any hit. ✅ Done (clean).
2. **Guess-the-layout test.** Run `redesign/studio.sh enter`, quit Claude Code, start a new `claude` session, and send:
   > Read only `redesign/handoff/inventory.md`. Don't design anything. Describe, as specifically as you can, what you imagine the *current* version of this app's layout looks like.

   Then `/exit` that session (never reuse it for design) and run `git switch main`. Compare its guess with the real app. If it describes the real layout, something leaked: rewrite that story on `main`.

### Step 2 — Priorities (you)

First, decide the open questions in `redesign/inventory-notes.md` §4 (placeholders) and §5 (bugs and unclear intent). Add any newly confirmed needs to `inventory.md` as job stories, written by the same rules.

Then fill in the Frequency column in `redesign/handoff/priorities.md`: **daily / weekly / rare / drop** for every job story. Do this from memory of *what you do*, not by opening the app. When finished, set its status line to `FILLED`.

These rankings decide visual hierarchy and should drive the design more than anything else.

### Step 3 — Design brief (you)

Fill in `redesign/handoff/brief.md` and set its status line to `FILLED`. It covers:
- **Who uses it** — people, roles, devices, context
- **Language** — which language(s) the interface uses
- **Personality** — calm/editorial? dense/tool-like? playful? warm or clinical?
- **References** — 2–3 apps you admire that are *not* this one (e.g. Linear, Notion, Things, Craft, Arc)
- **Constraints** — phone + desktop, installable, light + dark mode, signed-in vs. visiting-via-link, role-based visibility
- **Branding decision** — default for maximum blank slate: **name, logo, and colors are all open**. If you decide to keep something (e.g. the name "Workbench"), write only that word in the brief. Never pass the existing logo files or palette.
- **Permission to challenge the model** — the designer may propose merging, splitting, or removing concepts (e.g. "should notes and files really be separate things?", "are folders the right structure?"). Proposals get flagged for your decision; they are not silently adopted.

### Step 4 — Design from zero (Agent B, in the design studio)

**Starting a design session:**
1. On `main`, with everything committed, run `redesign/studio.sh enter`. It switches to `design-studio` and syncs `redesign/handoff/` from `main`.
2. Quit Claude Code completely (`/exit`).
3. Start a **new** session in the same folder with `claude`. Never use `--continue` or `--resume`, because they would bring back a conversation that has seen the old app.
4. First message: *"Start the design process described in CLAUDE.md."*
5. To leave: `/exit`, then `git switch main`. Coming back later: repeat 1–3. The studio's own commits carry the design work between sessions.

**Never** run a design session as a subagent spawned from a `main` session, and never paste anything from `main` into the studio.

The studio's `CLAUDE.md` gives Agent B the full process. In short:
- It reads only the handoff package (inventory, priorities, brief)
- It first produces **3 deliberately divergent directions** (e.g. different navigation models, densities, and personalities), each as a standalone HTML prototype with mock data
- You pick one direction, and it expands it to every job story and every state: nothing yet, loading, failure, no connection, password-restricted, read-only role, shared-link visitor, bulk selection, phone + desktop, light + dark
- It produces the **design guide** in `redesign/design/`, the package that gets approved and handed to implementation:
  - **Tokens:** color (light + dark), type scale, spacing, radius, elevation, motion, breakpoints
  - **Components:** every reusable piece, with all its variants and states (default, hover, focus, active, disabled, loading, error, selected, empty)
  - **Screens:** every screen in the new design, each shown in every state, on phone and desktop, in light and dark
  - **Patterns:** feedback (confirmations, success and error messages), destructive actions, empty states, loading behaviour, motion rules
  - **Copy & tone:** voice, labels, and wording for messages
  - **Accessibility:** contrast, focus visibility, keyboard behaviour, touch target sizes

**Mid-design rule:** if you catch yourself saying "the current app does it like X", stop. Translate it into a need ("I need to get to X in one step from anywhere") and give the designer the need, not X.

### Step 5 — Coverage audit

In the studio, Agent B writes `redesign/design/coverage.md`, mapping every story ID and state to the prototype. You check it by walking through the prototype yourself. Every job story and every state must have a home. Anything missing is a design gap to send back to Agent B as a *need*, not solved by borrowing from the old UI.

### Step 5b — Approve and freeze the design guide (you)

- Review the design guide and approve it.
- Freeze it with a version and date (e.g. `design-guide v1.0 — 2026-xx-xx`). Later changes go through Agent B and bump the version.
- Leave the studio (`git switch main`), then run `redesign/studio.sh import`. This copies `redesign/design/` from `design-studio` into `main`, then commits and pushes it. The firewall only blocks old → new, so moving the finished design onto `main` is safe.
- Keep the `design-studio` branch. If Agent C finds gaps in Step 6, they get designed there, then imported again.

### Step 6 — Technical implementation plan (Agent C, sees repo + approved design)

Before any code changes, Agent C writes **`redesign/ui-implementation-plan.md`**: a plan for turning the frozen design guide into this codebase, so that every component, state, and screen gets the new design and nothing is left in the old style.

Agent C maps **design → code**. It does not make design decisions. Any gap it finds goes back to Agent B as a need.

The implementation plan must contain these sections:

**1. Inputs & freeze**
- Design guide version it implements; inventory version; the commit it starts from

**2. Technical architecture**
- Respect the project's constraints: no framework, no build step, Firebase compat SDK, `addEventListener` only (no inline handlers)
- CSS file structure (e.g. `css/tokens.css`, `css/base.css`, `css/components.css`, `css/screens.css`) and load order
- Class naming convention for the new markup (new names only, nothing reused from the old CSS)
- Light/dark theming through tokens; how fonts and icons are loaded
- JS structure: how the data layer is separated from rendering in `app.js`, and where the new render code lives (e.g. `js/ui/*.js`)
- How the Tiptap editor, the PDF export, and the guest share view are styled

**3. Component map**
One entry per design guide component:
- Design guide name → CSS selector(s) → JS builder function → file
- Every variant and state, and how each one is triggered in code (class, attribute, `aria-*`)
- Responsive behaviour and accessibility requirements

**4. Screen map**
One entry per design guide screen:
- Components it uses, data it reads, code it replaces
- Every state the screen can be in: nothing yet, loading, failure, no connection, password-restricted, read-only role, shared-link visitor, bulk selection, search with no results

**5. Coverage matrix (design → code)**
A table of every **screen × state × device (phone / desktop) × theme (light / dark)** with a status checkbox. Every job story in `inventory.md` is traced to the screen and component that serves it.

**6. Reverse coverage (code → design)**
Agent C searches the code for **every place that produces visible UI**, so nothing keeps its old look, and maps each one to its new design counterpart. Easy to miss:
- Sign-in and forgot-password flows (`js/auth.js`; there is no sign-up)
- Role-gated UI (`js/rbac.js`)
- Native `alert()`, `confirm()`, `prompt()` calls
- Toasts and inline error messages
- Image lightbox and file previews
- Tiptap editor content styles (headings, checklists, links, colours)
- PDF export output and print styles
- Guest/shared-link views (folder, single document, single MoM)
- PWA install prompt, offline behaviour, `manifest.webmanifest` theme colour, favicon, app icons
- Sync / live indicator
- Upload progress and upload failures

Anything without a counterpart in the design guide goes back to Agent B as a need. It must **not** be restyled from the old version.

**7. Phases**
Each phase is shippable to a Vercel preview, keeps tests green, and lists its tasks, files touched, and done criteria:
1. Separate data logic from rendering, with **no visual change**; tests still pass
2. Tokens, base styles, and the app shell
3. Components (all variants and states)
4. Screens, one at a time
5. All states for every screen
6. Edge surfaces (editor content, PDF export, print, auth, guest views, PWA assets)
7. Delete old CSS, old rendering code, and old class names
8. QA and polish

**8. Testing & QA**
- Rewrite the Playwright tests to the new design, preserving every behaviour
- Screenshot comparison: take Playwright screenshots of the prototype and the build for each screen × state × device × theme and compare side by side
- Accessibility check: contrast, keyboard navigation, focus visibility, touch targets
- Real-device check: phone browser + installed PWA

**9. Risks & open questions**

**10. Definition of done**
- Every row of the coverage matrix and the reverse coverage list is checked
- No old CSS or old class names remain
- Tests pass; screenshots match the prototype; accessibility check passes

You review and approve `ui-implementation-plan.md` before Step 7 starts.

### Step 7 — Rebuild (on a `redesign` branch)

The rebuild follows `ui-implementation-plan.md` phase by phase. It is also where old design most often creeps back, because the implementer sees the old code. Guard rails:

- **Branch:** work on a `redesign` branch, **not `main`**. The auto-push rule deploys every commit to production through Vercel. Use Vercel preview URLs for review. This is a deliberate exception to the CLAUDE.md auto-push rule.
- **Source of truth:** the frozen design guide is the spec, and the implementation plan is the route. Compare the build against the prototype, never against the old app.
- **Track progress in the plan:** tick off coverage matrix rows as each one is done.
- **Delete, don't modify:** remove the old CSS entirely and start from the new tokens. Write new markup; don't rename or restyle old elements. Don't reuse old class names.
- **Keep only the plumbing:** reuse Firebase, Cloudinary, auth, RBAC, PWA, and data logic. Separate data logic from the HTML-building code in `app.js` first, then throw away the rendering half.
- **Tests follow the design, not the other way round:** the Playwright tests are a checklist of *behaviours* to preserve. Rewrite their steps and selectors to fit the new design. Never bend the new design to fit an old test.
- **No "quick fixes" from the old UI:** if something in the prototype is unclear, ask the designer (Agent B) for an answer rather than falling back to how the old app did it.
- **After merge:** update `CLAUDE.md` so future sessions describe the new UI, not the old one.

---

## Where old design can still leak in

| Leak | Why | Guard |
|---|---|---|
| **AI reading the code** | Markup, class names, screen order | Agent A only writes needs; Agent B works on an orphan branch where the old code isn't on disk |
| **`CLAUDE.md` auto-loading** | Any session on `main` loads it, and it describes the old UI | The studio branch has its own `CLAUDE.md` with no trace of the old app |
| **Git history** | New sessions see recent commit messages ("Fix context menu…"); git can show other branches | Orphan branch has no old history; deny rules block `git log/show/diff/checkout…` |
| **Old conversations** | `--continue`/`--resume` or reading transcripts brings back old-UI discussion | Always a brand-new session; transcripts under `~/.claude/projects/` are deny-listed |
| **Shared memory** | Claude Code memory is per folder, so it's shared by both branches | Sessions on `main` never save memories about the current UI; the studio is told to ignore and report any |
| **Online copies** | The GitHub repo and live site show the old app | Deny rules block GitHub, `gh`, `curl`, `wget`, Vercel |
| **Inventory wording** | "Tab", "menu", "Starred" bring the layout back | Banned-word rules + sanitisation pass + "guess the layout" test |
| **Inventory structure** | Grouping by current screens recreates them | Group by user jobs |
| **Your memory** | Daily use makes the current layout feel natural | Don't open the app during Steps 2–5; translate habits into needs |
| **Branding** | Logo and palette constrain the visual direction | Open by default; only names passed if kept |
| **The data model** | Folder nesting and notes-vs-files split shape the design | Designer may challenge it; you decide |
| **Implementation planning** | Agent C sees old code and may fill design gaps with old patterns | Agent C maps design → code only; gaps go back to Agent B as needs |
| **Forgotten surfaces** | Native dialogs, editor content, PDF export, and auth screens keep their old look | Reverse coverage list in the implementation plan |
| **The rebuild** | Implementer sees old code and reaches for it | Prototype is the spec; delete old CSS; new markup; ask the designer |
| **Tests** | Old tests encode old flows | Tests preserve behaviour only; rewrite steps to fit the new design |

The only influence that should remain is the feature set itself, which the new design has to cover anyway.

---

## Checklist

**Setup**
- [x] `design-studio` orphan branch created with studio `CLAUDE.md`, deny rules, and `.gitignore`
- [x] `redesign/studio.sh` (enter / import) on `main`

**Discovery (sees old app)**
- [x] Step 1: `redesign/handoff/inventory.md` written as job stories, grouped by jobs (Agent A); owner-only notes in `redesign/inventory-notes.md` (never hand off)
- [x] Step 1: second leak review; removed details logged in `inventory-notes.md` §7
- [x] Step 1b: banned-word scan clean
- [x] Step 1b: guess-the-layout test passed (fresh studio session can't guess the current layout) — run 2, see `inventory-notes.md` §8

**Brief (you, without opening the app)**
- [x] Step 2: open questions in `inventory-notes.md` §4–§5 decided; new needs added to `inventory.md` (F13, F14; see notes §9)
- [ ] Step 2: `priorities.md` filled in, every job tagged daily / weekly / rare / drop, status `FILLED`
- [ ] Step 3: `brief.md` filled in, including the branding decision, status `FILLED`

**Design (in `design-studio`, never sees old app)**
- [ ] Step 4: `redesign/studio.sh enter` → brand-new session → 3 divergent directions prototyped (Agent B)
- [ ] Direction chosen; all job stories and states prototyped
- [ ] Design guide complete: tokens, components, screens, patterns, copy, accessibility
- [ ] Step 5: coverage audit passed; gaps sent back as needs
- [ ] Step 5b: design guide approved and versioned; `redesign/studio.sh import` run on `main`

**Implementation plan (sees repo + approved design)**
- [ ] Step 6: `redesign/ui-implementation-plan.md` written (Agent C)
- [ ] Component map, screen map, and coverage matrix complete
- [ ] Reverse coverage: every UI-producing code path mapped; gaps sent to Agent B as needs
- [ ] Implementation plan approved

**Rebuild**
- [ ] Step 7: `redesign` branch created
- [ ] Phase 1: data logic separated from rendering, no visual change, tests green
- [ ] Phases 2–6: tokens, shell, components, screens, states, edge surfaces
- [ ] Phase 7: old CSS, rendering code, and class names deleted
- [ ] Phase 8: Playwright tests rewritten and passing; screenshots match prototype; accessibility check passes
- [ ] Every coverage matrix row and reverse coverage item ticked
- [ ] Merged to `main`; `CLAUDE.md` updated to describe the new UI
