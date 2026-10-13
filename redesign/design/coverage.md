# Coverage

Every job story and every state in `handoff/inventory.md`, mapped to where it lives in the prototype (`prototype/app.html`). "Panel" means the Prototype panel at the bottom right, which switches role, theme and state.

Every row works on **phone and desktop** and in **light and dark**. Where phone differs, the row says how.

**Result: every story and every state is covered.** Two gaps found during this audit were designed and built rather than skipped: selecting several **areas** (O7, admin) and seeing a colleague's addition arrive in a list without reloading (S1). Things the prototype can only **simulate**, because a static prototype can't do them for real, are marked *(simulated)*, with what the real app does.

Checked by a scripted click-through in headless Chrome: 45 checks, no errors. Every screen below was also reviewed visually on phone and desktop, in light and dark, at 390, 900 and 1280 px.

---

## Job stories

### 1. Capture

| ID | Where | How to see it |
|---|---|---|
| C1 | **New MoM** on Today (largest tile), the area header, every MoM grouping ("New MoM here"), the top bar's split New, the phone ＋ sheet, and ⌘K ("New MoM in 🌿 Verdant Foods"). Opens the editor with "Meeting – 13 Oct 2026", today's date, and the cursor in the body. The "Creating in" chip on Today chooses where. | Today → New MoM |
| C2 | Save status pill: Saving… → Saved. It sits in the top bar on desktop and the editor head on phone. Saves 0.8 s after typing stops. | Type in any MoM |
| C3 | ⌘/Ctrl+S gives a "Saved" toast. **Done** saves and returns to the area. | `#/mom/m1` |
| C4 | Title (editable), date chip ("12 Oct 2026", opens the date picker), tags (Add tag, ✕ to remove). | `#/mom/m1` |
| C5 | "Attach a document" chip, or ⋯ → Attach a document. The attached link shows as a chip that opens in a new tab. | `#/mom/pj` (no document yet); `#/mom/m1` (attached) |
| C6 | **Upload** dialog: choose a file or drop it on the dialog, or drop anywhere on an area or MoM (full-screen drop target). It shows a live %, an optional name (the file's own name is the placeholder), a note, and "Adds to … Change". | Area → Upload |
| C7 | **Save a link**: address (the kind is guessed), name (required), six kind tiles, note, destination. | Area → Save link |
| C8 | Failure box with a plain reason and a way forward. Too large: "try a 14 MB PDF" → Save as link instead. Type not allowed: .exe. Storage set-up: Panel → State: Failure. Network: Panel → State: No connection → Try again. | Upload dialog |

### 2. Write and format a MoM

| ID | Where | How to see it |
|---|---|---|
| W1 | Toolbar: Undo/Redo, text style (Normal, H1–H3), Bold/Italic/Underline/Strike, **Aa** menu (Sans-serif / Serif / Mono, 8 sizes 12–32, text colour, highlight), Alignment menu (start, centre, end), bullets, numbers, quote, clear formatting. Phone: docked above the keyboard. | Any MoM |
| W2 | Toolbar buttons show pressed for active marks. The style select and alignment icon follow the caret. | Put the caret in a heading or bold text |
| W3 | Table button or "/" → Table (3 × 3 with headings). Table bar (desktop) or Table menu (phone): add or move rows and columns, delete a row, column or table (Undo). Drag a heading edge to resize. Tab moves; Tab in the last cell adds a row. | `#/mom/m1` → Actions table |
| W4 | Image button or "/" → Image: web address, device, or paste. Select it to resize (corner handle), switch Inline ↔ Float, drag when floating, or remove. Uploading placeholder with %, and failure with Retry (Panel → Failure). | Any MoM → Image |
| W5 | Link button or bubble → "Add a link". "Remove link" removes it. | Select text → link |
| W6 | ＋ / "/" → Link files: search by name, see where each lives, pick several, insert as named pills. Shows "Nothing yet" and "No matches". | Any MoM → ＋ → Link files |
| W7 | ＋ / "/" → Link MoMs: newest first with area and date. Following a pill saves the current MoM, then opens the other. | Any MoM → ＋ → Link MoMs |
| W8 | **P-1 adopted:** any table column can be set to **Long text**. The **Prospect journal** template (in "/") has Detailed Remarks as Long text. The cell is a compact two-line preview; tapping opens the **Detailed Remarks** drawer (roomy, autosaves, Saving… → Saved). New rows get Remarks automatically; it can't be deleted, moved or turned back to plain text. A journal bar has New entry. Phone: each entry is a card. | `#/mom/pj` |
| W9 | ⋯ → Export as A4 PDF: an A4 preview with title, area, date, tags, body and "Exported 13 Oct 2026", then Print or save as PDF, named after the title. Works for read-only MoMs too. *(Simulated through the browser's print; see open question 4.)* | `#/mom/m1` → ⋯ |
| W10 | The body uses the browser's spell-check (red underlines, right-click suggestions). *(See open question 6 on a shared dictionary.)* | Type a misspelling in a MoM |
| W11 | Old MoMs written with earlier markup open and display correctly. | `#/mom/m4`, `#/mom/m9` |

### 3. Find

| ID | Where | How to see it |
|---|---|---|
| F1 | ⌘K / Search: areas by name, MoMs by title and opening text, files by name and note, grouped by kind with where each lives, plus a no-match message. Phone: full screen. | ⌘K, or the Search tab |
| F2 | Area filter bar: filter by name or content, Newest / A–Z, grid/list for files, "No matches for …" with Clear filter. | `#/areas/verdant` |
| F3 | Flag from ⋯, the editor header, or the Flagged page. **Flagged** page, sidebar count, Today section, and amber flag marks. Phone: Flagged tab. | `#/flagged` |
| F4 | **Today** is home: Continue where you left off, one-tap create, Flagged. | `#/today` |
| F4b | Today → "Recently added across the workspace": what, where, who, when (admins only). | Panel → Role: Admin |
| F5 | Sidebar tree marks the current area. Breadcrumb in the top bar; deep paths fold into "…" with a menu. Phone: breadcrumb chips on the area page and the path above the MoM title. | `#/areas/packaging` |
| F6 | Sidebar tree (any area, one click), ⌘K jump, All areas. Phone: the Areas tab is the full tree. | Sidebar; phone Areas tab |
| F7 | Every area, MoM and page has its own address (`#/areas/:id`, `#/mom/:id`). Back, forward and reload work. | Reload on any page |
| F8 | Area header: "2 sub-areas · 6 MoMs · 9 files" and "Created 2 Jun 2026 · 4 months old". | Any area |
| F9 | Images open in the lightbox (Esc or ✕ closes it). Other kinds open in a new tab (toast). *(Simulated by the toast.)* | Area → Shelf mock-up.jpg |
| F10 | ⋯ → Download, or Download in the lightbox. Links fall back to opening ("Links can't be downloaded, so … opened in a new tab"). | File ⋯ |
| F11 | Kind tiles and colours (PDF, image, video, sheet, slides, link, other) with extension badges and image samples. | `#/areas/verdant` files |
| F13 | **Recent** page and Today's "Continue where you left off". | `#/recent` |
| F14 | ⋯ → Copy address, and the copy button in the lightbox ("Address copied"). | File ⋯ |

### 4. Organise

| ID | Where | How to see it |
|---|---|---|
| O1 | **New area**: Today tile (admin), sidebar ＋, "New sub-area" card, area ⋯, split New, ⌘K, phone create sheet. The dialog has a name (required, with an error), a 24-emoji grid, and a location (top level or any area). | Today → New area |
| O2 | Area ⋯ → Rename or change emoji (members too). | Area ⋯ |
| O3 | Area ⋯ → Move to… (admin): areas only, with the area itself and everything inside it disabled, plus Undo. | Area ⋯ → Move to… |
| O4 | Grouping shelves: New grouping (name, holds MoMs or files), Rename, Remove (admin) with "contents stay in the area" and Undo, and an empty grouping state. | `#/areas/verdant` |
| O5 | ⋯ → Move to…: "Currently in …", search areas and groupings, wrong-kind groupings disabled, "No destination matches", ↑↓↵, Move here, Undo. | Any MoM or file ⋯ |
| O6 | ⋯ → Rename on any MoM or file, without opening it. | Any card ⋯ |
| O7 | **Select** on an area page or All areas: check boxes, a bulk bar with "N selected", "Select all N matching" (follows the filter), Move…, Delete (admin), Clear. Admins can also select areas. | Panel → State: Selecting several |
| O8 | Delete confirmations state the impact: an area "with 2 sub-areas, 6 MoMs, 9 files and 4 groupings"; several items name each one; remove forever and empty all say "can't be undone". Admin only. | Area ⋯ → Delete area |
| O9 | **Deleted**: kind, when deleted, days left, Restore, Remove forever, Empty all (with a warning). Items over 7 days old are removed automatically (Pilot 2025 and "Expired draft" are already gone). | `#/deleted` |

### 5. Protect and share

| ID | Where | How to see it |
|---|---|---|
| P1 | ⋯ → Restrict with a password (password and confirm, at least 6 characters, strength bar, "stored only as a hash"). Change or remove needs the current password. Areas and files. | Area or file ⋯ |
| P2 | Restricted gate: wrong password ("That password isn't right. Try again."), open for the session, "Open for this session · Lock again" locks it at once. Admins enter it too. | `#/areas/meridian` (password **meridian**) |
| P3 | A restricted area shows only its name and a lock in the tree, cards and search. No counts. Its contents are absent from Today, Flagged, Recent and search. | Search "Clinical", then unlock Meridian and search again |
| P4 | A restricted file shows its name with a lock over the tile and "Restricted · note hidden". It asks for the password before opening or downloading. | Verdant → Pricing bands – confidential.xlsx |
| P5 | ⋯ → Share a link (admin): Link is on/off, copy, and "what this link exposes" in plain words. Turning it off stops it at once, and the item's own setting wins over its area's. | Area ⋯ → Share a link; then `#/s/m/m1` |
| P6 | Area ⋯ → Access (admin): who can see it, grant, revoke. Members see only granted areas, and their breadcrumb starts at their grant. | Area ⋯ → Access; Panel → Role: Member |
| P7 | ⋯ → Mark as final / Unmark (admin), with Final marks on cards. Members read only: no toolbar, a notice, rename and move blocked. | `#/mom/m2` as Member |

### 6. Work together, stay in sync

| ID | Where | How to see it |
|---|---|---|
| S1 | A colleague's addition appears without a reload, with a toast ("Ana added “Supplier quotes.pdf” to Verdant Foods") and in Recently added. *(Simulated.)* | Panel → State: Sync: someone else editing, then open Verdant |
| S2 | In an open MoM: "Priya saved changes to this MoM · Show changes". Applying them keeps your place. *(Simulated.)* | Same state → `#/mom/m1` |
| S3 | Sync pill: Up to date, Catching up (with banner), Offline (with banner). | Panel → State: Sync: catching up / No connection |
| S4 | Toasts after every action, with Undo or Open Deleted where useful. | Any action |

### 7. Work anywhere

| ID | Where | How to see it |
|---|---|---|
| A1 | Phone layouts for every screen: bottom tabs, create sheet, sheets for every dialog, full-screen editor and search, journal cards, 44 px targets. | Narrow the window to under 768 px |
| A2 | Manifest and icon. Account → Install Daybook (the browser prompt, or steps per device). *(Real install needs http(s).)* | `#/account` |
| A3 | The service worker caches the app shell so it opens offline. The offline banner and "Saved on this device" show. *(The service worker needs http(s); opened from disk it's simulated by the panel.)* | Panel → State: No connection |
| A4 | Banner: "A new version of Daybook is ready · Refresh to update". *(Simulated; the real app shows it when a new service worker is waiting.)* | Panel → New version |
| A5 | `prefers-reduced-motion` turns animation off, and drag and scroll become instant. | Turn on Reduce motion in the OS |
| A6 | Esc backs out (layer → selection → editor → parent area). Enter confirms short forms. ⌘/Ctrl+S saves. ⌘/Ctrl+K searches. ↑↓↵ in lists. Tab in tables. | Keyboard |

### 8. Account

| ID | Where | How to see it |
|---|---|---|
| U1 | Sign in: email, password with show/hide, "Stay signed in on this device", and "Couldn't sign you in" for wrong details. | Panel → Role: Signed out (password **daybook**) |
| U2 | Forgot password → reset: "Enter your email first", then "Check your inbox". | Sign in → Forgot password? |
| U3 | Account: name, email, role; Change password (current, new, confirm; at least 6 characters; mismatch and wrong-current errors); Sign out; Appearance; Your access. | `#/account` |
| U4 | New member: "Your account is ready, but you don't have access to any areas yet". No sign-up anywhere; "Accounts are created by the workspace owner". | Panel → Role: New member |

### 9. Visiting through a shared link

| ID | Where | How to see it |
|---|---|---|
| V1 | Shared area: no sign-in, browse sub-areas, read MoMs, open files, "Read only". Nothing outside the shared area, not even its parent in the breadcrumb. | `#/s/a/verdant`, or Panel → Role: Visitor |
| V2 | Shared MoM: title, date, tags, full body. | `#/s/m/m2` |
| V3 | Shared file: name, note, Open, Download. Password first if restricted. | `#/s/f/f3`; `#/s/f/f9` (password **meridian**) |
| V4 | "This link is no longer available" for turned-off or missing links. | `#/s/m/m1`; `#/s/a/nothing` |

---

## States

| State | Where it occurs | Where it's designed |
|---|---|---|
| **Nothing yet** | No areas | Today leads with "Create your first area"; sidebar "No areas yet"; All areas empty (Panel → Nothing yet (workspace)) |
| | Area with no sub-areas, MoMs or files | "Nothing in Blank project yet" with New MoM, Upload, Save a link, New sub-area (Panel → Nothing yet (area)) |
| | Nothing flagged / deleted / recent | Flagged, Deleted and Recent pages; Today sections |
| | Empty grouping | Dashed shelf, "Empty grouping" |
| | No other MoMs / no files to link | Link MoMs / Link files pickers ("Nothing yet") |
| | New member, no areas | New member screen; member Today and All areas |
| **No match** | Workspace search | ⌘K "No matches for …" |
| | In-area filter | "No matches for … · Clear filter" |
| | Destination search | Move dialog "No destination matches" |
| | File and MoM link search | Link pickers "No matches for …" |
| **Loading** | First connection after sign-in | Skeleton page (Panel → Loading) |
| | Image uploading into a MoM | Placeholder with % in the note |
| | File uploading | Progress bar with % in the upload dialog |
| **Saving / saved** | MoM body | Status pill: Saving… → Saved |
| | Detailed Remarks | Drawer status: Saving… → Saved |
| **Failure** | Wrong sign-in details | Sign in (any password other than "daybook", or Panel → Failure) |
| | Wrong password on a restricted item | Area gate, file gate, visitor file |
| | Upload failed (with reason) | Upload failure box, four reasons (see C8) |
| | Password-change errors | Account → Change password; Restrict → Change or remove |
| | Required name missing | New area, Rename, New grouping, Save a link |
| | Save failed | Status "Couldn't save · Retry" (Panel → Failure) |
| **No connection** | Offline status | Sync pill "Offline", banner, "Saved on this device" |
| | App opening with no network | Service-worker shell cache *(needs http(s))* |
| **Restricted by password** | Area and everything inside | Gate; lock in the tree, cards and search; hidden counts (Panel → Restricted locks Verdant too) |
| | File | Lock tile, hidden note, gate before opening or downloading |
| | Opened for this session | "Open for this session · Lock again" |
| **Read-only** | MoM or file marked final, as a member | No toolbar, notice, Final marks, rename/move blocked (Panel → Role: Member, `#/mom/m2`; or Panel → Read-only) |
| **Visiting via shared link** | Shared area / MoM / file / file with password / link off or missing | V1–V4 above |
| **Selecting several** | Nothing selected | "Select" button, no bar |
| | Some selected | Bulk bar "N selected" |
| | All matching selected | "Select all N matching" (Panel → Selecting several) |
| **Sync** | Current | "Up to date" |
| | Catching up | Pulsing pill and banner (Panel → Sync: catching up) |
| | No connection | "Offline" and banner |
| | Someone else's change arriving in an open MoM | Remote change bar (Panel → Sync: someone else editing) |
| **Shared / not shared** | An item's link on or off | Share sheet toggle; visitor link works or says unavailable |
| **Flagged / not flagged** | MoMs and files | Flag toggles; amber marks; Flagged page |
| **New version available** | After an update | Banner with Refresh (Panel → New version) |

## Roles

| Role | How to see it | What changes |
|---|---|---|
| Admin | Panel → Role: Admin (default) | Everything, including create area, move area, delete, share, access, final, Recently added |
| Member | Panel → Role: Member (Priya) | Only granted areas (Verdant Foods, Weekly sync). Admin-only menu items are greyed and say "Only admins can …". Final items are read-only |
| Visitor | Panel → Role: Visitor | Shared views only, no workspace chrome, read only |
| Signed out | Panel → Role: Signed out | Sign in and reset |
| New member | Panel → Role: New member | "No areas yet" screen and account |
