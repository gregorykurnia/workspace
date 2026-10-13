# Inventory Notes — OWNER ONLY

> ⛔ **Never put this file in the design handoff package.** It references code, current labels, and current behaviour. It exists for you (Steps 1b–2) and for Agent C (Step 6).

Written by Agent A while extracting `redesign/handoff/inventory.md` from the code at commit `47e9f44`.

---

## 1. Sources read
`js/app.js` (all 1,751 lines), `js/auth.js`, `js/rbac.js`, `js/tiptap.js`, `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `index.html`, `css/styles.css` (media queries / print only), `tests/*.spec.js`.

## 2. Story → code trace (for Agent C)

| Story | Code |
|---|---|
| C1 | `newMom` |
| C2, C3 | `bindMomEditor` `onUpdate` autosave (1.5 s), `setSaveStatus`, `saveMom`, `backMom`, Cmd/Ctrl+S keydown |
| C4, C5 | `momEdHTML` fields `#mt #md #mg #mgdoc`, `collectMom` |
| C6–C8 | `openAddDoc`, `uploadCL` (error messages) |
| W1–W5 | `#tt-toolbar` in `momEdHTML`; command wiring in `bindMomEditor`; extensions in `js/tiptap.js` |
| W3 | `updateTableOverlay`, `_moveTableRow`, `_moveTableCol`, `Table.configure({resizable:true})` |
| W4 | `ResizableImage` in `js/tiptap.js`, `_insertImagePrompt`, `_handleEditorImagePaste` |
| W6 | `openDocPicker`, `insertDocLink` |
| W7 | `openMomPicker`; `mom.local/` click interception in `bindMomEditor` |
| W8 | `isProspectJournal`, `addDetailedRemarksColumn`, `openRemarkEditor`, `decorateReadOnlyRemarks`, `bindMomReadOnlyEvents` |
| W9 | `exportPDF` (html2pdf) |
| W11 | `deltaToHTML` / `momDeltaToHTML` (legacy Quill Delta → HTML via Quill CDN) |
| F1 | `openGlobalSearch` |
| F2 | `applySubFilter`, `applyMomFilter`, `applyDocFilter`, `updateFilterEmpty` |
| F3 | `starredTabHTML`, `data-starmom` / `data-stardoc` |
| F4 | `homeHTML`, `fcard` |
| F5 | `renderBC`, `#folder-back` |
| F6 | `renderTree`, `buildNode`, `EXP` / `G_exp` |
| F7 | `buildHash`, `applyHash`, `hashchange` |
| F8 | `folderHTML` summary meta |
| F9 | `openLightbox`, `data-openurl` |
| F10 | `downloadFile` |
| F11 | `docCardHTML` icon map + `.dc-thumb` |
| F12 | `#tb-date` in `renderBC` |
| O1, O2 | `openNewFolder`, `openRename`, `EMOJIS` |
| O3, O7 | `openBulkMoveModal` (descendant guard), `toggleSelMode`, `selBarHTML`, `selectAllVisible` |
| O4 | `openNewDocFolder` / `openNewMomFolder`, rename/delete counterparts |
| O5 | `openMoveModal`, `bindMoveSearch` |
| O6 | `openRenameMom`, `openRenameDoc` |
| O8 | `askDeleteFolder`, `askDelMom`, `askDelMomFromCard`, `askDelDoc`, `askDeleteDocFolder`, `askDeleteMomFolder`, `openBulkTrashModal` |
| O9 | `trashHTML`, `bindTrashEvents`, `restoreItem`, `clearTrash`, `_autopurge`, `_softDel` |
| P1–P4 | `openLockModal`, `unlockFolder` / `doUF`, `unlockDoc` / `doUD`, `relock`, `relockDoc`, `ifl`, `hw` |
| P5 | `openShareModal` |
| P6 | `openAccessModal`, `canSeeFolder` (`js/rbac.js`) |
| P7 | `data-togglero`, `data-toggleromom`, `#mom-togglero`, `momReadOnlyHTML` |
| S1 | `startListeners` |
| S2 | `_momListener` in `bindMomEditor` |
| S3 | `setSS`, `#sdot` |
| S4 | `toast` |
| A1 | `_setSidebar`, `@media(max-width:700px)`, `@media(hover:none)` |
| A2–A4 | `manifest.webmanifest`, `sw.js`, `js/pwa.js` (`#sw-update`) |
| A5 | `@media(prefers-reduced-motion)` |
| A6 | global `keydown` handler, Enter handlers in rename and unlock |
| U1–U3 | `js/auth.js` |
| U4 | `js/rbac.js` user record creation |
| V1–V4 | `SHARE_MODE` parse, `chkLoad`, `renderSharedDoc`, `renderSharedMom`, `shareLinkDenied`, anonymous sign-in in `js/auth.js` |

## 3. Where CLAUDE.md is out of date
- The editor is **Tiptap**, not Quill. Quill is loaded only to convert legacy Delta content.
- There are no checklists in the current editor (StarterKit has no task list).
- Additional Firestore collections: `docfolders`, `momfolders`, `users`, `folder_access`.
- Deletes are soft (`deleted`, `deletedAt`) with 7-day purge.
- Missing from CLAUDE.md: share links, RBAC, read-only, bulk actions, Trash, global search, prospect journal, PWA, Playwright tests.
- There is no sign-up flow. The plan's Step 6 mentions "sign-up", but accounts are created outside the app.

## 4. Placeholders in the current UI (not built)
These show up in the current UI but do nothing. **You decide** whether each one is a real need. If it is, add it to `inventory.md` as a new job story before handoff. They are not in the inventory now.
- **Recent**: e.g. "When I return, I want to reopen the things I worked on most recently, wherever they live."
- **Workspace-wide flagged items**: flags are only grouped per area today. A version across the whole workspace would be a new story.
- **Settings**: shown in two places, no content.
- **Notifications**: no backing feature.

## 5. Behaviour vs. intent: bugs and gaps found while reading
The inventory describes the **intended** behaviour. Here the code differs, or the intent is unclear:

1. **Shared-link visitors get the `member` role** (`js/rbac.js`, anonymous branch). Inside a shared area, they may be able to create or edit MoMs, add files, rename, etc. The share copy says "can view", so the inventory says visitors can only read (V1).
2. **The "Copy link" control on files is not wired.** It has no data attribute or handler (`docCardHTML`, `starredTabHTML`). It is not in the inventory as a separate need, since P5 and F9/F10 cover sharing and opening. Decide whether "copy a file's direct address" is a need.
3. **Global search ignores access.** `openGlobalSearch` searches `F`/`M`/`D` without `canSeeFolder`, so members can find areas they can't open.
4. **The file-link picker ignores access.** `openDocPicker` lists every file with a URL, in any area.
5. **Trash is not role-gated.** Any signed-in user can restore or permanently delete, and Trash lists items from areas they can't access. The inventory records "Recover deleted items: Admin ✓, Member ✓" as current behaviour. Confirm whether members should have this.
6. **Members can password-restrict any area they can see.** Admins aren't exempt from the password, so a member could lock admins out. Confirm the intent.
7. **A read-only MoM can still be renamed or moved by members** from the MoM summary (`momCardHTML` doesn't check `readOnly`).
8. **"Cancel" in the MoM editor saves anyway** (`backMom` calls `collectMom` + `sM`). The inventory treats leaving as "save and leave" (C3) and doesn't promise a discard. Decide whether "discard changes" is a need.
9. **Sorting sub-areas by "Newest first" doesn't reorder anything** (`applySubFilter` only handles `name`).
10. **The upload copy says "up to 100MB",** but PDFs over 10 MB fail on the Cloudinary free plan.
11. **The prospect journal depends on an exact title match** ("Clients - Prospect Journal"). The designer may propose a general mechanism; you decide.
12. **`#pdf-print` print styles are dead code.** Nothing populates `#pdf-print`. PDF export uses html2pdf.
13. **MoM search matches on the hidden preview text** (the first 140 characters of the body), not the full body. The inventory says "title and opening text" to match.

## 6. Deliberately left out of the inventory
Product name, logo, colours, fonts, current labels ("Starred", "Trash", "Lock", "Workspaces", "Subfolders", "Meeting notes", "Files"), the order of sections, and the per-area colour tints derived from IDs.

## 7. Sanitisation pass 2: details removed from the inventory
A second leak review removed wording that described the current layout. The current behaviour is recorded here so Agent C can still match or deliberately change it in Step 6:

| Story | Removed detail (current behaviour) |
|---|---|
| W8 | Remark editor opens beside the table entry; remarks are collapsed in read mode with per-remark expand |
| F3 | Flagged items have their own section per area, with a count badge, and are unflagged from there |
| F4 | Home shows outermost areas and, for admins, exactly 5 most recently added MoMs and files |
| F5 | Breadcrumb path from the root plus a "back up one level" control |
| F6 | Collapsible area tree with expand/collapse remembered on the device (`G_exp`) |
| F7 | Hash URL encodes the open area section ("which part of it") and the open grouping |
| F9 | Lightbox overlay, dismissed by Escape or a click outside; other files open in a new window |
| O1 | Emoji chosen from a fixed set of 24 |
| O7 | Selection works on one kind at a time (areas, MoMs, or files) |
| O8 | Bulk delete confirmation lists the first six names plus "and N more" |
| P2 | Re-restricting the open area navigates back to the home view |
| P3 | Area counts read "password protected" while restricted |
| A1 | Navigation is a drawer on phones that closes after choosing a destination |
| A2 | "Dock" wording |
| Hard constraints | Manifest locks orientation to portrait |

## 8. Leak test (Step 1b), run 1 — 2026-10-13
Isolated `claude -p --tools "" --setting-sources local` in an empty folder, given only `handoff/inventory.md`. Full answer: `~/inventory-test/guess.md`.

**Recovered correctly (leaks, now rewritten):** the area summary line plus four switchable sections (F2, F3, F7, F8); Home contents (F4); the date chip (F12); hover-revealed actions (A1, constraints); the "Ungrouped" label (glossary, O4); the Connecting / Live / Offline labels (S3, states); the full-screen editor with save-and-back (C3); font and size dropdowns (W1).
**Missed (firewall held):** the permanent folder sidebar, the search entry point, files as rows, drill-in groupings, the inline bulk bar, the MoM action row, mobile.

**Exact details removed from the inventory, which Agent C must still honour:**
- W1 typefaces: default (Inter), Arial, Georgia, Times New Roman, Courier New, Trebuchet. Sizes: 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 48.
- F8: an area shows its created date and counts of sub-areas, MoMs and files. Each grouping shows its item count.
- F4: the current Home shows outermost areas with item counts (or "Password protected"), and for admins only, the 5 most recently added MoMs and files.
- F12 (today's date shown) was dropped. The MoM date defaults to today (C4).
- F3: flags were grouped per area only. The inventory now says "everything I've flagged", widening the scope to the whole workspace (owner approved).
- F7: deep links also encode the open section (`t=`) and grouping (`df=` / `mf=`).

### Run 2 (after rewrites) — passed
Full answer: `~/inventory-test/guess-run2.md`.
- **Gone:** Home contents, date chip, hover-revealed actions, the "Ungrouped" label, the exact sync labels, and the 4 sections that included flagged items. Home is now guessed "low" and wrong.
- **Wrong:** files as a grid, collapsible groupings, the bottom bulk bar, ⋯ menus on each item, and Home showing "continue where you left off". Tabs vs. stacked sections is now a toss-up.
- **Still correct, but only through convention (accepted):** a sidebar tree for nested areas (run 1 guessed the opposite, so the inventory doesn't determine this), a breadcrumb, the size/age line for an area (it follows directly from the F8 need), a full-screen editor with save status, the sign-in form, and a drawer on mobile.
- **Follow-up fix:** removed "(with restricted areas marked)" from F5, because it was what put a padlock in the guessed breadcrumb. P3 already covers restricted status.

## 9. Owner decisions on §4–§5 — 2026-10-13
- **§4 placeholders:** Recent → **new story F13**. Notifications and Settings → **dropped** (not needs).
- **§5 #2 Copy link:** a real need → **new story F14**. Wire it up in the rebuild.
- **§5 #5 Trash:** **keep as is.** Any signed-in person can recover, permanently remove, or empty all deleted items, even items from areas they can't access. Recorded in the inventory roles table.
- **§5 #6 Area passwords:** **keep as is.** Members can restrict areas, and admins also need the password. Recorded in the roles table.
- **§5 #8 Cancel saves anyway:** "discard changes" is **not a need**. Save-and-carry-on (C3) stands.
- **Still open (not asked; fix in the rebuild per the inventory's intent):** #1 visitors read-only (V1), #3 and #4 search and file-link picker should respect access, #7 read-only MoMs shouldn't be renamable or movable by members (P7).
