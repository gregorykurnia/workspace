# UI Implementation Plan (Step 6)

How the frozen design guide gets built into this codebase, so that every component, state and screen gets the new design and nothing keeps the old look.

**Status: APPROVED by the owner on 2026-10-13.** Step 7 (the rebuild) may start.

This plan maps **design → code**. It makes no design decisions. Where the design is silent, the gap is listed in §9.1 as a *need* for the designer (Agent B), worded so it can be pasted into the studio without carrying anything from the old app.

---

## 1. Inputs & freeze

| Input | Version |
|---|---|
| Design guide | `redesign/design/design-guide.md` **v1.0, approved 2026-10-13** |
| Tokens | `redesign/design/tokens.css` (imported with the guide, commit `5c2e566`) |
| Prototype (the visual spec) | `redesign/design/prototype/` at commit `5c2e566` |
| Coverage audit | `redesign/design/coverage.md` at `5c2e566` |
| Decisions and open questions | `redesign/design/decisions.md` at `5c2e566` |
| Inventory | `redesign/handoff/inventory.md` at `855cfbb` (F13 and F14 added; the last change to the file) |
| Owner-only notes | `redesign/inventory-notes.md` §2 (story → code trace), §5 (bugs), §7–§9 (details removed from the inventory, owner decisions) |
| Codebase this plan starts from | `main` at **`375c69c`** |

**Freeze rule.** If the design guide changes (v1.1 or later), the changed rows of §3–§6 are re-checked before the affected phase is built. The guide is the spec, the prototype is the reference rendering, and this plan is the route. The old app is never a reference.

---

## 2. Technical architecture

### 2.1 Constraints kept
- Plain HTML, CSS and JS. No framework, no build step, no bundler, no `node_modules` at runtime. (Playwright stays a dev dependency.)
- Firebase **compat** SDK v9 (`firebase-*-compat.js`) as classic scripts. Never `import { } from` Firebase URLs.
- Events use `addEventListener` only. Following design guide §8, this means **one delegated listener per event type** on `document` (`click`, `submit`, `input`, `change`, `keydown`, `dragover`/`drop`), dispatching on `data-act` / `data-form` / `data-input` / `data-change`. No inline handlers anywhere, and no `el.onclick =` either.
- Tiptap stays an ES module loaded from esm.sh (`js/editor/tiptap.js`). That's the only module file, and it exposes `window._TT` the same way it does today.
- Cloudinary: same cloud and unsigned preset, and the same resource-type routing (image / video / raw).

### 2.2 How the rebuild runs next to the old app

The new UI is built as **a second page, `next.html`, on the `redesign` branch**. It shares the data layer with the old page but never loads the old CSS or the old rendering code. At cutover (Phase 7), `next.html` becomes `index.html`, and the old page, `css/styles.css` and the old rendering code are deleted in the same commit.

Why a second page rather than a flag inside `index.html`:
- 19 class names exist in both the old CSS and the prototype CSS (`.btn`, `.empty`, `.tag`, `.toast`, `.tab`, `.on`, `.err`, …). The old stylesheet also styles bare elements (`body`, `input`, `button`). Loading both on one page would mix the two looks, which is exactly the leak the plan forbids.
- `index.html` keeps working unchanged on every Vercel preview, so the old Playwright tests stay green through Phases 1–6, as the phase rules require.
- Firebase Auth state is per origin, so being signed in on `index.html` also signs you in on `next.html`. Nothing temporary needs to be built to sign in during Phases 2–5 (until Phase 6 builds the real sign-in, `next.html` sends a signed-out visitor to `index.html`).

### 2.3 File layout (end state after cutover)

```
index.html              ← was next.html (shell markup only, see 2.6)
css/
  tokens.css            ← byte-for-byte copy of redesign/design/tokens.css
  base.css              ← from prototype styles/base.css (minus the "Prototype panel" section)
  views.css             ← from prototype styles/views.css
  editor.css            ← from prototype styles/editor.css
  app.css               ← app-only rules the prototype never needed (Tiptap internals, font-face, upload placeholder); tokens only, no raw colours
fonts/
  PlusJakartaSans-*.woff2   ← self-hosted (design guide §8), latin + latin-ext, variable weight
js/
  data/                 ← plumbing: no HTML, no DOM (see 2.5)
    firebase.js  session.js  store.js  actions.js  uploads.js  content.js  search.js
  ui/                   ← rendering, one file per prototype file
    icons.js  core.js  shell.js  home.js  area.js  files.js  access.js  account.js  mom.js  app.js
  editor/
    tiptap.js           ← replaces js/tiptap.js (module)
  pwa.js                ← rewritten: banner via the design's Banner component
icon.svg                ← from prototype/icon.svg (replaces favicon.svg)
icons/apple-touch-icon.png  ← 180 px PNG rendered from icon.svg (iOS ignores SVG touch icons)
manifest.webmanifest    ← from prototype/manifest.webmanifest, paths adjusted
sw.js                   ← rewritten for the new shell file list
```

**CSS load order:** `tokens.css` → `base.css` → `views.css` → `editor.css` → `app.css`.

**Why keep the prototype's split** (rather than re-cutting it into `components.css` / `screens.css`): the prototype's later "Review pass" sections override earlier rules by cascade order. Keeping the same files in the same order means the build renders like the prototype by construction, and a diff against the prototype file stays readable during QA. The only changes allowed while porting:
1. Remove the "Prototype panel (not part of the design)" section and `.demo-link`.
2. Move inline `style="…"` attributes from prototype markup into named rules in `app.css` (same values, still tokens only).
3. Add `@font-face` for the self-hosted font, and Tiptap internals (`.ProseMirror`, `.tableWrapper`, `.column-resize-handle`, `.selectedCell`, `.ProseMirror-gapcursor`) scoped under `.ed-body` in `app.css`.

### 2.4 Class naming convention
- **The prototype's class names are the design's names, and the build uses them verbatim.** (The guide names some directly: `.btn-primary`, `.btn-soft`, `.btn-danger`, `.icon-btn`, `.field.err`, `.search-in`, `.ed-body`.)
- **No name comes from the old CSS.** The 19 names shared with the old stylesheet are there because the designer chose them, not because they were carried over. They never meet old rules, because `next.html` never loads `styles.css`, and `styles.css` is deleted at cutover. Phase 7's check (§10) proves it: none of the **old-only class names** may appear in the codebase. There are 244 (old CSS names minus prototype names), less three that Tiptap generates itself (`tiptap`, `tableWrapper`, `selectedCell`). Those are library names, not old design, and they're styled only under `.ed-body`.
- **New classes** that the prototype doesn't have (needed only for real-app plumbing) are lowercase-hyphenated, must not be on the old-only list, and are recorded in `app.css` with a one-line comment naming the design component they belong to.
- **JS hooks never carry styles.** JS finds elements by `data-act`, `id`, or `js-*` classes (the prototype already uses `js-status`). State is shown with the prototype's own mechanisms: `aria-current`, `aria-pressed`, `aria-checked`, `aria-disabled`, `[hidden]`, `.is-sel`, `.is-selected`, `.is-empty`, `.is-busy`, `.open`, and body classes `route-mom`, `bare`, `visitor`, `offline`, `selecting`.

### 2.5 Data layer vs rendering

Today `js/app.js` mixes Firestore reads and writes with HTML building. Phase 1 moves the plumbing **verbatim** into `js/data/*.js` (same function names and globals, so the old render code keeps working). The new UI then calls only the data layer, and never touches Firestore directly.

| File | Holds (moved from) | Added for the new design |
|---|---|---|
| `data/firebase.js` | Firebase config, `initializeApp`, `db`, Cloudinary constants (`app.js` 1–4) | `db.enablePersistence({synchronizeTabs:true})` (needed for "Saved on this device", A3); failure is caught and ignored |
| `data/session.js` | sign-in, reset, change password (`auth.js`, logic only); role, user record, `FA`, `WORKSPACE_USERS`, `canSeeFolder` (`rbac.js`, logic only); anonymous sign-in for shared links | "Stay signed in" → `LOCAL` vs `SESSION` persistence (U1); a `visitor` role for anonymous users (fixes notes §5 #1); `recent` list per user (F13, stored on `users/{uid}.recent`, newest 8) |
| `data/store.js` | `F M D DF MF` and the deleted lists, `startListeners`, `LOADED`, `chkLoad`, queries `gf kids momsOf docsOf pathTo cnt folderLabel docFoldersOf …`, `ifl`, `UF`/`UD` session unlocks | Change events instead of direct `render()` calls (`Store.onChange(fn)`), sync state from snapshot metadata (Up to date / Catching up / Offline, S3), colleague-addition events from `docChanges()` (S1), the visibility rules `canSee`, `lockedArea`, `lockedFile`, `hiddenItem`, `visibleAreas`, `crumbPath`, `sizeText`, `ageText` (ported from prototype `core.js`/`area.js`, re-pointed at real fields) |
| `data/actions.js` | `sF sM sD sDF sMF`, soft delete and `dFDeep`, `restoreItem`, `permDeleteItem`, `clearTrash`, `_autopurge`, `hw`, move, rename, flag, final, share, password set/change/remove | Every write **returns its promise** (for save status and failure toasts); Undo payloads for move, remove grouping and move area (S4); authorship fields (see 2.8) |
| `data/uploads.js` | `uploadCL` | Returns an error **code** (`too-large`, `type-blocked`, `setup`, `network`), not a message. The UI maps codes to the design's copy (C8). PDFs over 10 MB and blocked types are caught before uploading |
| `data/content.js` | `momDeltaToHTML`/`deltaToHTML` (legacy Quill Delta → HTML, W11), `momPreview`, `isProspectJournal`, `addDetailedRemarksColumn` | Lazy-load Quill only when a legacy Delta is met; content migration to the Long text model (2.8) |
| `data/search.js` | the matching inside `openGlobalSearch` | Respects access and restriction (P3; fixes notes §5 #3 and #4); also used by the Link files / Link MoMs pickers and the Move destination search |

The old `js/app.js`, `js/auth.js` and `js/rbac.js` keep only their DOM code after Phase 1, and are deleted in Phase 7.

**UI layer** (`js/ui/*.js`) ports the prototype's own structure: `core.js` (helpers, `on()` / `onForm()` / `onInput()` delegation, `layer()`, `menu()`, `confirmDialog()`, `toast()`, the router, `render()`, skeleton, banners, keyboard), then one file per area of the product. Prototype functions are ported **by name** where they exist (`treeHTML`, `topbarHTML`, `momCardHTML`, `fileTileHTML`, `shelfHTML`, `bulkBarHTML`, `destPicker`, `passwordDialog`, `shareDialog`, `accessDialog`, `toolbarHTML`, …), and the prototype's `DB`/`S` mock state is replaced by `Store` queries and a small `UI` state object (`selMode`, `sel`, `filter`, `sort`, `fileView`, `unlocked`). Nothing in `js/ui/` is copied from the old `app.js`.

### 2.6 Routing
- Hash routes exactly as the design's screen table (§4): `#/today`, `#/areas`, `#/areas/:id`, `#/mom/:id`, `#/flagged`, `#/recent`, `#/deleted`, `#/account`, `#/signin`, `#/reset`, `#/new-member`, `#/s/a/:id`, `#/s/m/:id`, `#/s/f/:id`, anything else → Missing page. The router and guard come from prototype `core.js` (`route()`, `guard()`), with roles from `session.js`.
- **Old addresses keep working forever** (they're in people's emails and bookmarks). The boot script rewrites them once with `location.replace`: `?folder=X` → `#/s/a/X`, `?mom=X` → `#/s/m/X`, `?doc=X` → `#/s/f/X`, `#f=X&…` → `#/areas/X`, `#m=X` → `#/mom/X`.
- New share links are written as `/#/s/a/:id` (and `/m/`, `/f/`). `session.js` signs in anonymously when the route starts with `#/s/`.
- `index.html` holds only the prototype's shell skeleton (`.shell`, `#side`, `.topbar`, `#banners`, `#view`, `#tabbar`, `#layers`, `#dropOverlay`, `#toasts`, `#fileInput`), with no `.proto` panel, plus the script tags.

### 2.7 Theming, fonts and icons
- **Theme:** `tokens.css` already defines light (default), dark under `prefers-color-scheme` when `html` isn't `[data-theme=light]`, and `[data-theme=dark]`. The Appearance setting (Light / Dark / Match system) is stored per device in `localStorage` key **`G_theme`**: `light` → `data-theme="light"`; `dark` → `data-theme="dark"`; `system` → no attribute. A 3-line inline script in `<head>` applies it before first paint (no flash). The two `theme-color` metas from the prototype are kept, and are updated when the setting overrides the system.
- **New localStorage keys** (recorded in CLAUDE.md at merge): `G_theme`, `G_fview` (files grid/list per device). `G_exp` (tree expansion) is kept. `G_mp` stays removed.
- **Font:** Plus Jakarta Sans, self-hosted as a variable woff2 (weights 400–800 cover 500/650/750/800), `font-display: swap`, precached by the service worker. The Google Fonts link in the prototype is not used.
- **Icons:** the prototype's inline SVG sprite (`prototype/js/icons.js`) is ported as `js/ui/icons.js` and injected once. Every icon is `aria-hidden`. Icon-only buttons carry `aria-label` (design §7). No emoji are used as icons; emoji appear only as area emoji.

### 2.8 Data model: additions only, no destructive migration
All additions are optional fields, so old documents keep working and the old page on `main` is unaffected.

| Need | Field | Notes |
|---|---|---|
| F4b "who", S1 toast, S2 bar name | `createdBy {uid,name}` on new `moms`/`docs`; `editedBy {uid,name}`, `edited` (ms) on every MoM save | Old items have no author (see gap G6) |
| F4b ordering for MoMs | `created` (ms) on new `moms` | Old MoMs fall back to `date` |
| P5 "the item's own link wins" | `shared` becomes three-state: `true` on, `false` turned off, missing = follows its area | Today `false` and missing mean the same. Turning a link off already writes `false`, so items that were shared once and later turned off will be hidden from their shared area after cutover. That's what P5 asks for, but they're listed for the owner first (§9.3) |
| P7 "final" | keep the field name `readOnly` | The UI says "Final"; the data keeps its name |
| F3 "flag" | keep `starred` | Workspace-wide, as today (see open question Q5) |
| W8 / P-1 Long text column | header cell attribute `data-coltype="longtext"`; journal table attribute `data-template="prospect-journal"` | Tiptap `TableHeader` and `Table` extended with these attributes. On first open, an old MoM titled "Clients - Prospect Journal" with a "Detailed Remarks" column is converted (that column becomes Long text and the table becomes a journal) and saved, as the current code already does for the missing column. The HTML from before the conversion is kept once in `contentBackup` |
| F13 Recent | `users/{uid}.recent: [{k:'a'|'m'|'f', id, at}]` (8 newest) | Written on open; visitors have none |
| Groupings in Deleted | unchanged (`docfolders`/`momfolders` soft delete) | Undo for "Remove grouping" re-attaches the items it ungrouped |

### 2.9 Tiptap editor, PDF export and guest view styling
- **Editor content:** the Tiptap root gets `class="ed-body"` (`editorProps.attributes`). All content styles come from the prototype's `.ed-body` rules in `editor.css`, so the same look applies to the editor, the read-only view, the shared MoM view and the A4 export. The current editor body styles are not ported.
- **Editor chrome:** toolbar, **Aa** menu, alignment menu, selection bubble (Tiptap `BubbleMenu`, element styled `.bubble`), "/" menu (a small extension on `@tiptap/suggestion@2` from esm.sh, styled `.slash`), table bar, Long text cells, Detailed Remarks drawer, journal bar, and image controls. Each is rebuilt from the prototype markup and wired to Tiptap commands instead of `execCommand`. The `ResizableImage` node view is rebuilt to emit the prototype's `.img` / `.img.inline` / `.img.floating` / `.is-sel` / `.grip` / `.move-handle` markup. Its old emoji controls are deleted.
- **Typeface and size choices:** Sans-serif / Serif / Mono and the 8 sizes 12–32, applied with the existing `FontFamily` / `FontSize` marks. Older notes keep whatever they stored (W11). How the menu shows a value outside the new set is gap G2.
- **PDF export (W9):** the design's A4 preview (`.a4`, `.a4-wrap`, `.a4-foot`, `.stamp`) is built from the same `.ed-body` HTML. The final action depends on open question Q1. Either "Print or save as PDF" through `window.print()` with the prototype's `@media print` rules (`document.title` set to the MoM title during printing, so the file is named after it), or generation with html2pdf from the same `.a4` element. Both read the same preview.
- **Guest views:** routes `#/s/…` set `body.visitor`. No sidebar, top bar or tabs, only the prototype's `.vpage` / `.vhead` / `.vcard` markup and the "Read only" pill.

---

## 3. Component map

Columns: design guide component → selectors (from the prototype CSS) → builder (new code) → file. "States" lists every variant and state with how code triggers it. Focus is always the shared `--focus` ring via `:focus-visible` (in `base.css`). "Disabled" is the `disabled` attribute, or `aria-disabled="true"` for admin-only items (§3.5).

### 3.1 Buttons
| Component | Selectors | Builder → file | States & triggers | Responsive / a11y |
|---|---|---|---|---|
| Primary | `.btn.btn-primary` | markup in each view; `busy(btn, on)` helper → `ui/core.js` | hover/active (CSS); disabled `[disabled]`; busy `.is-busy` + spinner icon, `aria-busy="true"` | ≥ 44 px (`--hit`); one per region |
| Soft | `.btn.btn-soft` | markup | hover, disabled | — |
| Ghost / link button | `.btn.btn-ghost`, `.link-btn` | markup | hover tint | — |
| Danger / quiet danger | `.btn.btn-danger`, `.btn-quiet-danger`, `.btn-danger-soft` | `confirmDialog({danger:true})` → `ui/core.js` | only inside confirmations; quiet danger for Empty all / Revoke | verb repeats the action (§5 O8) |
| Icon button | `.icon-btn` (+ `.sm`) | markup | toggle selected via `aria-pressed="true"` (flag) | 44 px round; `aria-label` always |
| Split New | `.split`, `.split-main`, `.split-caret` | `topbarHTML()` → `ui/shell.js` | caret opens `menu()` with Upload, Save a link, New grouping, New sub-area (admin) | desktop/tablet only |
| Quick tile | `.quick`, `.qtile`, `.qtile.primary`, `.quick-first` | `VIEWS.today` → `ui/home.js` | admin 4th tile New area / member Flagged; `[disabled]` styled; nothing-yet variant `.quick-first` | phone: 1 wide + 3 compact |

### 3.2 Inputs
| Component | Selectors | Builder → file | States & triggers |
|---|---|---|---|
| Text / textarea / select | `.field`, `.lab`, `.input`, `.textarea`, `.select`, `.hint`, `.ferr` | `fieldHTML()` helper → `ui/core.js` | error: `.field.err` + `.ferr` message with icon, `aria-invalid="true"`, `aria-describedby` |
| Password | `.field` + eye `.icon-btn`; `.pw-meter` | `pwField()` → `ui/access.js` | show/hide toggles `type` and `aria-pressed`; strength meter on restriction forms; "At least 6 characters. Stored only as a hash." |
| Search in a page | `.search-in` | `filterbar` in `VIEWS.area` → `ui/area.js` | value drives `UI.filter`; clear button when non-empty |
| Date chip | `.mchip` (date) wrapping `input[type=date]` | `VIEWS.mom.html` → `ui/mom.js` | shows "12 Oct 2026"; opens the native picker |
| Tags | `.tags`, `.tag`, `.tag-add`, `.tagc` | `bindTagInput()` → `ui/mom.js` | Enter adds; ✕ removes (`aria-label="Remove tag X"`) |
| Emoji grid | `.emoji-grid` | `newAreaDialog()`, `renameDialog()` → `ui/area.js` | selected: `aria-checked="true"` (radiogroup) + accent ring; 8 across, 6 on phone |
| Kind tiles | `.kinds`, `.kind` | `openLink()` → `ui/files.js` | selected `aria-checked="true"`; kind guessed from the address with `guessKind()` |

### 3.3 Chips and pills
| Component | Selectors | Builder → file | States & triggers |
|---|---|---|---|
| Tag | `.tag` | card and editor markup | — |
| Place chip | `.place-chip` | `createPlace()` → `ui/shell.js` | opens `destPicker` |
| Status pill | `.status-pill.js-status` (+ `.saving`, `.local`, `.failed`) | `setStatus(kind)` → `ui/mom.js` | `saving` on edit; `saved` on write resolve; `local` when offline with pending write; `failed` + Retry on reject. `role="status"` |
| Sync pill | `.sync`, `.sync.catching`, `.sync.offline`, `.sync-l` | `syncInfo()` → `ui/core.js` | from `Store.sync` (2.5); live region |
| Lock pill | `.lock-pill`, `.lock-pill.open` | `VIEWS.area` → `ui/area.js` | "Restricted" / "Open for this session · Lock again" (`data-act="relock"`) |
| Final mark, Restricted mark | `.finalmark`, `.restrictmark` | card builders | from `readOnly` / `pw` |
| Read only pill | `.readonly-pill`, `.ed-readonly` | editor head, visitor head | member + final, or visitor |
| Role pill | `.pill-role` | `VIEWS.account` → `ui/account.js` | Admin / Member |

### 3.4 Cards and rows
| Component | Selectors | Builder → file | States & triggers |
|---|---|---|---|
| Area card | `.acard`, `.blob.tint-*`, `.kids` | `VIEWS.areas` → `ui/home.js` | restricted: counts replaced by "Restricted" (`lockedArea`); selectable (admin) with `.sel-box` |
| Sub-area card | `.subcard`, `.subcard.new-card` | `VIEWS.area` → `ui/area.js` | dashed New sub-area card admin-only |
| MoM card | `.mcard`, `.more`, `.flagmark`, `.finalmark` | `momCardHTML2(m)` → `ui/area.js`; `momCardHTML(m)` → `ui/home.js` | hover lift (CSS); ⋯ always visible on touch (`@media (hover:none)`); selected `.cw.is-selected` + ring |
| File tile | `.ftiles`, `.ftile`, `.thumb`, `.ext`, `.k-*`, `.lockbig` | `fileTileHTML(f)` → `ui/area.js` | image sample `<img loading="lazy">`; restricted: lock overlay + "Restricted · note hidden" |
| File row | `.list` > `.row` | `fileRowHTML(f)` → `ui/area.js` | when `G_fview = list` |
| Item row | `.row`, `.mid`, `.t`, `.p` | `itemRow(kind,id)` → `ui/home.js` | shows where it lives (`crumbPath`) |
| Continue card | `.ccard`, `.cont-row` | `VIEWS.today` → `ui/home.js` | from `users/{uid}.recent` |
| Selection | `.sel-box[role=checkbox]`, `.cw.is-selected`, `body.selecting` | `bulkBarHTML()`, `refreshBulk()` → `ui/area.js` | `aria-checked` true/false |

### 3.5 Grouping shelf and permissions
| Component | Selectors | Builder → file | States & triggers |
|---|---|---|---|
| Grouping shelf | `.shelf`, `.shelf-head`, `.shelf-ic`, `.shelf-add`, `.shelf.is-empty` | `shelfHTML(g, a, filtering)` → `ui/area.js` | empty: `.is-empty` + "Empty grouping"; "here" dropped on phone; ⋯ menu with Rename, Remove grouping (admin) |
| Admin-only control | `[data-admin][aria-disabled=true]`, `.mi.locked` | `adminAttr(k,label)` / `menuHTML()` → `ui/core.js` | members see it greyed; clicking gives the toast "Only admins can …" |
| Final-blocked control | `aria-disabled="true"` + `data-final` | `menuHTML()` | toast "This is marked final, so it can't be changed." (fixes notes §5 #7) |

### 3.6 Navigation
| Component | Selectors | Builder → file | States & triggers | Responsive |
|---|---|---|---|---|
| Sidebar | `.side`, `.side-brand`, `.side-nav`, `.nav-item[aria-current=page]`, `.side-tree`, `.tree-row[aria-current=true]`, `.side-add`, `.side-empty`, `.side-bottom`, `.side-foot`, `.side-acct`, `.count`, `.flagc` | `sidebarHTML(r)`, `treeHTML(r)` → `ui/shell.js` | tree expansion from `G_exp`; lock for restricted; empty: admin "No areas yet. Create one" / member "No areas shared with you yet"; `role="tree"`/`treeitem`, `aria-expanded` | ≥1024 px; rows 44 px on `pointer: coarse` |
| Tablet rail | same `.side` under the 768–1023 media rules | same builders | icons only, tree via All areas | 768–1023 px |
| Top bar | `.topbar`, `.top-crumbs`, `.crumbs`, `.crumb`, `.crumb-sep`, `.crumb-now`, `.crumb-more`, `.cmd-trigger`, `.top-right`, `.avatar-btn` | `topbarHTML(r)`, `crumbsHTML()` → `ui/shell.js` | paths deeper than 3 fold into "…" (menu of hidden levels); members' paths start at their grant; visitors' at the shared area | desktop/tablet |
| Editor top bar | `.topbar` in `body.route-mom` + `.top-title-d` | `topbarHTML(r)` mom branch | breadcrumb ends in the MoM title; status pill, Search, flag, ⋯, Done | ≥768 px |
| Phone top bar | `.phone-title`, `.back-btn`, `.sync .dot` | `topbarHTML(r)` phone branch | back hidden on top-level tabs | ≤767 px |
| Phone tabs | `.tabbar`, `.tab[aria-current=page]`, `.tab-create` | `tabbarHTML(r)` → `ui/shell.js` | Today · Areas · ＋ · Flagged · Search | ≤767 px, safe-area padding |
| Areas tab | `.tree-page` | `VIEWS.areas` phone branch → `ui/home.js` | 52 px rows | ≤767 px |
| Breadcrumb chips | `.crumbs` in the area header | `crumbsHTML()` | horizontal scroll | ≤767 px |

### 3.7 Layers
| Component | Selectors | Builder → file | States & triggers | Responsive / a11y |
|---|---|---|---|---|
| Dialog / sheet | `.layer`, `.scrim`, `.panel`, `.dlg-head`, `.tt2`, `.dlg-foot`, `.grip` | `layer({…})` → `ui/core.js` | `.open` added on the next frame for the transition; closes on scrim / ✕ / Esc | bottom sheet ≤767 px; `role=dialog`, `aria-modal`, focus moves in and returns |
| Drawer | `.layer.layer-drawer` | `layer({cls:'layer-drawer'})` | Detailed Remarks only | right side on desktop; 92% height on phone |
| Menu | `.layer.layer-menu`, `.menu-list[role=menu]`, `.mi[role=menuitem]`, `.mi.danger`, `.mdiv` | `menu(anchor, items)` → `ui/core.js` | anchored to its button on desktop | bottom sheet on phone |
| ⌘K command bar | `.layer.layer-palette`, `.pal-in`, `.pal-res`, `.pal-cap`, `.pal-row[aria-selected]`, `.pal-foot` | `paletteResults(q)`, `paletteListHTML(q)` → `ui/shell.js` | ↑↓↵, Esc; grouped Actions / Areas / MoMs / Files and links; no-match message; results from `data/search.js` | full screen on phone; `role=listbox`/`option` |
| Lightbox | `.layer.layer-lightbox`, `.lb` | `lightbox(f)` → `ui/files.js` | Download, Copy address, Close; Esc | — |
| Toast | `.toasts`, `.toast`, `.toast.has-action`, `.toast.warn` | `toast(msg,{icon,tone,action})` → `ui/core.js` | at most 3; 4.2 s; action buttons: Undo / Open Deleted | above the tabs on phone; live region |
| Banner | `.banners`, `.banner.offline`, `.banner.sync`, `.banner.update` | `renderBanners()` → `ui/core.js` | from `Store.sync`; `update` from `pwa.js` | — |
| Bulk bar | `.bulkbar` | `bulkBarHTML(areaId)` → `ui/area.js` | N selected · Select all N matching · Move… · Delete (admin) · Clear | phone: full width above the tabs |
| Drop overlay | `.dropzone-overlay`, `#dropTitle` | drag handlers → `ui/files.js` | shown on `dragenter` with files, over an area or a MoM; "Drop to add to {area}" | hidden on phone (no drag) |

### 3.8 Editor parts
| Component | Selectors | Builder → file | States & triggers |
|---|---|---|---|
| Toolbar | `.toolbar`, `.tb-inner`, `.tb`, `.tb[aria-pressed=true]`, `.tb[disabled]`, `.tb-sel`, `.tb-div`, `.tb-label`, `.tb-wide` | `toolbarHTML()`, `updateToolbar()` → `ui/mom.js` | pressed from `editor.isActive()` on `selectionUpdate`/`transaction` (W2); undo/redo disabled from `editor.can()`; hidden when read-only. Desktop: floats under the top bar. Phone: docked above the keyboard (`visualViewport` offset), scrolls sideways |
| Aa menu | `.text-menu`, `.tm-cap`, `.tm-seg`, `.tm-sizes`, `.tm-size`, `.swatch-row`, `.swatch` | `textMenu()` → `ui/mom.js` | typeface segment, 8 sizes, 6 text colours + clear, 6 highlights + none |
| Alignment menu | `menu()` items | `ui/mom.js` | start / centre / end; the icon follows the caret |
| Selection bubble | `.bubble`, `.bubble[hidden]` | Tiptap `BubbleMenu` element → `ui/mom.js` | Bold, Italic, Underline, Strike, link, clear; desktop only |
| "/" menu | `.slash`, `.slash[hidden]` | `SlashCommand` extension → `editor/tiptap.js`; list → `ui/mom.js` | filters as you type; ↑↓↵, Esc; items per guide §3 |
| Table + table bar | `.tw`, `.colgrip`, `.coltype`, `.ttools` / table menu | `decorateTables()`, `updateTableBar()` → `ui/mom.js` | add/move/delete rows and columns, delete table (Undo toast), column type → Long text, resize via Tiptap `columnResizing`; Tab and Tab-in-last-cell are Tiptap defaults |
| Long text cell | `.longtext`, `.remark`, `.remark-text`, `.remark-empty`, `.remark-open` | `decorateTables()` + node decoration → `ui/mom.js` | two-line preview + expand; tap opens the drawer |
| Detailed Remarks drawer | `.layer-drawer`, `.rm-head`, `.rm-body`, `.rm-fields`, `.rm-cap`, `.rm-foot` | `openRemarks(cell)` → `ui/mom.js` | auto-saves (350 ms) with Saving… → Saved; focus lands in the remarks text |
| Journal bar | `.journal`, `.journal-bar`, `.table-locked-note` | `syncJournal()` → `ui/mom.js` | in a journal, Remarks can't be moved, deleted or changed back; new rows get it; phone: entry cards |
| Image | `.img`, `.img.inline`, `.img.floating`, `.is-sel`, `.is-dragging`, `.grip`, `.move-handle`, `.img-float-zone`, `.img-loading`, `.pct`, `.failed` | `ResizableImage` node view → `editor/tiptap.js`; `insertImage()` → `ui/mom.js` | uploading placeholder with % (a placeholder node replaced on success); failure shows the reason + Retry |
| Links in notes | `.ed-body a`, `.ed-body a.ref` (file pill), `.ed-body a.ref.mom` (MoM pill) | `Link` extension + click handler → `ui/mom.js` | `https://mom.local/{id}` and workspace file URLs render as pills; following a MoM pill saves first |
| Remote change bar | `.remote-bar` | `showRemote(m)` → `ui/mom.js` | appears when another person's save arrives (S2); "Show changes" applies it and keeps the selection |
| Final notice | `.notice.info` | `VIEWS.mom.html` | members on a final MoM |
| A4 export | `.a4`, `.a4-wrap`, `.a4-foot`, `.stamp`, `.print-root` | `exportDialog(m)` → `ui/mom.js` | works when read-only; Q1 decides print vs generate |

### 3.9 States and feedback pieces
| Component | Selectors | Builder → file |
|---|---|---|
| Empty state (full / small) | `.empty`, `.empty.small`, `.art`, `.acts` | `emptyHTML({art,title,text,actions})` → `ui/core.js` |
| No match | `.noresult` | `ui/core.js` |
| Skeleton | `.skel` (static under reduced motion) | `skeletonHTML(routeName)` → `ui/core.js`, shown until the first snapshot from all five listeners |
| Notice boxes | `.notice.info`, `.notice.warn`, `.notice.danger` | markup |
| Restricted gate | `.locked`, `.lockbig` + password form | `lockedGateHTML()` → `ui/area.js`, `fileGate()` → `ui/files.js` |
| No-access gate | `noAccessHTML()`, `noAccessAreaHTML()` | `ui/home.js`, `ui/area.js` |
| Link unavailable | `.vpage .vcard` | `unavailable()` → `ui/account.js` |

---

## 4. Screen map

The state columns use the plan's required list. **✓** = must be built; **—** = can't occur on that screen (with the reason the first time it appears).

| Screen (route) | Components | Reads | Replaces (old code) |
|---|---|---|---|
| **Today** `#/today` | quick tiles, place chip, continue cards, item rows, area cards, empty, skeleton | `visibleAreas`, `recent`, flagged, recently added (admin) | `homeHTML`, `fcard`, `#nav-home` |
| **All areas** `#/areas` | area cards (desktop), tree page (phone), selection + bulk bar (admin), empty | `visibleRoots`, `kidsOf`, `sizeText` | `homeHTML` "Active folders", `renderTree` (phone drawer) |
| **Area** `#/areas/:id` | header (emoji blob, name, size and age line, lock pill), crumbs, filter bar, sort seg, grid/list switch, sub-area cards, shelves, MoM cards, file tiles/rows, bulk bar, drop overlay, gates | `area`, `kidsOf`, groupings, `momsIn`, `filesIn`, `matchingKeys` | `folderHTML`, `subHTML`, `momListHTML`, `docListHTML`, `starredTabHTML`, `renderTB` (folder), filters `apply*Filter` |
| **MoM editor** `#/mom/:id` | editor top bar, title, date chip, tags, attach chip, toolbar, bubble, slash, tables, remarks drawer, images, pills, remote bar, final notice, status pill | `mom`, the MoM doc listener, pickers via `search.js` | `momEdHTML`, `momReadOnlyHTML`, `bindMomEditor`, `bindMomReadOnlyEvents`, `renderTB` (mom) |
| **Flagged** `#/flagged` | item rows with unflag, empty | flagged, visible and not restricted | `starredTabHTML` (per area) |
| **Recent** `#/recent` | item rows, empty | `users/{uid}.recent` | (placeholder only today) |
| **Deleted** `#/deleted` | rows with kind, when, days left, Restore, Remove forever; Empty all; confirmations | deleted lists | `trashHTML`, `bindTrashEvents` |
| **Account** `#/account` | account card, role pill, Change password dialog, Install, Appearance seg, Your access, Sign out | `session` | `#sb-user-btn` popup, `openChangePassword` |
| **Sign in** `#/signin` | auth card, fields, password eye, "Stay signed in" check | — | `#auth-screen`, `doSignIn` |
| **Reset** `#/reset` | auth card | — | `#auth-forgot` handler |
| **New member** `#/new-member` | empty art, copy | role, `FA` | (none: today a new member sees an empty home) |
| **Shared area** `#/s/a/:id` | visitor head, sub-area cards, MoM cards, file tiles, Read only pill | shared root + descendants, item `shared !== false` | `chkLoad` share branch, `goTo(pathTo(SHARE_FOLDER_ID))` |
| **Shared MoM** `#/s/m/:id` | visitor head, title, date, tags, `.ed-body` | `mom` if `shared` | `renderSharedMom` |
| **Shared file** `#/s/f/:id` | vcard, password gate, Open, Download | `file` if `shared` | `renderSharedDoc` |
| **Link unavailable** | vcard | — | `shareLinkDenied` |
| **Missing page** | empty + Today / Deleted | — | (none) |

### Required states per screen

| Screen | Nothing yet | Loading | Failure | No connection | Password-restricted | Read-only role | Shared-link visitor | Bulk selection | Search, no results |
|---|---|---|---|---|---|---|---|---|---|
| Today | ✓ first area first; member variant | ✓ skeleton | — (no writes) | ✓ banner, data from cache | ✓ restricted items absent | ✓ member: Flagged tile, no Recently added | — (visitors never get here) | — | — |
| All areas | ✓ admin / member / new member | ✓ | — | ✓ | ✓ lock, no counts | ✓ granted areas only | — | ✓ admin selects areas | — |
| Area | ✓ "Nothing in X yet" + empty grouping | ✓ | ✓ write failures → toast (G9) | ✓ | ✓ gate, wrong password, open for session, Lock again | ✓ no access gate; final items blocked; admin-only greyed | — (own screen) | ✓ none / some / all matching | ✓ "No matches for … · Clear filter" |
| MoM editor | ✓ empty body placeholder | ✓ | ✓ Couldn't save · Retry; image upload failed + Retry | ✓ Saved on this device | ✓ gate (MoM inside a restricted area) | ✓ member on final: no toolbar, notice | — | — | ✓ Link pickers "No matches" |
| Flagged | ✓ nothing flagged | ✓ | — | ✓ | ✓ restricted items absent | ✓ member sees own visible items | — | — | — |
| Recent | ✓ | ✓ | — | ✓ | ✓ absent | ✓ | — | — | — |
| Deleted | ✓ nothing deleted | ✓ | ✓ toast | ✓ | — (deleted items show name only) | ✓ members can restore/remove (owner decision §9) | — | — | — |
| Account | — | — | ✓ change-password errors | ✓ | — | ✓ role pill | — | — | — |
| Sign in / Reset | — | ✓ busy button | ✓ wrong details, missing password, email missing | ✓ notice | — | — | — | — | — |
| New member | ✓ (the screen itself) | — | — | ✓ | — | ✓ | — | — | — |
| Shared area | ✓ nothing inside | ✓ | — | ✓ | ✓ restricted sub-area or file gate | ✓ Read only | ✓ | — | — |
| Shared MoM / file | — | ✓ | ✓ wrong password (file) | ✓ | ✓ file gate | ✓ | ✓ | — | — |
| ⌘K | ✓ prompt text | — | — | ✓ searches cached data | ✓ restricted hidden | ✓ | — | — | ✓ |
| Move dialog | ✓ | — | ✓ | ✓ | ✓ restricted destinations hidden | ✓ wrong-kind groupings disabled | — | ✓ several items | ✓ "No destination matches" |

---

## 5. Coverage matrix (design → code)

Tick each box when the build matches the prototype at that size and theme. **P** = phone (390 px), **T** = tablet (900 px, checked once per screen in light), **D** = desktop (1280 px), **L/Dk** = light/dark.

### 5.1 Screens × states

| # | Screen · state | P·L | P·Dk | D·L | D·Dk | T·L |
|---|---|---|---|---|---|---|
| 1 | Today · normal (admin) | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | Today · member | [ ] | [ ] | [ ] | [ ] | |
| 3 | Today · nothing yet | [ ] | [ ] | [ ] | [ ] | |
| 4 | Today · loading skeleton | [ ] | [ ] | [ ] | [ ] | |
| 5 | All areas · grid / phone tree | [ ] | [ ] | [ ] | [ ] | [ ] |
| 6 | All areas · nothing yet | [ ] | [ ] | [ ] | [ ] | |
| 7 | All areas · member, granted only | [ ] | [ ] | [ ] | [ ] | |
| 8 | All areas · selecting areas (admin) | [ ] | [ ] | [ ] | [ ] | |
| 9 | Area · normal with groupings | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10 | Area · filtered | [ ] | [ ] | [ ] | [ ] | |
| 11 | Area · no match | [ ] | [ ] | [ ] | [ ] | |
| 12 | Area · sorted A–Z | [ ] | [ ] | [ ] | [ ] | |
| 13 | Area · files as list | [ ] | [ ] | [ ] | [ ] | |
| 14 | Area · selecting: some | [ ] | [ ] | [ ] | [ ] | |
| 15 | Area · selecting: all matching | [ ] | [ ] | [ ] | [ ] | |
| 16 | Area · empty area | [ ] | [ ] | [ ] | [ ] | |
| 17 | Area · empty grouping | [ ] | [ ] | [ ] | [ ] | |
| 18 | Area · restricted gate | [ ] | [ ] | [ ] | [ ] | |
| 19 | Area · wrong password | [ ] | [ ] | [ ] | [ ] | |
| 20 | Area · open for this session | [ ] | [ ] | [ ] | [ ] | |
| 21 | Area · no access (member) | [ ] | [ ] | [ ] | [ ] | |
| 22 | Area · final items (member) | [ ] | [ ] | [ ] | [ ] | |
| 23 | Area · restricted file tile | [ ] | [ ] | [ ] | [ ] | |
| 24 | Area · drop overlay | — | — | [ ] | [ ] | |
| 25 | Area · deep path folded "…" | — | — | [ ] | [ ] | |
| 26 | MoM · editing | [ ] | [ ] | [ ] | [ ] | [ ] |
| 27 | MoM · saving / saved | [ ] | [ ] | [ ] | [ ] | |
| 28 | MoM · saved on this device | [ ] | [ ] | [ ] | [ ] | |
| 29 | MoM · couldn't save + Retry | [ ] | [ ] | [ ] | [ ] | |
| 30 | MoM · read-only (member, final) | [ ] | [ ] | [ ] | [ ] | |
| 31 | MoM · remote change bar | [ ] | [ ] | [ ] | [ ] | |
| 32 | MoM · legacy content (W11) | [ ] | [ ] | [ ] | [ ] | |
| 33 | MoM · journal (table / phone cards) | [ ] | [ ] | [ ] | [ ] | |
| 34 | MoM · Detailed Remarks drawer | [ ] | [ ] | [ ] | [ ] | |
| 35 | MoM · table selected (bar / menu) | [ ] | [ ] | [ ] | [ ] | |
| 36 | MoM · image selected inline / floating | [ ] | [ ] | [ ] | [ ] | |
| 37 | MoM · image uploading % / failed | [ ] | [ ] | [ ] | [ ] | |
| 38 | MoM · bubble (desktop) / "/" menu | [ ] | [ ] | [ ] | [ ] | |
| 39 | MoM · Aa menu / alignment menu | [ ] | [ ] | [ ] | [ ] | |
| 40 | MoM · restricted gate | [ ] | [ ] | [ ] | [ ] | |
| 41 | Flagged · list | [ ] | [ ] | [ ] | [ ] | |
| 42 | Flagged · nothing flagged | [ ] | [ ] | [ ] | [ ] | |
| 43 | Recent · list | [ ] | [ ] | [ ] | [ ] | |
| 44 | Recent · nothing yet | [ ] | [ ] | [ ] | [ ] | |
| 45 | Deleted · list with days left | [ ] | [ ] | [ ] | [ ] | |
| 46 | Deleted · nothing deleted | [ ] | [ ] | [ ] | [ ] | |
| 47 | Account · default | [ ] | [ ] | [ ] | [ ] | |
| 48 | Account · install steps | [ ] | [ ] | [ ] | [ ] | |
| 49 | Sign in · default | [ ] | [ ] | [ ] | [ ] | |
| 50 | Sign in · wrong details | [ ] | [ ] | [ ] | [ ] | |
| 51 | Sign in · missing password | [ ] | [ ] | [ ] | [ ] | |
| 52 | Reset · default / email missing / sent | [ ] | [ ] | [ ] | [ ] | |
| 53 | New member | [ ] | [ ] | [ ] | [ ] | |
| 54 | Shared area · normal | [ ] | [ ] | [ ] | [ ] | |
| 55 | Shared area · nothing inside | [ ] | [ ] | [ ] | [ ] | |
| 56 | Shared MoM | [ ] | [ ] | [ ] | [ ] | |
| 57 | Shared file · open | [ ] | [ ] | [ ] | [ ] | |
| 58 | Shared file · password / wrong password | [ ] | [ ] | [ ] | [ ] | |
| 59 | Link unavailable | [ ] | [ ] | [ ] | [ ] | |
| 60 | Missing page | [ ] | [ ] | [ ] | [ ] | |
| 61 | Global · offline banner + sync pill | [ ] | [ ] | [ ] | [ ] | |
| 62 | Global · catching up banner | [ ] | [ ] | [ ] | [ ] | |
| 63 | Global · new version banner | [ ] | [ ] | [ ] | [ ] | |
| 64 | Global · toast with Undo / Open Deleted | [ ] | [ ] | [ ] | [ ] | |
| 65 | Global · colleague-addition toast (S1) | [ ] | [ ] | [ ] | [ ] | |

### 5.2 Dialogs, sheets and menus × states

| # | Layer · states | P·L | P·Dk | D·L | D·Dk |
|---|---|---|---|---|---|
| 66 | Create sheet (phone ＋) | [ ] | [ ] | — | — |
| 67 | New area · default / name missing | [ ] | [ ] | [ ] | [ ] |
| 68 | Rename area (emoji) / MoM / file · default / name missing | [ ] | [ ] | [ ] | [ ] |
| 69 | New grouping · default / name missing | [ ] | [ ] | [ ] | [ ] |
| 70 | Move · one / several / no destination matches / wrong-kind disabled | [ ] | [ ] | [ ] | [ ] |
| 71 | Move area (descendants disabled) | [ ] | [ ] | [ ] | [ ] |
| 72 | Upload · choose / progress / ready / 4 failure reasons | [ ] | [ ] | [ ] | [ ] |
| 73 | Save a link · default / name missing / kind guessed | [ ] | [ ] | [ ] | [ ] |
| 74 | Restrict with a password · default / mismatch / too short | [ ] | [ ] | [ ] | [ ] |
| 75 | Change or remove password · wrong current | [ ] | [ ] | [ ] | [ ] |
| 76 | Share a link · on / off | [ ] | [ ] | [ ] | [ ] |
| 77 | Access · grants / none / grant / revoke | [ ] | [ ] | [ ] | [ ] |
| 78 | Delete confirmations · area / item / several / remove forever / empty all / remove grouping | [ ] | [ ] | [ ] | [ ] |
| 79 | Image dialog · address / device / failure | [ ] | [ ] | [ ] | [ ] |
| 80 | Link dialog · add / remove | [ ] | [ ] | [ ] | [ ] |
| 81 | Attach a document | [ ] | [ ] | [ ] | [ ] |
| 82 | Link files · list / nothing yet / no matches | [ ] | [ ] | [ ] | [ ] |
| 83 | Link MoMs · list / nothing yet / no matches | [ ] | [ ] | [ ] | [ ] |
| 84 | Export as A4 PDF preview | [ ] | [ ] | [ ] | [ ] |
| 85 | Install | [ ] | [ ] | [ ] | [ ] |
| 86 | Change password · mismatch / wrong current / too short | [ ] | [ ] | [ ] | [ ] |
| 87 | ⌘K · results / no match | [ ] | [ ] | [ ] | [ ] |
| 88 | Lightbox | [ ] | [ ] | [ ] | [ ] |
| 89 | Item ⋯ menu (admin / member greyed / final blocked) | [ ] | [ ] | [ ] | [ ] |
| 90 | Area ⋯ menu, grouping ⋯ menu, split New menu, crumb "…" menu | [ ] | [ ] | [ ] | [ ] |

### 5.3 Job stories → screen → component → code

Every story in `inventory.md`. "Old" is the code it replaces (from inventory-notes §2), deleted in Phase 7.

| Story | Screen(s) | Component(s) | New code | Old |
|---|---|---|---|---|
| C1 | Today, Area, shelf, top bar, ＋ sheet, ⌘K | quick tile, split New, shelf add, place chip | `newMomIn()` `ui/mom.js`; `actions.createMom` | `newMom` |
| C2 | MoM | status pill | `onEdInput`, `scheduleSave` (0.8 s), `setStatus` | `onUpdate` autosave 1.5 s, `setSaveStatus` |
| C3 | MoM | toast, Done | `saveNow(true)`, keydown ⌘S, `done` → back to previous route | `saveMom`, `backMom` |
| C4 | MoM | title, date chip, tags | `VIEWS.mom`, `bindTagInput` | `#mt #md #mg` |
| C5 | MoM | attach chip / ⋯ | `attachDialog()` | `#mgdoc` |
| C6 | Area, MoM, Upload | upload dialog, drop overlay | `openUpload`, `pickFile`, `startUpload` → `uploads.js` | `openAddDoc`, `doUpload` |
| C7 | Area | Save a link, kind tiles | `openLink`, `guessKind` | `#tab-lk` |
| C8 | Upload | failure box + Save as link | `failUpload(code)` | `uploadCL` messages |
| W1 | MoM | toolbar, Aa, alignment | `toolbarHTML`, `textMenu`, `runCmd` | `#tt-toolbar` |
| W2 | MoM | toolbar pressed | `updateToolbar` | `updateTB` |
| W3 | MoM | table + bar/menu | `insertTable`, `updateTableBar`, column moves | `updateTableOverlay`, `_moveTableRow/Col` |
| W4 | MoM | image dialog, image controls, upload placeholder | `openImageDialog`, `insertImage`, node view | `_insertImagePrompt`, `_handleEditorImagePaste`, `ResizableImage` |
| W5 | MoM | link dialog, bubble | `linkDialog()` | `prompt('Enter URL…')` |
| W6 | MoM | Link files picker | `pickLinks('f')` → `search.js` | `openDocPicker` |
| W7 | MoM | Link MoMs picker, MoM pills | `pickLinks('m')`, pill click | `openMomPicker`, `mom.local/` interception |
| W8 | MoM | Long text cell, remarks drawer, journal bar | `decorateTables`, `openRemarks`, `syncJournal`; `content.js` migration | `isProspectJournal`, `addDetailedRemarksColumn`, `openRemarkEditor`, `decorateReadOnlyRemarks` |
| W9 | MoM | A4 export | `exportDialog` | `exportPDF` |
| W10 | MoM | — | `spellcheck="true"` on `.ed-body` | same |
| W11 | MoM, shared MoM | `.ed-body` | `content.js` legacy conversion | `deltaToHTML`, `momDeltaToHTML` |
| F1 | ⌘K, phone Search tab | palette | `paletteResults` → `search.js` | `openGlobalSearch` |
| F2 | Area | filter bar, sort seg, grid/list | `matchingKeys`, `filteredItems` | `apply*Filter`, `updateFilterEmpty` |
| F3 | Flagged, sidebar count, Today, cards, editor head | flag icon button, Flagged page | `actions.flag`, `VIEWS.flagged` | `data-starmom`, `starredTabHTML` |
| F4 | Today | continue cards, quick tiles | `VIEWS.today` | `homeHTML` |
| F4b | Today (admin) | item rows with who/where/when | `VIEWS.today` + `createdBy` | `homeHTML` recent block |
| F5 | Area, MoM | sidebar tree, crumbs, crumb fold | `crumbsHTML`, `treeHTML` | `renderBC`, `#folder-back` |
| F6 | everywhere | sidebar tree, ⌘K, Areas tab | `treeHTML`, `VIEWS.areas` | `renderTree`, `buildNode` |
| F7 | all | router | `route()`, legacy redirect | `buildHash`, `applyHash` |
| F8 | Area | header size and age line | `sizeText`, `ageText` | `folderHTML` summary |
| F9 | Area, Flagged, Recent | lightbox, open in new tab | `openFile`, `lightbox` | `openLightbox`, `data-openurl` |
| F10 | file ⋯, lightbox | Download | `download(f)` (blob, falls back to opening) | `downloadFile` |
| F11 | Area | file tiles, kind colours | `fileTileHTML`, `KINDS` | `docCardHTML` icon map |
| F13 | Recent, Today | item rows, continue cards | `session.recent`, `touchRecent` | (none) |
| F14 | file ⋯, lightbox | Copy address | `copyAddress(f)` | unwired "Copy link" |
| O1 | Today, sidebar ＋, new sub-area card, area ⋯, split New, ⌘K, ＋ sheet | New area dialog | `newAreaDialog` | `openNewFolder` |
| O2 | area ⋯ | Rename dialog with emoji | `renameDialog('a')` | `openRename` |
| O3 | area ⋯ | dest picker (areas only) | `destPicker({type:'area', exclude: descendants})` | `openBulkMoveModal('folder')` |
| O4 | Area | shelves, New grouping, Rename, Remove | `shelfHTML`, `newGroupDialog`, remove + Undo | `openNewDocFolder`, `openNewMomFolder` and counterparts |
| O5 | item ⋯ | dest picker | `moveItem`, `destPicker` | `openMoveModal`, `bindMoveSearch` |
| O6 | item ⋯ | Rename dialog | `renameDialog('m'|'f')` | `openRenameMom`, `openRenameDoc` |
| O7 | Area, All areas | selection, bulk bar | `bulkBarHTML`, `refreshBulk` | `toggleSelMode`, `selBarHTML`, `selectAllVisible` |
| O8 | all deletes | confirm dialog with impact | `confirmDialog` | `askDelete*`, `openBulkTrashModal` |
| O9 | Deleted | rows, Restore, Remove forever, Empty all | `VIEWS.deleted` | `trashHTML`, `bindTrashEvents` |
| P1 | area/file ⋯ | password dialogs | `passwordDialog` | `openLockModal` |
| P2 | Area, MoM | gate, lock pill | `lockedGateHTML`, `relock` | `unlockFolder`, `doUF`, `relock` |
| P3 | everywhere | lock in tree, cards, search | `lockedArea`, `hiddenItem` in `store.js` | `ifl`, "Password protected" meta |
| P4 | Area, visitor file | restricted tile, file gate | `fileGate` | `unlockDoc`, `doUD`, `relockDoc` |
| P5 | ⋯ (admin) | Share dialog | `shareDialog` | `openShareModal` |
| P6 | area ⋯ (admin) | Access dialog | `accessDialog` | `openAccessModal` (`rbac.js`) |
| P7 | ⋯ (admin), MoM | final mark, notice, blocked items | `final` action, `data-final` blocking | `data-togglero`, `data-toggleromom`, `momReadOnlyHTML` |
| S1 | lists, Today | live re-render, colleague toast | `Store.onChange`, `docChanges` | `startListeners` |
| S2 | MoM | remote bar | `showRemote` | `_momListener` auto-apply |
| S3 | top bar, banners | sync pill, banners | `syncInfo`, `renderBanners` | `setSS`, `#sdot` |
| S4 | all | toast with Undo / Open Deleted | `toast` | `toast` |
| A1 | all | phone layouts, tabs, sheets | media rules + `isPhone()` branches | `_setSidebar`, `@media(max-width:700px)` |
| A2 | Account | Install | `beforeinstallprompt` handler, install steps | manifest only |
| A3 | — | service worker shell cache | `sw.js` | `sw.js` |
| A4 | banner | update banner | `pwa.js` → `.banner.update` | `#sw-update` |
| A5 | all | reduced motion | `base.css` media rule | `@media(prefers-reduced-motion)` |
| A6 | all | Esc order, Enter, ⌘S, ⌘K, ↑↓↵, Tab | keydown in `ui/core.js` | global keydown |
| U1 | Sign in | auth card | `VIEWS.signin` → `session.signIn(email, pw, stay)` | `doSignIn` |
| U2 | Reset | auth card | `VIEWS.reset` | `#auth-forgot` |
| U3 | Account | Change password, Sign out | `VIEWS.account`, `changePwDialog` | `openChangePassword`, user popup |
| U4 | New member | empty screen | `VIEWS.newmember`, guard | `rbac.js` user creation |
| V1 | Shared area | visitor shell | `sharedAreaHTML` | `chkLoad` share branch |
| V2 | Shared MoM | `.ed-body` | `sharedMomHTML` | `renderSharedMom` |
| V3 | Shared file | vcard + gate | `sharedFileHTML` | `renderSharedDoc` |
| V4 | any link | unavailable | `unavailable()` | `shareLinkDenied` |

---

## 6. Reverse coverage (code → design)

Every place in the current code that produces something visible, and its new counterpart. **Delete** means it goes in Phase 7 with nothing old kept. **Gap** means it goes to the designer (§9.1). Owner-decided removals are marked **Dropped (owner)**.

### 6.1 `index.html`
| Old surface | New counterpart |
|---|---|
| `#auth-screen` (logo, title, email, password, Sign in, Forgot password) | Sign in screen, Reset screen |
| `#sidebar`: logo, Home, Search, Recent / Starred / Settings placeholders, sync row, "Workspaces" + ＋, tree, Trash, user chip | Sidebar (Today, Flagged, Recent, All areas, tree, Deleted, account); sync moves to the top bar pill. Settings placeholder: **Dropped (owner, notes §9)** |
| `#sb-close`, `#sb-toggle`, `#sb-scrim` (hide/show sidebar, phone drawer) | Phone: tabs + Areas tab. Desktop hide/show: **Gap G10** |
| `#topbar`: breadcrumb `#bc`, actions `#ta`, date chip `#tb-date`, notifications and settings placeholders | Top bar (breadcrumb, ⌘K, sync, split New, avatar). Date chip: **Dropped (owner, F12)**. Notifications: **Dropped (owner)** |
| `#ca` "Connecting to cloud..." spinner | Skeleton (design §5 Loading) |
| `#MR` modal root, `#CR` share root, `#pdf-print` | `#layers`, visitor pages; `#pdf-print` is dead code (notes §5 #12): **Delete** |
| `<meta theme-color #111827>`, Inter font link, `favicon.svg` | Two theme-color metas, self-hosted Plus Jakarta Sans, `icon.svg` |

### 6.2 `js/app.js`
| Function / place | Produces | New counterpart |
|---|---|---|
| `selButtonHTML`, `selBarHTML`, `bindSelBar`, check boxes in `fcard` / `momCardHTML` / `docCardHTML` | Select toggle, inline bulk bar | Select button, `.sel-box`, floating `.bulkbar` |
| `moveSearchHTML`, `openBulkMoveModal`, `openMoveModal` | Move dialogs with tree and search | `destPicker` (Move dialog, one or several) |
| `openBulkTrashModal` | Bulk delete confirm, first 6 names + "N more" | Delete confirmation for several items (names each one) |
| `renderSharedDoc`, `renderSharedMom`, `shareLinkDenied` | Guest file, guest MoM, link denied | Shared file, Shared MoM, Link unavailable |
| `setSS` | Sync dot + label | Sync pill + banners |
| `setSaveStatus` | "Saving…"/"Saved" text | Status pill (4 states) |
| `showCtx`, `closeCtx` (folder ⋯ context menu) | Folder menu | Area ⋯ menu (`menu()`) |
| `renderTree`, `buildNode` | Tree | Sidebar tree, Areas tab |
| `renderBC` (incl. date chip) | Breadcrumb | Crumbs + "…" fold |
| `renderTB` | Rename / Lock / Change Lock / Share buttons; Export PDF / Save | Area ⋯ menu + lock pill; editor top bar (⋯, Done) |
| `trashHTML`, `bindTrashEvents`, "Clear Trash?" modal | Trash page and confirm | Deleted page, Empty all confirmation |
| `homeHTML`, `fcard` | Home, folder cards, recently added list | Today, area cards, Recently added rows |
| `folderHTML` (summary, Back, Delete, 4 sections) | Folder page | Area page (header, crumbs, ⋯) |
| `subHTML` | Sub-folders section | Sub-area cards + New sub-area card |
| `momCardHTML`, `momListHTML` (incl. groupings, "Ungrouped") | MoM rows | MoM cards, grouping shelves |
| `docCardHTML`, `docListHTML` | File rows, file groupings | File tiles / rows, grouping shelves |
| `starredTabHTML` | Starred section per folder | Flagged page (workspace-wide) |
| `updateFilterEmpty` | "No … match" | No-match message + Clear filter |
| `momEdHTML` (back, meta, title, date, tags, Google Doc link, insert buttons, toolbar, table menu, Save / Cancel / Export / Move / Star / Read Only / Delete) | Editor | Editor top bar, meta chips, toolbar, ⋯ menu, Done |
| `momReadOnlyHTML`, `bindMomReadOnlyEvents` | Read-only MoM | Read-only state + Final notice |
| `openRemarkEditor` popover | Remarks panel | Detailed Remarks drawer |
| `updateTableOverlay` | Table bar | Table bar / Table menu |
| `_insertImagePrompt` (its own inline-styled modal) | Insert image | Image dialog |
| `_handleEditorImagePaste` (no feedback) | — | Upload placeholder with % and failure + Retry |
| `exportPDF` (html2pdf output: title, folder, date, tags, body, "Exported from Workbench · date") | PDF file | A4 export preview (Q1) |
| `openDocPicker`, `openMomPicker` | Pickers | Link files, Link MoMs |
| `openGlobalSearch` | Search modal | ⌘K command bar |
| `openNewDocFolder`, `openRenameDocFolder`, `askDeleteDocFolder`, and the MoM-folder trio | Grouping dialogs | New grouping, Rename, Remove grouping confirm |
| `askDelDoc`, `askDelMom`, `askDelMomFromCard`, `askDeleteFolder` | Delete confirms | Delete confirmations with impact |
| `openRenameMom`, `openRenameDoc`, `openRename`, `openNewFolder`, `emRow` | Rename / New folder / emoji row | Rename dialog, New area dialog, emoji grid |
| `downloadFile` ("Downloading..." toast) | Download | Download (toast per design copy) |
| `openAddDoc` (upload/link tabs, drop zone, progress, "up to 100MB") | Add document | Upload dialog + Save a link dialog (fixes the copy, notes §5 #10) |
| `openShareModal` | Share modal | Share a link dialog |
| `openLockModal`, `unlockFolder`, `doUF`, `unlockDoc`, `doUD`, `relock`, `relockDoc` | Lock / unlock dialogs | Password dialogs, restricted gate, lock pill. File re-lock: **Gap G5** |
| `openLightbox` | Lightbox | Lightbox (+ Download, Copy address) |
| `modal`, `closeModal` | Modal shell | `layer()` |
| `toast` (40 calls, 2.2 s, plain text) | Toasts | `toast()` with icon, action, 4.2 s; every message rewritten in the design's copy (§6 of the guide) |
| `alert()` ×5: lines 1557, 1583, 1632, 1633, 1646 | "Please enter a name." / "Please select a file first." | Inline field error (`.field.err`, "Give the … a name …") |
| `prompt()` ×1: line 1248 | Link URL | Link dialog (W5) |
| `window.open(url,'_blank')` in open / download fallback | New tab | Same, plus the design's toast ("… opened in a new tab") |
| Every Firestore write `.catch(console.error)` (no UI) | Nothing | Save status "Couldn't save"; other writes: **Gap G9** |
| `_setSidebar` and resize handler | Phone drawer | Removed (phone uses tabs) |

### 6.3 Other files
| Place | Produces | New counterpart |
|---|---|---|
| `auth.js` `doSignIn` errors ("Please enter your email and password.", "Wrong email or password.", raw `e.message`) | Sign-in errors | Sign in states ("Couldn't sign you in", missing password); unknown errors mapped to the same plain message |
| `auth.js` forgot password ("Enter your email above first.", "Reset link sent! …") | Reset feedback | Reset screen states |
| `auth.js` `openChangePassword` | Change password modal | Change password dialog (Account) |
| `auth.js` `#user-popup` (name, email, role, Change password, Sign out) | User menu | Account page (and avatar → Account) |
| `auth.js` anonymous: hides `.sb-foot` | Guest chrome | Visitor shell (`body.visitor`) |
| `rbac.js` role label into `#sb-urole`, hides `#btn-new-folder` | Role chip | Role pill; admin-only ＋ hidden for members |
| `rbac.js` `openAccessModal` (inline-styled rows, select, Grant, Revoke, "No one else…", "All members already…") | Access modal | Access dialog (incl. "Only admins can see this" and nobody-left states) |
| `pwa.js` `#sw-update` ("A new Workbench version is available. Refresh") | Update banner | Banner `.update` |
| `tiptap.js` `ResizableImage` node view (📌 Pin to text / ✋ Float / 🗑 Remove, resize handle) | Image controls | Image component (Inline / Float / Remove, Drag, corner resize) |
| Tiptap content (`.tiptap` styles in `styles.css`: headings, lists, quotes, tables, links, colours, images) | Note body | `.ed-body` styles |
| `styles.css` `@media print` + `#pdf-print` | Dead print styles | **Delete**; the A4 export's print rules come from `editor.css` |
| `manifest.webmanifest` (name Workbench, theme `#111827`, portrait lock, `favicon.svg`) | Install identity | Prototype manifest (name per Q2; no orientation lock; `icon.svg`; theme `#4338CA`; background `#F7F8FC`) |
| `sw.js` (cache list; caches every navigation as `index.html`) | Offline shell | Rewritten (Phase 2 fixes the navigation caching first, see Phase 2) |
| `favicon.svg`, `brand-proposal/` | Old brand | `icon.svg`. `brand-proposal/` isn't served or referenced; deleting it is the owner's call (Q6) |
| Upload progress (`#uprog`, `#upbar`, status text) and failures | Progress + errors | Upload dialog progress % and failure box |
| Cloudinary error copy ("…Cloudinary → Settings…", "Cloudinary auth error…") | Technical errors | C8 reasons: storage set-up problem / type not allowed / too large / network |

---

## 7. Phases

Every phase is built on the **`redesign` branch**, deployed to a **Vercel preview**, and keeps tests green. Every commit pushes to `redesign` (the auto-push rule applies to the branch, not to `main`). Merge `main` into `redesign` whenever `main` changes.

### 7.0 Who builds it: model and effort per task

The cheapest model that can do each task safely. Switch with `/model` (and the effort setting) at the start of each session. **One task per session**, and give the session only what it needs: this plan's section for the task, the design-guide section, and the matching prototype file and function. That keeps a smaller model from reading the whole old `js/app.js` and copying old patterns.

**Tiers**
- **Haiku 5.5 · high:** mechanical porting with an exact reference. The prototype already shows the result; the work is copying and wiring.
- **Sonnet 5.5 · high** (or Haiku 5.5 · xhigh, if the trial below shows it's good enough): many rules to keep track of, with real data, but nothing that can damage stored data or the live app.
- **Opus 5.5 · high:** the work where a subtle mistake breaks the live app, loses notes, or is hard to undo, plus deep Tiptap and Firestore behaviour.
- **Opus 5.5 · medium:** needs Opus's knowledge of Tiptap or Firestore, but the task is clearly specified, so less reasoning per step is enough.
- **Opus review:** at the end of every phase, a fresh Opus session reviews the phase's diff against this plan and the prototype before the phase counts as done. Reviewing costs far less than writing, and it catches drift from the prototype.

| Phase | Task | Model · effort | Why |
|---|---|---|---|
| 1 | ✅ Move data code into `js/data/`, `Store.onChange`, write promises | **Opus · high** | Every Firebase call must move with no visible change; a slip breaks production |
| 1 | ✅ `sw.js` navigation-cache fix | Sonnet · high | Small, but service-worker bugs are hard to see |
| 2 | ✅ Copy `tokens.css`, port the 3 stylesheets, `app.css`, fonts, icons sprite | **Haiku · high** | Copying with exact references |
| 2 | ✅ `next.html` shell, theme boot script | Haiku · high | Copying from `prototype/app.html` |
| 2 | ✅ `ui/core.js`: delegation, layers, menus, toasts, router, legacy redirects, keyboard model | Sonnet · high | Shared foundation every screen depends on; routing and Esc order need care |
| 2 | ✅ `ui/shell.js`: sidebar, rail, top bar, tabs, tree, crumbs | Sonnet · high | Real data, permissions, restricted areas, crumb folding |
| 2 | ✅ Data additions: sync state, persistence, visibility rules (`canSee`, `lockedArea`, `hiddenItem`, …) | **Opus · high** | Decides what members and visitors can see (P3, P6); offline persistence |
| 3 | ✅ Components and every state in `dev/gallery.html` | **Haiku · high** | Each one has an exact prototype counterpart |
| 4 | ✅ **MoM editor**: Tiptap rebuild (toolbar, Aa, bubble, "/" menu, tables, Long text, remarks drawer, images), autosave and status | **Opus · high** | Daily tool and the riskiest part (C1–C3, W1–W8) |
| 4 | ✅ Prospect-journal and legacy-content conversion (`content.js`) | **Opus · high** | Changes stored notes |
| 4 | ✅ Area page: header, filter, sort, grid/list, cards, shelves | Sonnet · high | Many states and rules |
| 4 | ✅ Today, All areas / Areas tab | Sonnet · high | Permissions, restricted hiding, recent |
| 4 | ✅ ⌘K command bar, Move dialog (`destPicker`), selection and bulk bar, Undo | Sonnet · high | Keyboard behaviour, access rules, several-item flows |
| 4 | ✅ Flagged, Recent, Deleted, Account | **Haiku · high** | Simple lists with exact prototype counterparts |
| 4 | ✅ Dialogs: New area, Rename, New grouping, Save a link, Share, Access, confirmations, Install | Haiku · high | Fixed forms and copy |
| 4 | Upload dialog with progress and the 4 failure reasons | Sonnet · high | Error mapping and Cloudinary edge cases |
| 4 | Password dialogs, restricted gates, Lock again | Sonnet · high | Security-sensitive logic |
| 5 | Empty, loading, no-match and member states | Haiku · high | Fixed copy and markup |
| 5 | Offline, "Saved on this device", couldn't save + Retry, catching up | **Opus · medium** | Needs Opus's knowledge of Firestore offline behaviour, but the states are clearly specified |
| 5 | Remote change bar (S2), colleague toast (S1) | **Opus · high** | Applying someone else's changes while you type, without losing your place or unsaved edits; the most subtle logic in the app |
| 6 | Sign in, Reset, New member, Missing page | Haiku · high | Fixed screens |
| 6 | Guest views, `visitor` role, old share-link redirects | Sonnet · high | Access rules for people without accounts |
| 6 | `.ed-body` content styles, A4 export, print | Sonnet · high | Check against real old notes |
| 6 | Manifest, icons, theme-color, new `sw.js`, `pwa.js` banner | Sonnet · high | Service-worker caching |
| 7 | Switch-over commit and deletions | Sonnet · high | Mostly deleting files and running the old-names check and tests; the phase's Opus review is the safety net |
| 7 | Old-names check script | Haiku · high | Simple script |
| 8 | Playwright tests from §8.1 | Haiku · high | Written from the behaviour table |
| 8 | Screenshot capture script, axe and keyboard checks | Sonnet · high | Test tooling |
| 8 | Fixing failures found in QA | The tier of the task the bug is in | — |

✅ = done (also ticked in that phase's task list below).

**Calibrate before committing to it.** Build one Sonnet-tier task (the Move dialog is a good one) twice: once with Sonnet · high and once with Haiku · xhigh. Run `/cost` after each session, check both against the prototype, and keep the cheaper one if it's just as good. Move a task up a tier the first time a cheaper model gets it wrong twice.

### Phase 1: Separate data from rendering (no visual change)
**Tasks**
- [x] 1. Create `js/data/firebase.js`, `session.js`, `store.js`, `actions.js`, `uploads.js`, `content.js`, `search.js`. Move the functions listed in 2.5 **verbatim**, keeping their names and globals.
- [x] 2. Make each write return its promise (no caller changes needed).
- [x] 3. Replace the direct `render()` calls inside listeners with `Store.onChange` callbacks. The old `app.js` registers its own `render`.
- [x] 4. `index.html` loads `js/data/*.js` before the old `js/app.js`.
- [x] 5. Fix `sw.js` so navigations are cached under their own URL (it currently stores every navigation as `index.html`, which would let `next.html` overwrite the offline copy later). Bump the cache name.

**Notes from tasks 1–4 (2026-10-13):**
- `Store.onChange(fn)` passes `fn(what, err)`. `what` is a collection name, `'loaded'` (once), `'error'`, or a session event (`'guest'`, `'role'`, `'access'`, `'users'`). `app.js` keeps the old per-collection render conditions in its handler, and the old chkLoad UI step is now `onStoreLoaded()`, which runs before any render so deep-link hashes survive.
- New names: `watchMom` (the editor's per-MoM listener), `searchWorkspace` (search matching), `grantAccess`/`revokeAccess`, `signIn`/`sendReset`/`changePassword`/`signOut`, `startSession` (role/access loading, still started from `rbac.js` at the old timing).
- Move, rename, flag, final, share and password changes are still inline field edits in the old UI followed by `sF`/`sM`/`sD`. No named action functions exist for them yet; they get added when the new UI needs them.
- Left in `app.js` on purpose: `esc` and `uid` (the prototype's `core.js` declares `const esc` / `let uid`, so the data layer must not), and the two inline image uploads in the editor.
- `index.html` loads `app.js`, `auth.js` and `rbac.js` with `?v=2`. The current `sw.js` serves app files cache-first under an unchanged cache name, so installed clients would otherwise run the old `app.js` and `auth.js` next to the new data files and fail on the redeclared `db` and `auth`. Task 5 fixed this on the service-worker side (see below).
- Checked: `node -c` on every file, no global declared twice, and the auth tests that need no account pass locally. **Not yet run:** the signed-in Playwright tests (no `TEST_EMAIL`/`TEST_PASSWORD` on this machine). Run them against the preview before Phase 1 counts as done.

**Notes from task 5 (2026-10-13):** `sw.js` now saves each page under its own address (only when the response is OK), so one page can never overwrite another's offline copy. Cache name is `workbench-static-v4`. The precache list has the 7 `js/data/*.js` files and the three `?v=2` scripts exactly as `index.html` names them (the cache key includes the query, so **if `?v=` ever changes in `index.html`, change it here too**). Our own files are now **network first** with the cache only as the offline fallback, so a deploy is never served from an old copy; Firebase, Quill and html2pdf stay cache first. An uncached page offline falls back to `index.html` only for `/` and `/index.html` addresses, so `next.html` will never show the old app. Tested in Chromium against a logging server: precache contents, own-address caching, `index.html` entry untouched, network-first while online, and offline opens for cached, uncached-old-app and uncached-other addresses. The same test fails on the old `sw.js`. Not tested: Safari and the installed app on a real phone (§8.4). The `?v=2` on the three scripts can be dropped once every installed copy has the new worker (it is harmless meanwhile).

**Files:** `js/data/*` (new), `js/app.js`, `js/auth.js`, `js/rbac.js`, `index.html`, `sw.js`.
**Done when:** the preview looks and behaves identically; all existing Playwright tests pass against the preview URL; `js/app.js` has no `db.collection` calls left.

### Phase 2: Tokens, base styles and the app shell
**Tasks**
- [x] 1. `css/tokens.css` (copy), `css/base.css`, `css/views.css`, `css/editor.css`, `css/app.css` (2.3 rules); `fonts/` with `@font-face`.
- [x] 2. `next.html` with the shell skeleton (2.6), the theme boot script, and script tags.
- [x] 3. `js/ui/icons.js`, `js/ui/core.js` (delegation, `layer`, `menu`, `confirmDialog`, `toast`, router + guard + legacy-address redirect, `render`, skeleton, banners, keyboard model).
- [x] 4. `js/ui/shell.js`: sidebar, tablet rail, top bar (breadcrumb, ⌘K trigger, sync pill, split New, avatar), phone top bar, tab bar, tree. Use placeholders only for screens that don't exist yet.
- [x] 5. Data-layer additions: sync state, `enablePersistence`, the visibility rules from 2.5.
6. Signed-out visitors to `next.html` are sent to `index.html` (temporary, removed in Phase 6).

**Done when:** `next.html` shows the real tree, crumbs and sync state at 390 / 900 / 1280 px in light and dark, with the shell matching the prototype; reduced motion is respected; old tests still pass on `index.html`.

**Notes from Phase 2 tasks 1–2 (2026-10-13):**
- **Stylesheets.** `css/tokens.css` is a byte-for-byte copy (`cmp` identical). `css/views.css` and `css/editor.css` are copied unchanged from the prototype. `css/base.css` is the prototype file minus the `.demo-link` rules and the "Prototype panel" section, including its `.proto` lines inside the two responsive blocks (16 lines removed). `css/app.css` holds the `@font-face` rules and the Tiptap internals, scoped under `.ed-body` (the editor root is `.ed-body.ProseMirror`). Colours in `app.css` are tokens only.
- **Font.** There were no font files in the repo, so `fonts/PlusJakartaSans-latin.woff2` and `fonts/PlusJakartaSans-latin-ext.woff2` were downloaded from Google Fonts (variable 400–800, OFL licence). The `unicode-range` values are Google's. Phase 6 checks the Google Fonts link is gone everywhere.
- **Icons (part of task 3).** `js/ui/icons.js` is the prototype sprite (87 icons), with a guard so it is injected once and an id `icon-sprite`.
- **`next.html`.** Skeleton from §2.6 with the prototype's `.proto` panel removed. The `#topbar` id is not used (`topbar` is an old element id under §10); the `.topbar` class is kept. The prototype's description and the manifest and icon links are left out until Phase 6. The `<title>` is a placeholder ("Workbench") until Q2. The theme boot script is the 3-line inline script in `<head>`, before the stylesheets, and reads `G_theme`. The Firebase compat scripts carry SRI hashes (9.23.0). Script tags cover `js/ui/icons.js` and `js/data/*.js`; `ui/core.js`, `ui/shell.js` and the others get their tags with their own tasks. Quill, html2pdf and Tiptap are not loaded here.
- **Checked:** Chromium smoke test (30 checks) at 390, 900 and 1280 px: no page errors, shell elements present, no prototype panel, sprite injected once with 87 symbols, the font loads from `fonts/`, body font is Plus Jakarta Sans, none of the 31 old ids are present, `G_theme` dark / light / system / unset behaves as specified, dark and light backgrounds differ, the boot script sits before the stylesheets, and no horizontal scroll at any width. `index.html` is unchanged. Not checked yet: a visual comparison with the prototype (Phase 3 gallery and §8.2), and the font's latin-ext subset (it loads only for non-Latin text).

**Notes from Phase 2 tasks 3–4 (2026-10-13):**
- **Files.** `js/ui/core.js`: helpers, the `UI` state object, roles, delegation (`on` / `onForm` / `onInput`), `layer`, `menu`, `confirmDialog`, `toast`, router, `guard`, `legacyAddress`, `render`, skeleton, banners, keyboard, and `boot()`. `js/ui/shell.js`: sidebar (the tablet rail is the same markup under the CSS), top bar (breadcrumb with folding, ⌘K trigger, sync pill, split New, avatar; the editor bar and the phone bar), tab bar, tree, split New menu, create sheet, and the Esc climb. Both have script tags in `next.html` after the data files.
- **Nothing runs until `boot()` is called** by the last script on the page (`ui/app.js`, not written yet; it will load the view files and call `boot()`). Before that the files only register handlers, so `next.html` stays quiet.
- **Contract for the data-layer task (Opus, task 5).** The shell and core call these **by name** and do not define them. Task 5 now defines all of them in `data/store.js` (see its notes below):
  - `canSee(areaId)` → boolean.
  - `lockedArea(areaId)` → the restricted area (this one or an ancestor) that is not opened this session, else `null` (reads `UF`).
  - `hiddenItem(kind, item)` → boolean. `kind` is `'m'` (MoM) or `'f'` (file); the item has `folderId`.
  - `visibleAreas()` → folder objects this viewer may see.
  - `crumbPath(areaId)` → folder objects, ancestor first, starting at the viewer's grant (member) or shared root (visitor). Esc and the crumbs use it, so it also decides how far up anyone can climb.
  - `Store.sync` → `'ok' | 'catchup' | 'offline'`, plus a `'sync'` event through `Store.onChange`. Until it exists the browser's online flag decides (tested).
  - Fields read: area `icon`, `pw`, `parent`, `name`; MoM `folderId`, `momFolderId`, `title`, `starred`, `readOnly`; file `folderId`, `starred`.
  - The roles (`admin`, `member`, `newmember`, `visitor`, `signedout`, `loading`) are derived in `core.js` `sessionRole()` from `auth.currentUser`, `CURR_USER_ROLE`, `FA` and the session events `'role'`, `'access'`, `'guest'`. `session.js` is unchanged. Task 5 may move that function into the data layer.
- **Decisions.** The prototype's derived reads (`area`, `mom`, `chainOf`, `visibleRoots`, `countsOf`, `deletedCount`) live in `core.js`, over the real collections, because the old page also loads `store.js`. The data layer's own `momsOf` and `docsOf` are not redeclared. Unlock state stays in `UF` / `UD`, so `UI.unlocked` from the plan's list does not exist. Flagged is `starred`, Final is `readOnly`. The top bar is found by its `.topbar` class (`topbar` is an old id).
- **Beyond the prototype, on purpose.** Route parts are split before they are decoded, and a bad `%` escape is ignored (a pasted address cannot break the page). Tab stays inside the top layer (the dialogs are `aria-modal`). After navigating, focus lands on the page, and redrawing the bars keeps focus on the same control. Esc goes up only as far as `crumbPath` allows, so a member never climbs above their grant. A role is `loading` until Auth, the user record and the access list are read, and the skeleton shows until all five collections have loaded (so a member never sees "No areas shared with you yet" by mistake). An action registered twice, or clicked before it exists, warns in the console. A signed-out visitor on a `#/s/…` address is let through, because the anonymous sign-in is still on its way (Phase 6 finishes this).
- **Placeholder:** a route with no registered view shows "This screen isn't built yet (name)". Remove it when the screens exist (Phases 4–6).
- **Not in these tasks, still to do:** the ⌘K bar (`palette`), `destPicker` and the place chip's `pick-place`, the dialogs behind `new-mom`, `upload`, `save-link`, `new-group` and `new-area`, and the editor's `flag`, `editor-menu` and `done`. Clicking one of them logs a warning for now. Also Phase 2 task 6.
- **New classes** (in `app.css`): `skel-title`, `skel-line`, `skel-cards`, `skel-card`, `is-leaving`, `side-who`, `place-chip-sheet`. Check them against `redesign/old-names.txt` once it exists (not done: the old stylesheet was not opened).
- **Checked (Chromium, 142 checks, plus the 30 shell checks):** with stand-ins for the five functions above (prototype rules, fake data): router for every address; guard for every role; legacy addresses (13 cases, including encoding and precedence); layers, focus trap, focus return, Esc order (layer, then Select, then editor, then area); menu with admin-only lock and the plain message for members; confirmation; toasts (3 at most, action, fade); hostile area names and emoji shown as text and running nothing; tree roles, levels, expansion saved to `G_exp`, locked rows, counts; crumb folding and its menu; editor bar (Saved, Final · read only, flag pressed); phone bar and create sheet; skeleton, empty states, member view, coalesced redraws; banners for offline, catching up and update. Real boot with no session lands on `#/signin` with no errors, rewrites `?folder=` to `#/s/a/…`, and shows and clears the offline banner when the browser goes offline and back. **Not checked:** the real visibility rules (task 5), a real signed-in session, and a visual comparison with the prototype.

**Notes from Phase 2 task 5 (2026-10-13):**
- **Offline copy (`enablePersistence`) is opt-in per page.** `data/firebase.js` turns it on only when its script tag says `data-persist="on"`, which `next.html` does and `index.html` doesn't. The old app keeps exactly its current behaviour until cutover, when `next.html` becomes `index.html` and brings the flag with it. `PERSISTENCE` reads `'off' | 'pending' | 'on' | 'failed'`; on `'failed'` (private window, old browser) the app works online only. Phase 5 uses this for "Saved on this device" (plan §9.3).
- **Sync state.** `Store.sync` is `'ok' | 'catchup' | 'offline'`, with a `'sync'` event when it changes. `offline` means the browser reports no connection. `catchup` means the data shown is not yet confirmed by the server (`snapshot.metadata.fromCache`). It is only reported once all five collections have loaded (the skeleton covers the time before). Our own pending saves do not count as catching up; the editor's status pill covers those (Phase 4–5). Known limit: online but unable to reach Firestore shows "Catching up" until it can.
- **Listeners and the old app.** The five listeners now ask for metadata changes (needed for the above), but a metadata-only snapshot never replaces the data or emits a collection event, so `app.js` gets exactly the events it got before (checked against real Firestore: reconnecting emits only `sync`). The old `Store.onChange` handlers in `app.js` and `rbac.js` ignore `sync`.
- **Purge waits for the server.** `'loaded'` still fires on the first copy of all five collections (it may now come from the device). The automatic purge of week-old deleted items waits until all five have been confirmed by the server, because a stale device copy could otherwise remove forever something a colleague restored in the meantime.
- **Visibility rules (`data/store.js`).** All read who is signed in through `sessionUser()` at call time.
  - `canSee(areaId)`: nobody sees a missing or deleted area. Signed out sees nothing. A visitor (anonymous session) sees only `Store.visitRoot` and what is inside it, and only if that area's link is on (`shared === true`); a sub-area whose own link is off (`shared === false`) is hidden with everything under it. An anonymous session never gets admin visibility, whatever `CURR_USER_ROLE` says. Admins see every area. Members see the areas granted to them in `folder_access` and everything inside.
  - `lockedArea(areaId)`: the highest restricted area on the path not opened this session (`UF`). `lockedFile(f)`: own password not entered (`UD`), or inside a locked area.
  - `hiddenItem(kind, item)`: hidden if its area isn't visible, it is inside a locked area (MoM) or locked (file), or, for visitors, its own link is off. It includes the `canSee` check, so a caller can't forget it.
  - `visibleAreas()`, and `crumbPath(areaId)`: admins from the top, members from their highest grant, visitors from their shared area, and empty when the area isn't visible. Esc climbs only that far.
  - `areaChain(id)`: the parent chain, safe against broken or circular parents (the old `pathTo` would hang). `core.js` `chainOf` and `descIds` now use it or guard the same way.
  - **For Phase 6:** `Store.visitRoot` must be set by the visitor pages from the `#/s/a/:id` address. Until then a visitor sees nothing (safe default). Restricted sub-areas inside a shared area follow `lockedArea` (gap G8 is still open).
- **Not done here (on purpose):** `sizeText` and `ageText` from the 2.5 table are display text built on `countsOf` (in `core.js`); they move with the Area page (Phase 4). The `visitor` role in `session.js` and colleague events (S1) belong to Phases 6 and 5. `sessionRole()` stays in `core.js`.
- **Checked:** 42 checks on the rules and the listener logic with fake snapshots: event order (`loaded` before the collection event), empty first snapshots, metadata-only snapshots emit nothing, purge only after server confirmation and only once, `sync` for cache, server, offline and back. Every rule for signed out, admin, member, new member and visitor, locks and unlocks, two restricted levels, a circular parent chain, an item in a deleted area. Real Firestore: the old app over a share link reaches "Live" with its own page and no errors. On `next.html` the offline copy turns on, loads from the server (sync ok, purge runs), and a fresh page with Firestore's network cut loads all 638 items from the device copy (sync catchup, no purge), then catches up to ok and purges once when the network returns. The shell over the real rules (no stand-ins): member tree, crumbs, lock, Flagged count and Esc stop at the grant (149 checks in total now). The old app's 3 sign-in tests pass, and the shell smoke test passes. **Not checked:** a real member or admin session (no test accounts, Q4), Safari's IndexedDB, and two tabs open at once.

### Phase 3: Components (all variants and states)
**Tasks**
- [x] 1. Build every component in §3 with every listed state.
- [x] 2. Add `dev/gallery.html`: one page rendering every component in every state, using only the new CSS and `ui/core.js` builders with fixed sample data. It's used for screenshot comparison and accessibility checks, and deleted in Phase 7.

**Done when:** each §3 row is ticked in the gallery at phone and desktop, in light and dark; keyboard and focus work on every interactive component; no raw colour exists outside `tokens.css`.

**Notes from Phase 3 (2026-10-13):**
- **Where the builders are.** All Phase 3 builders are pure functions in `js/ui/core.js` (data in, markup out, no store reads, no inline styles or handlers): buttons, fields, pills, cards and rows, shelf, layers, toasts, banners, bulk bar, ⌘K rows, the editor parts (toolbar, Aa, bubble, "/" menu, table bar, tables, Long text cell, remarks drawer, journal bar, image, link pills, remote bar, A4) and the states. `ui/shell.js` keeps the navigation builders from Phase 2, now using `splitNewHTML`, `syncPillHTML` and `data-depth`. The plan's per-screen file names (`area.js`, `mom.js`, ...) apply when those screens are built (Phase 4); the Phase 3 names are kept distinct (`shelfBoxHTML`, `bulkPillHTML`, `lockedGateHTML`, `toolbar` as `editorToolbarHTML`) so they do not collide later. Rename at Phase 4 if a screen file takes the old name.
- **Gallery** (`dev/gallery.html`): 138 states in nine sections (3.1–3.9), each cell captioned. It loads only `store.js`, `core.js`, `shell.js` and the icon sprite, with fixed sample data (no Firebase). Its own page styles only place the fixed-position layers, toasts and bars in the page; they are dev-only and go with the gallery in Phase 7.
- **Fixed in this phase:** the shipped sheet uses `.locked` for the restricted gate, so `.mi.locked` drew menu items as gate cards. Greyed items now use `aria-disabled` only. Inline styles from the prototype are named rules in `app.css` (same values); the tree depth is `data-depth`.
- **Focus** is the shared `--focus` ring on every control, including the ones that set their own shadow (sub-area and new-sub-area cards, soft and bulk buttons, tag field, ⌘K field, toast action). Enter and Space act on check boxes (`role=checkbox`) as a click.
- **Touch** (checked with a coarse pointer at 390 px): every control is at least 44 × 44 px. The base sheet sized several below that (tag remove, tree toggles, link buttons, Aa segments, banner and bulk-bar buttons, toast action); `app.css` has a coarse-pointer block that raises them to `--hit`. Inline text links inside a sentence (the note's link pills) are exempt, as WCAG 2.5.8 allows.
- **Checked (Chromium):** the gallery loads with no page errors; all nine sections filled; no inline style or handler in any cell; all 353 keyboard stops show a focus ring; no target under 44 px with a coarse pointer; no horizontal overflow at 390 px; light and dark differ; screenshots of the sections reviewed for layout (menus, layers, palette, sidebar and rail states, top bar, editor parts). Fixed in review: member sidebar in the gallery used the admin's id, the bubble animation hid its icons, tables needed the editor's content class.
- **Not done (Phase 3 done-when is not yet met):**
  - **No raw colour outside `tokens.css`.** Blocked on G11 (below): the inherited `base.css` and `editor.css` values, the six text colours and six highlights in `app.css` (`.sw-*`) and in `core.js` (`SWATCH_TEXT`, `SWATCH_HL`), and `js/data/content.js` (`#9CA3AF` in the empty-content placeholder, moved verbatim in Phase 1; it changes with the legacy-content work in Phase 4).
  - **Radio groups** (emoji grid, kind tiles) are one tab stop per option. Arrow-key movement inside a group is for Phase 4 with the screens that use them.
  - **Visual comparison with the prototype** (§8.2 side-by-side) and the **real tablet rail** at 768–1023 px are not yet checked; the rail is CSS only.
  - **Not checked:** Safari, and VoiceOver (plan §8.3 is Phase 8).

### Phase 4: Screens, one at a time
Order follows the owner's priorities (daily jobs first): **MoM editor → Area → Today → ⌘K → All areas / Areas tab → Flagged → Recent → Deleted → Account**, plus the dialogs each screen opens.

Each screen is done when its §4 map is implemented against real data, its default-state rows in §5 are ticked, and its new Playwright tests (§8) pass on `next.html`. For the editor this includes the Tiptap rebuild (`js/editor/tiptap.js`: ResizableImage view, Long text and journal attributes, SlashCommand, BubbleMenu wiring) and the content migration (2.8).

**Tasks** (from §7.0; ticked when built and tested; the screen's §5 rows are ticked after the visual check)
- [x] MoM editor: Tiptap rebuild (toolbar, Aa, bubble, "/" menu, tables, Long text, remarks drawer, images), autosave and status
- [x] Prospect-journal and legacy-content conversion (`content.js`)
- [x] Area page: header, filter, sort, grid/list, cards, shelves
- [x] Today, All areas / Areas tab
- [x] ⌘K command bar, Move dialog (`destPicker`), selection and bulk bar, Undo
- [x] Flagged, Recent, Deleted, Account
- [x] Dialogs: New area, Rename, New grouping, Save a link, Share, Access, confirmations, Install
- [ ] Upload dialog with progress and the 4 failure reasons
- [ ] Password dialogs, restricted gates, Lock again

**Notes from the MoM editor and content conversion (2026-10-13):**
- **Files.** New: `js/editor/tiptap.js` (the only module), `js/ui/mom.js`, `js/ui/app.js` (calls `boot()`; `next.html` now runs). Changed: `js/data/content.js` (lazy Quill, `toEditorHTML`, `journalize`), `js/data/actions.js` (`newId`, `createMom`, `updateMom`, `setFlag`, `setFinal`, `convertMomContent`), `js/ui/core.js`, `js/ui/shell.js`, `css/app.css`, `next.html`. The old `js/tiptap.js` is untouched (the old app still uses it).
- **Tiptap is pinned** to 2.27.3, every package imported with `?deps=@tiptap/core@2.27.3,@tiptap/pm@2.27.3`, so all of them share one core and one ProseMirror (checked: all resolve to the same core build). This closes the §9.3 version-pinning risk for the new editor.
- **What a save writes.** Only the fields that changed, with `update()` (not the old whole-document `set()`), plus `edited` and `editedBy` (plan 2.8). Saves 0.8 s after typing stops; ⌘/Ctrl+S, Done, leaving the page, hiding the tab and closing it all save at once. Status: Saving… → Saved; "Saved on this device" when offline; "Couldn’t save" + Retry when refused (what failed is kept and sent again). New MoMs: same fields as the old app plus `created` and `createdBy`, titled "Meeting – {date}" as the prototype does.
- **Stored HTML stays the old editor’s.** Checked read-only against every MoM in the live database (357, 72 of them still Quill): the new editor’s output is byte-identical to the old editor’s for all 357 (after removing the pill class on links, which is new and harmless), nothing errors, no text, image, table, link or list item is lost, and Quill notes convert the same way. Two notes change on a second pass in both editors alike (Tiptap drops an empty `<span>`). Images stay inline `<img>` with `style="width:…"` and `data-px` / `data-py`; MoM links stay `https://mom.local/{id}`; file links stay the file’s address. Dates stay milliseconds; a chosen date is stored at local midnight (shows the same day in every time zone, in both apps).
- **Old notes (W11).** A Quill note loads Quill on demand (cdnjs, pinned with integrity) and opens converted; nothing is saved until it is edited. If Quill can’t load (offline, first visit), the note is not opened empty: it shows “This note couldn’t be opened” with Try again, and the editor stays closed, so it can’t be saved over.
- **Prospect journal (W8, 2.8).** `journalize()` works on an inert parsed copy (nothing in a note can run or load), changes attributes only (adds the Detailed Remarks column first if a journal lacks one, as the old app did) and is idempotent. On first open of a “Clients - Prospect Journal” MoM, the conversion is written with a Firestore transaction that writes only if the stored content is still the one converted, and keeps the original once in `contentBackup`. Offline, the next save carries the backup instead. **No MoM with that title exists in the live data today** (checked read-only, deleted ones included), so nothing has been converted; it is covered by fixture tests (column present, column missing, no table, idempotent, hostile markup, other attributes kept).
- **Long text.** The heading cell carries `data-coltype="longtext"`, the table `data-template="prospect-journal"`. The badge, the two-line preview with its expand button, the cell labels for phone cards and the `journal` class are decorations, never stored. The drawer edits plain text and writes back only when the text changed (a remark with bold or lists keeps its formatting unless it is edited in the drawer, where it becomes plain text, as in the old app).
- **Shared actions now in `core.js`**, for the next screens to reuse: `flag`, `final`, `delete-item` / `delete-item-now` / `go-deleted`, the `unlock` form (restricted gate), `pick-date`, `pickFiles()` with `#fileInput`, and `docKind()`. New in `core.js`: views may return `null` from `html()` (not ready, the skeleton stays) and may have `unmount()` (the editor saves and closes); `onKey()` for per-field keys; buttons inside `[data-keepfocus]` keep the editor’s focus; Esc defers to a menu that used it.
- **Beyond the prototype, on purpose.** The selection bubble is positioned by the editor (not Tiptap’s BubbleMenu, which uses its own positioning) and flips below the selection when the toolbar is in the way. A floating image stored for a wide screen is kept inside the note on a narrow one (its stored place is unchanged). Long text decorations also apply to tables inside table cells. Upload placeholders are decorations, so a half-finished upload is never saved into the note. Moving rows and columns refuses tables with merged cells.
- **Not done here:** Export as A4 PDF (Phase 6), Move to… (the Move dialog task), Share a link (Dialogs task): their menu items are there and log a warning until built. The remote change bar (S2) is a first version (shows a colleague’s save, applies it keeping your place); Phase 5 owns the edge cases (typing while it arrives, Phase 5 row). Phone image controls (Inline / Float / Remove) show on desktop only; on phone, Backspace removes an image.
- **Checked (Chromium):** editor end to end with fake data and every write recorded, nothing sent (101 checks): open, pills, images, stored format; autosave, ⌘S, failure + Retry; toolbar, bubble, Aa, alignment, Undo, link dialog; "/" menu with filter, Esc and Enter; tables (rows, columns, moves, Long text, delete + Undo); images (select, float, resize, upload placeholder, failure + Retry, by address); Link MoMs / Link files (hidden items excluded, no matches, insert, pill click); leaving saves; title, tags, date, Done; journal conversion, bar, drawer (text and fields), locks on the journal column, New entry, no second conversion; Quill note; member on a final MoM; restricted gate; colleague’s save; New MoM, flag, final, delete; phone layout. Plus floating-image drag (5), conversion fixtures and lazy Quill (13), the read-only check on all 357 live MoMs, and every earlier suite again (core/shell 149, data 42, gallery, shell smoke, old app sign-in 3, old app and next.html on real Firestore). **Not checked:** a real signed-in save (no test account, Q4), Safari and iOS (the toolbar above the keyboard, `plaintext-only` title), two people editing one MoM at once, and the visual comparison with the prototype (§5 rows 26–42 stay unticked).
- **On the preview, `next.html` now runs** and a signed-in person can edit real MoMs there; saves go to the live database (the same notes the old app shows). Phase 2 task 6 (signed-out visitors sent to `index.html`) is still open: a signed-out visitor sees the sign-in placeholder.

**Notes from the Area page, Today / All areas and ⌘K / Move (2026-10-13):**
- **Files.** New: `js/ui/area.js` (Area page, selection and bulk bar, destination picker, Move, menus, open / download / copy a file), `js/ui/home.js` (Today, All areas, `itemRow`, Continue cards). Changed: `ui/core.js`, `ui/shell.js` (⌘K bar, `createPlace`), `ui/mom.js`, `data/actions.js`, `data/session.js`, `data/search.js`, `data/content.js`, `css/app.css`, `next.html`.
- **Data layer.** `moveItems(keys, dest)`: MoMs, files and areas in **one all-or-nothing batch**, returns `{ ok, done, undo }` (undo writes every old place back, removing fields that were not there); refuses an area into itself or anything inside it. `touchRecent(kind, id)` keeps `users/{uid}.recent` (8, newest first, no duplicates, none for visitors); `CURR_USER_RECENT` is read in `session.js`. `searchAll(q)` (access-aware: hidden items and anything inside a restricted area never appear; a restricted **area** shows by its name only, areas inside it do not; newest first). `plainText()` gives a note's text from HTML or Delta without Quill, with script text left out and a space between cells.
- **Area page.** Header (emoji on a tint, Area / Sub-area · Restricted, size line, created date and age, lock pill with Lock again), sub-areas (a restricted one shows the lock, no counts, none of its contents), filter (title, note text, files; keeps focus and caret while typing), Newest / A–Z, Tiles / List (remembered in `G_fview`), shelves for MoM and file groupings together, loose MoMs and files (an item whose grouping no longer exists stays visible), empty, no-match, gate, no-access and not-found states. File tiles open the lightbox (images), a new tab with the design’s toast (links and documents), or the password gate first (restricted files, which then open).
- **Selecting several (O7).** Boxes on cards (areas only for admins); clicking a card selects it; Space / Enter work on the boxes; the cards update in place, so the keyboard keeps its place; "Select all N matching"; Esc and Clear leave; going to another page clears the selection and the filter. Members can select MoMs and files; their bulk Delete is greyed and says "Only admins can delete items."
- **Move (O3, O5).** One picker for one item, several, an area, and the place chip. Areas indent by level; restricted areas are shown closed and nothing inside them is listed; groupings appear under their area, "Wrong kind" for the other kind (and for every grouping when MoMs and files are moved together); "Top level" only when moving areas. Search narrows by name or path; ↑ ↓ move through enabled rows, Enter confirms (the search keeps the focus after a pick). The toast says where ("Moved “Plain notes” to 🌿 Verdant Foods · Weekly") with **Undo**; a move that can't be done says so and never claims success. Undo is a small registry in `core.js` (`offerUndo`), ready for the other reversible actions.
- **Place and groupings.** MoM groupings and file groupings are separate collections, so the place remembers which kind its grouping holds (`gkind`); New MoM uses it only for a MoM grouping, Upload and Save a link only for a file grouping. **Where "create" lands by default:** the area you are in, else the MoM's area, else the place you chose, else the area you opened last, else the first area you can see.
- **Today.** Greeting with the first name (from the display name, else the email's first part), today's date, "Creating in" chip and the four tiles (Flagged in place of New area for members), Continue (your Recent, restricted items left out), Flagged (workspace-wide), Recently added (admin only; an item with an author shows who and when, an older one only when: gap G6 still open). First-run state, and the "no areas yet" message for a member.
- **All areas.** A card per top-level area (counts; "Restricted" and no counts for a closed one; sub-area chips), the full tree on phone, Select for admins, empty states.
- **⌘K.** ⌘/Ctrl+K and the Search tab; Actions for the current place (and New area for admins), then Areas, MoMs, Files and links; ↑ ↓ Enter, Esc. **Enter acts on the first match, never on "New MoM ‘word’"** (a search must not create something by accident); that action is selected only when nothing matched. A restricted area shows by name with "Restricted" (the design guide says so; the prototype hid it), and nothing inside it. Not for visitors.
- **Interim choices (gaps).** An area’s colour (G3) is derived from its id, steady between visits, until the designer says how areas get one. Authors (G6) as above. Palette: restricted areas by name follows the guide over the prototype.
- **Fixed on the way (real bugs).** A dialog opened from a menu lost its focus when the menu closed; a long menu anchored low on the page ran off the bottom of the window (items unreachable); in Select mode a file tile opened the file instead of selecting; search listed an area *inside* a restricted area; `plainText` leaked `<script>` text and ran table cells together; `createPlace` could default to a restricted area. Also: pages repaint in place keeping the focused field or button; the area's emoji slot no longer overflows.
- **Not done here.** The dialogs the buttons open: New area, Rename, New grouping, Remove grouping (and its Undo), Save a link, Share, Access, Restrict / Remove password, Upload (the acts log a warning until built). Flagged, Recent, Deleted and Account pages (their rows and `itemRow` exist). The Area page's remove-grouping Undo belongs with the Dialogs task. Drag-and-drop of files onto a page. §5 rows for these screens stay unticked until the side-by-side check.
- **Checked (Chromium).** Area page, selection, Move and Undo, delete, files, member and phone: 87 checks with fake data and every write recorded. Today, All areas and ⌘K: 52. Data layer on a fake Firebase page (every move shape, Undo, cycles, Recent, plain text, search rules): 19. **Read-only on the real workspace data** (171 areas, 357 MoMs, 110 files; writes and the automatic purge blocked): every area page renders with the right number of MoM cards, file tiles and shelves, Today and All areas render, ⌘K answers real queries, the filter works on the biggest area, and no write was attempted by the pages. All earlier suites rerun (editor 101, drag 5, conversion 13, core/shell 149, data 42, gallery, shell smoke, the old app's 3 sign-in tests, both apps on real Firestore). **Not checked:** a real signed-in session with real writes (no test account, Q4), whether the security rules accept updates to `users/{uid}.recent` (a refused write only logs), Safari and iOS, and the visual comparison with the prototype.
- **Heads-up on the tests.** `db` is a `const`, so a test cannot swap it; one early data test therefore tried a real write with nothing signed in, which the database refused, and the editor harness once did the same through `touchRecent`. Both now run on stubs or on a page whose `firebase` is a fake, so no test can reach the real database. Separately, my earlier real-Firestore checks loaded the app's normal listeners, which include its automatic purge of items deleted more than 7 days ago (what any user's load does); the new real-data run blocks it.

**Notes from Flagged, Recent, Deleted, Account and the dialogs (2026-10-13):**
- **Files.** New: `js/ui/files.js` (Save a link), `js/ui/access.js` (Share a link, Access), `js/ui/account.js` (Account, Change password, Install). Changed: `js/ui/home.js` (Flagged, Recent, Deleted with restore, remove forever and empty all), `js/ui/area.js` (New area, Rename, New grouping, Rename grouping, Remove grouping with Undo), `js/data/actions.js` (`setShared`, `restoreBatch`, `purgeBatch`, `renameArea`, `renameFile`, `renameGroup`, `removeGroup` returning `{done, undo}`), `js/ui/core.js` (`docKind` for saved links), `js/ui/mom.js` (`fieldError` shows a new message on a field that already has one), `css/app.css`, `next.html` (scripts in order: core, shell, mom, area, files, access, home, account, app).
- **Deleted.** An item inside a deleted area is not listed by itself: it comes back with the area. Restoring an area restores its sub-areas and the MoMs, files and groupings that were deleted with it, matched by **deletion time within 5 seconds** (the old app writes those one after another; this is a heuristic and is documented as such). Items past 7 days are not listed (the automatic cleanup removes them). Remove forever asks first and says it can’t be undone. Empty all counts what goes and asks first.
- **Dialogs.** Every write goes through `actions.js`, so the dialogs can be tested without the database. New area: admins only (members get "Only admins can create areas."), an emoji grid (8 across, 6 on phone), a location list (restricted areas shown but not choosable), the new area is opened and its place is open in the tree. Rename: an area’s name and emoji, a MoM’s title through the editor’s own write (records who edited it), a file’s name; a final item can’t be renamed by members. Grouping: MoMs or files and links; Remove grouping says what stays where and offers **Undo** (the grouping and its contents go back). Save a link: the kind follows the address until someone picks one; the address gets https:// when it has no scheme; the place is the one chosen, and a MoM grouping is never used for a link; stored with the old app’s type names (`link`, `presentation`, `pdf`, `spreadsheet`, `image`, `other`). Share: `shared` true/false (plan 2.8), the address is `#/s/a|m|f/:id`, the dialog says what the link exposes, and turning it off is immediate; members can’t share. Access: lists who has it, offers only members who don’t (admins are never listed), grants and revokes through `folder_access`; members can’t change it.
- **Account.** Name, email, role (Admin or Member), Appearance per device (`G_theme`: Light / Dark / Match system, applied at once), your access (All areas for admins; the areas you can see for members). Change password re-checks the current password first (the account service re-authenticates): an empty, short or mismatched new password is caught at its field; a wrong current password says so at that field. Install: the browser’s install prompt when it has offered one, otherwise the three steps. Sign out returns to the sign-in screen.
- **Two small corrections.** A saved link is no longer re-guessed as a PDF from its address (its stored kind wins). A failed validation message on a field now updates when a different problem comes up.
- **Not done here.** Upload (its own task). Restrict / Remove password (the restricted-gate task). Export as A4 PDF (Phase 6). The Missing page (Phase 6). Flagged and Recent are list screens only; drag-and-drop onto them is not built. The Account page’s "Install" on phones relies on the browser’s own prompt (Phase 6 PWA work).
- **Checked (Chromium, fake data, every write recorded, nothing sent):** Flagged (rows, unflag, nothing flagged), Recent (order, restricted items left out, empty), Deleted (one line per top-level item, days left, restore an area with what was deleted with it, remove forever with confirmation, empty all, nothing deleted), Account (name, role, Appearance remembered and applied, member’s access, change password: each check, refused and accepted, install with and without the browser’s prompt, sign out), New area (fields, emoji, location, sub-area, member refused), Rename (area, MoM, file, final), groupings (rename, remove with Undo, New grouping of files), Save a link (place, kind from the address, validation, type names), Share (on, off, what it exposes, member refused), Access (lists, offers, grant, revoke, member refused). **71 checks**. Read-only on the real workspace: Flagged (50), Recent, Deleted, Account and an area page all render with real data, no "undefined" or "NaN", no write attempted. All earlier suites rerun: area 87, Today/All areas/⌘K 52, editor 101, drag 5, conversion 13, core/shell 149, data 42, gallery, shell smoke, old app sign-in 3, both apps on real Firestore.
- **Not checked:** a real signed-in session with real writes (no test account, Q4), whether the database rules accept `shared`, the grouping and access writes and a `users/{uid}` update, Safari and iOS, the side-by-side comparison with the prototype (§5 rows for these screens stay unticked), and the Undo of an area restore (there is none: restoring is the undo).

### Phase 5: Every state on every screen
**Tasks:** the remaining rows of §4's state table and §5.1/§5.2: nothing yet, loading, failure, offline, restricted, read-only, selection, no results, remote change, colleague toast, Undo flows, member and new-member roles.
**Done when:** every row in §5.1 and §5.2 is ticked except the edge surfaces in Phase 6. This needs a **member test account** (see Q4).

### Phase 6: Edge surfaces
**Tasks**
1. Sign in, Reset, New member, Missing page; remove the Phase 2 redirect.
2. Guest views `#/s/a|m|f/:id` + Link unavailable; `visitor` role; old `?folder|mom|doc=` redirects.
3. `.ed-body` content styles everywhere (editor, read-only, shared MoM, A4); legacy-content check on real old MoMs (W11).
4. A4 export + print rules (Q1 decides the final action).
5. PWA: `manifest.webmanifest`, `icon.svg`, `icons/apple-touch-icon.png`, theme-color metas, new `sw.js` precaching `next.html`'s shell, fonts and icons; `pwa.js` banner; Account → Install.
6. Product name in every place it appears (`<title>`, manifest, sign-in, install copy, update banner, A4 stamp, visitor head). Taken from one constant `APP_NAME` in `ui/core.js` until Q2 is answered.

**Done when:** every §6 row has its counterpart built; §5 rows 49–63 are ticked; the installed preview opens offline.

### Phase 7: Cutover and deletion
**Tasks** (one commit):
1. `next.html` → `index.html`.
2. Delete `css/styles.css`, the old `js/app.js`, `js/auth.js`, `js/rbac.js`, `js/tiptap.js`, `favicon.svg`, `dev/gallery.html`.
3. Delete the old Playwright specs; point the new specs at `/`.
4. Run the old-name check (§10).

**Done when:** nothing in the repo references an old file, an old element id, or an old-only class name; all tests pass on `/`.

### Phase 8: QA and polish
All of §8 on the preview, plus fixes. Then merge `redesign` → `main` (production deploy) and update `CLAUDE.md` (new structure, routes, localStorage keys, data fields, no Quill except for legacy conversion).

---

## 8. Testing & QA

### 8.1 Playwright (behaviours, not old selectors)
- Old specs keep guarding `index.html` until Phase 7. New specs live in `tests/next/` and are written per screen in Phase 4. Selectors use roles and accessible names (`getByRole('button', {name:'New MoM'})`), never CSS classes, so they follow the design.
- Every existing behaviour is carried over:

| Old test | New behaviour test |
|---|---|
| auth: login screen on first load; wrong password error; login success; forgot password visible | Sign in shows; wrong details → "Couldn't sign you in"; sign in → Today; Forgot password → Reset |
| sidebar: visible; collapses/expands; home active; sync live; trash clickable | Sidebar visible at 1280 px; Today is `aria-current`; sync pill reads "Up to date"; Deleted opens. (Collapse depends on G10) |
| folders: create top-level; navigate in and see sections; create sub-folder via menu | New area (dialog, emoji, location); open area shows header and sections; area ⋯ → New sub-area |
| moms: create opens editor; accepts text; appears in list; search filters; star | New MoM opens editor with today's date; typing → Saving… → Saved; card appears in area; filter narrows; flag shows in Flagged |
| move-search: filters bulk and single move destinations | Move dialog search filters, "No destination matches", several-item move |

- **New behaviour tests:** restricted gate + Lock again; restricted hidden from search; share link on/off + visitor views + unavailable; final blocks a member; Deleted restore / remove forever / empty all; upload failure reasons (blocked type, >10 MB PDF pre-check); Undo after move; Esc order; ⌘K ↑↓↵; legacy address redirects; offline "Saved on this device" (`context.setOffline(true)`).
- **Viewports:** the chromium project at 1280 × 800, plus a phone project at 390 × 844 with `hasTouch` (plain viewport, not the Pixel 5 device emulation that timed out on CI).
- **CI:** add a `deployment_status` trigger so tests run against each Vercel **preview** URL (`target_url`) on the `redesign` branch, using the Vercel protection-bypass header if previews are protected. Test data keeps the `[TEST-runId]` prefix, and the global setup cleans it up.

### 8.2 Screenshot comparison
- A script (`tests/visual/capture.spec.js`) captures each §5 row from **both** the prototype (served from `redesign/design/`, driving the Prototype panel for states) and the build, at 390 / 900 / 1280 px in light and dark. It writes a side-by-side HTML report.
- Pixel-diff (`toHaveScreenshot`, small tolerance) only for **data-independent** surfaces: sign in, reset, link unavailable, missing page, empty states, every dialog in its empty state, the gallery. Data-dependent screens are reviewed side by side by the owner, since real data never matches the prototype's sample data.

### 8.3 Accessibility
- axe-core (`@axe-core/playwright`, dev only) on every screen and dialog in both themes: zero serious or critical issues.
- Contrast: spot-check the token pairs from the guide's table in the built CSS (they're the same tokens, so this confirms nothing overrides them).
- Keyboard: a script tabs through each screen and asserts a visible focus ring on every stop, the Esc order (layer → selection → editor → parent area), Enter on short forms, and ↑↓↵ in ⌘K / move / "/" lists.
- Touch targets: a script asserts every interactive element is ≥ 44 × 44 px at 390 px and under `pointer: coarse`.
- Screen readers: tree/treeitem, listbox/option, menu/menuitem roles, and live regions for status, sync and toasts; checked once with VoiceOver on macOS and iOS.

### 8.4 Real devices
- iPhone Safari and the installed PWA (home screen): take a MoM in a meeting room scenario, toolbar above the keyboard, drawer, sheets, offline open, update banner.
- Android Chrome (if available) and the installed PWA.
- Mac Chrome and Safari, plus the installed desktop app.

---

## 9. Risks & open questions

### 9.1 Needs for the designer (gaps found in the code-to-design check)
Each is worded as a need, safe to paste into the studio. The owner carries them over; this session sends nothing.

- **G1 · Note colours in dark mode.** "Text colours and highlights chosen for note text must stay readable in both light and dark. Older notes can contain any text or highlight colour, not only the six offered now."
- **G2 · Older formatting in notes.** "Older notes can contain text in typefaces and sizes that aren't among the new choices. When my cursor is in such text, I need to understand what formatting it has, and still be able to change it to one of the new choices."
- **G3 · Area colour.** "Every area needs its soft colour behind its emoji, including areas created before colours existed. How does an area get its colour, and can I change it?"
- **G4 · Emoji outside the set.** "Some existing areas use an emoji that isn't one of the 24 choices. When I rename such an area, I need to see its current emoji and be able to keep it."
- **G5 · Shutting a restricted file again.** "When I've opened a restricted file during a session, I may want to shut it again straight away, as I can with an area." (Or the owner confirms this isn't needed.)
- **G6 · Unknown author.** "Things added before the app recorded who added them still appear in 'Recently added'. How do they read when the person is unknown?"
- **G7 · Restoring a grouping.** "When I restore a removed grouping from Deleted, should the MoMs or files it held go back into it?" (Undo right after removing already puts them back.)
- **G8 · A restricted sub-area inside a shared area.** "When a visitor browses a shared area that contains a restricted sub-area, what do they see, and can they open it with the password?"
- **G9 · Other failed actions.** "When a move, rename, flag, share or restriction change can't be saved (for example, permission refused by the server), what does the confirmation say, and what's the way forward?"
- **G10 · Room to write on a computer.** "When I write on a computer, I sometimes want as much width as possible for the note, with the rest of the app out of the way."
- **G11 · Colours outside the tokens** (also covers the swatch colours in `app.css` and `ui/core.js`, and the placeholder colour in `data/content.js`; see Phase 3 notes). "The prototype uses some colours that aren't tokens: white text on the accent colour, the lightbox overlay and its buttons, the success and warning ticks in toasts, the brand mark gradient, the install step numbers, and the paper colours of the A4 export. Every colour in the app must come from a named token, so each of these needs one, or the owner confirms it as an exception." (Plan §10 allows only the A4 paper.)
- **G12 · An area with no emoji.** "Some existing areas have no emoji at all. How should such an area look in the tree, in the path at the top, and on its card?" (Until answered the build shows no emoji for them.)
- **G13 · The empty note's hint.** "When a new MoM opens with an empty body, what does the first line say before I type?" (The build shows "Type / to add a table, an image or a link" until answered.)
- **G14 · An old note that can't be opened right now.** "Some old notes need a connection the first time they are opened. When I open one offline, what do I see, and what can I do?" (The build shows "This note couldn't be opened" with Try again.)

### 9.2 Questions for the owner
- **Q1 · PDF export** (design open question 4): generate the PDF in the app (exact layout, file named after the title, no print dialog; the current library already does this), or print to PDF from the A4 preview? The designer recommends generating. Needed before Phase 6.
- **Q2 · Product name** (design open question 2): "Daybook", "Workbench", or another name? It appears in the title, manifest, install copy, sign-in and exports. Needed before Phase 6; until then it lives in one constant.
- **Q3 · Spell-check dictionary** (design open question 6): is the browser's built-in spell-check enough? The plan assumes yes.
- **Q4 · Test accounts:** a member account (with one granted area) and a new-member account (with none) for Phase 5 and the tests, stored as CI secrets.
- **Q5 · Flags are shared.** A flag is stored on the item, so everyone sees the same flags (as today). The design doesn't say whether flags are personal. The plan keeps them shared unless you say otherwise.
- **Q6 · `brand-proposal/`** is unused by the app. Delete it at cutover, or keep it?

### 9.3 Technical risks
| Risk | Mitigation |
|---|---|
| **Editor rebuild** (Tiptap toolbar, bubble, "/" menu, tables, Long text, drawer, floating images) is the largest and most-used part (C1–C3 are daily) | Built first in Phase 4; old MoMs tested against a copy of real content (W11); the journal migration is tested on a duplicate MoM before touching the real one |
| **Content migration** of the prospect journal changes stored HTML | Additive attributes only; the conversion runs on open, and the original HTML is kept in `contentBackup` on the first conversion |
| **Visitors can write today** (anonymous = member, notes §5 #1). The new `visitor` role is client-side only | Recommend adding Firestore security rules (`request.auth.token.firebase.sign_in_provider != 'anonymous'` for writes). No rules file is in the repo, so this is the owner's call, but without it read-only isn't enforced |
| **Tests write to the production Firebase project** | Keep the `[TEST-…]` prefix and cleanup; the colleague toast (S1) is suppressed for `[TEST-` names so real users aren't notified |
| **IndexedDB persistence** fails in private windows or with multiple tabs on old browsers | `synchronizeTabs:true`; on failure the app keeps working online, and "Saved on this device" is replaced by Saving… until the server confirms |
| **Hash-route change** breaks old bookmarks and shared links | Permanent redirects (2.6), covered by tests |
| **`shared` becoming three-state** could hide items unexpectedly | Only an explicit `false` hides an item. Items whose own link was turned off in the past already carry `false`. Before cutover, a one-off check lists every `shared === false` item inside a shared area for the owner to confirm |
| **Firebase compat v9 and Tiptap v2 from esm.sh** are pinned to major versions only (`@2`) | Pin exact versions in Phase 4 to avoid surprise upgrades |
| **Old design creeping back** during the rebuild | No file in `js/ui/` or the new CSS may be edited by copying from the old files; review each phase's diff for old ids and class names (the §10 check runs on every phase, not only at cutover) |
| **Long-lived branch drifts from `main`** | Merge `main` into `redesign` after every `main` change; keep `main` changes to fixes |

---

## 10. Definition of done

- [ ] Every row of the §5 coverage matrix (5.1, 5.2) is ticked, at each listed size and theme.
- [ ] Every story in §5.3 has its new code in place and the old code deleted.
- [ ] Every row of §6 reverse coverage has its counterpart built, or was resolved by the designer (G1–G10) or the owner.
- [ ] **No old CSS:** `css/styles.css` is gone, and every stylesheet is one of `tokens.css`, `base.css`, `views.css`, `editor.css`, `app.css`.
- [ ] **No old names:** a check script fails if any old-only class name (the 244, less the 3 Tiptap generates), or any old element id (`auth-screen`, `sidebar`, `sb-*`, `ca`, `MR`, `CR`, `pdf-print`, `tt-*`, `mv-*`, …), is used as a class or id (in a `class`/`id` attribute, a `classList`/`getElementById`/`querySelector` call, or a CSS selector) in `index.html`, `css/` or `js/`. Plain words in copy or attributes such as `[hidden]` don't count. The list is generated once from `css/styles.css` and the old `index.html`/`js` before they're deleted, and saved as `redesign/old-names.txt`.
- [ ] No inline handlers and no `alert()`, `confirm()` or `prompt()` anywhere.
- [ ] No raw colour outside `css/tokens.css` (apart from the A4 export's white paper, as in the design).
- [ ] Playwright passes on phone and desktop viewports; data-independent screenshots match the prototype; the owner has signed off the side-by-side report.
- [ ] axe reports no serious or critical issues; keyboard, focus and 44 px checks pass.
- [ ] Checked on a real phone and as an installed app, including opening offline.
- [ ] `CLAUDE.md` describes the new UI, and `redesign` is merged to `main`.
