v1.0 — approved 2026-10-13

# Daybook design guide

**Status: approved by the owner on 2026-10-13.**

Daybook is the working name (open question 2 in `decisions.md`). The design is **Daybook's base** (Today home, soft cards, large radius, Plus Jakarta Sans, bottom tabs and create sheet on phone) combined with **Folio's sidebar, breadcrumb and indigo colour**, plus one amber accent for flags.

Everything described here can be seen in the prototype: `prototype/app.html`. Open it straight from disk, or serve the `redesign/design/` folder over http to also try installing it and using it offline. The **Prototype** panel (bottom right) switches role, theme and state. It's a review tool, not part of the design.

---

## 1. Principles

1. **The next thing you'll create is one tap away.** New MoM is the largest target on Today, in every area, in every grouping ("New MoM here"), in the top bar, on the phone's ＋ tab, and in ⌘K.
2. **You always know where you are.** On desktop the sidebar tree and the breadcrumb show it. On phone the breadcrumb chips and the Areas tab's full-screen tree do.
3. **Calm and bright.** Light first. Generous space, soft cool washes, one indigo accent and one small amber accent. Shadows are soft and only on cards and things that float.
4. **Say what happened, in plain words.** Every action confirms itself. Every failure gives a reason and a way forward. Every destructive action states its impact first.
5. **Nothing leaks.** Restricted content is hidden everywhere it could appear: tree, counts, search, recent and flagged.

---

## 2. Tokens

All tokens live in `redesign/design/tokens.css` as CSS custom properties. Light is the default. Dark redefines the same names, and applies when the person chooses Dark, or chooses Match system on a dark device. The prototype uses no raw colours outside this file, except inside the A4 export preview, which is always white paper.

### Colour

Contrast figures are measured with the WCAG 2.x formula, not estimated.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--bg` | #F7F8FC | #0E1120 | App canvas |
| `--surface` | #FFFFFF | #161B2D | Cards, dialogs, editor paper |
| `--surface-2` | #F1F3FA | #1C2238 | Wells, shelves, hover |
| `--surface-3` | #E6EAF6 | #262E49 | Pressed, segmented-control track |
| `--line` / `--line-2` | #E6E9F3 / #CFD5E6 | #262D46 / #3A4364 | Hairlines / input borders and dashed targets |
| `--text` | #161B2E (17.1:1) | #EDF0FA (15.0:1) | Primary text |
| `--text-2` | #4A5170 (7.8:1) | #BCC3DE (9.8:1) | Secondary text |
| `--text-3` | #626A88 (5.3:1, 4.8:1 on surface-2) | #A3AACB (7.5:1) | Meta, captions, placeholders |
| `--accent` | #4F46E5 | #818CF8 | Decorative only: list markers, dots, icons |
| `--accent-strong` | #4338CA (7.9:1) | #A5B4FC (8.6:1) | Accent **text** and links inside the app chrome |
| `--accent-fill` / `--on-accent` | #4338CA / white (7.9:1) | #5048E5 / white (6.2:1) | Filled buttons, the New MoM tile, selected check boxes |
| `--accent-tint` / `-2` | #EEF0FF / #DDE1FF | #252B4D / #323A66 | Selected rows, current nav item, chips |
| `--sky-strong` / `--sky-tint` | #1D5FB8 (6.2:1) / #E7F0FD | #93C5FD / #1B2A46 | Links in notes, tags, focus ring |
| `--flag` / `--flag-strong` / `--flag-tint` | #DC6803 (3.5:1, icon) / #A45107 (5.6:1, text) / #FFF4E0 | #FBB040 / #FCD34D / #3A2C12 | The one warm accent: flags and highlights only |
| `--success`, `--warn`, `--danger` (+ `-tint`) | 5.1:1, 6.5:1, 5.8:1 on their tints | 9.3:1, 9.1:1, 8.0:1 on their tints | Saved, offline, errors |
| `--danger-solid` | #D92D20 (white on it 4.8:1) | same | Delete buttons, danger icons |
| `--wash` | sky → lavender gradient | deep navy → violet | Today hero, empty-state art, drawer header |
| `--hero-glow` | soft white | soft indigo | Light in the hero's corner |
| `--k-*` / `--k-*-t` | per kind | per kind | File kinds: PDF red, image violet, video pink, sheet green, slides amber, link blue, other grey |
| `--t-sky`, `--t-lilac`, `--t-mint`, `--t-sun`, `--t-rose` | soft tints | deep tints | Area emoji backgrounds |
| `--scrim` | navy 28% | near-black 60% | Behind dialogs and sheets |

### Type

Plus Jakarta Sans everywhere in the interface. No serif anywhere in the chrome. "Serif" exists only as a content typeface inside notes (W1).

| Token | Size | Use |
|---|---|---|
| `--fs-2xl` | 40 px (32 on phone) | Today greeting |
| `--fs-xl` | 30 px (26 on phone) | Page titles; MoM title is 38/30 |
| `--fs-lg` | 20 px | Section headings |
| `--fs-md` | 17 px | Editor body, line height 1.72 |
| `--fs-base` | 15.5 px | Interface text |
| `--fs-sm` | 14 px | Secondary, chips, small buttons |
| `--fs-xs` | 12.5 px | Captions, file meta, eyebrows |

Weights: 500 regular, 650 semi, 750 bold, 800 heavy (titles). Headings use −0.02 to −0.03 em letter spacing.

### Space, radius, elevation, motion, breakpoints

- **Space:** a 4 px scale, `--sp-1` 4 px to `--sp-10` 64 px. Pages pad 40 px on desktop, 32 on tablet, 18 on phone.
- **Hit area:** `--hit` 44 px. Every control is at least 44 × 44 px. On a touch screen (`pointer: coarse`) the sidebar rows grow to 44 px too.
- **Radius:** `--r-sm` 12 (controls), `--r-md` 16 (inputs, small cards), `--r-lg` 20 (cards), `--r-xl` 24 (large cards, sheets), `--r-2xl` 30 (hero, dialogs), `--r-pill` (buttons, chips).
- **Elevation:** `--shadow-1` rests cards, `--shadow-2` is hover and toolbars, `--shadow-3` is dialogs, menus and toasts. Dark uses deeper shadows plus a 1 px light edge.
- **Focus:** `--focus` is a 3 px gap plus a 2.5 px sky ring, the same on every control.
- **Motion:** `--ease` cubic-bezier(.2,.8,.2,1); `--dur-1` 140 ms (hover), `--dur-2` 220 ms (fades, menus), `--dur-3` 340 ms (sheets, toasts). With `prefers-reduced-motion`, all animation and transition times drop to near zero, and drag and scroll animations become instant.
- **Breakpoints:** phone ≤ 767 px (bottom tabs, sheets, full-screen editor). Tablet 768–1023 px (icon rail instead of the full sidebar). Desktop ≥ 1024 px (sidebar with tree, top bar with breadcrumb and search).

---

## 3. Components

Each component lists its variants and states. "Focus" is always the shared `--focus` ring. "Disabled" is always 45–50% opacity with a not-allowed cursor, unless stated otherwise.

### Buttons
- **Primary** (`.btn-primary`): accent fill, white text, soft coloured shadow. Hover darkens, active scales to 98%, disabled is dimmed with no shadow, busy shows a spinning icon. One per view region at most.
- **Soft** (`.btn-soft`): white surface with a hairline shadow. Used for secondary actions (Upload, Save link, Cancel).
- **Ghost** and **link button**: text only. Hover adds a tint.
- **Danger** (`.btn-danger`): solid red fill, used only inside confirmations. **Quiet danger** is red text, used for "Empty all" and "Revoke".
- **Icon button** (`.icon-btn`): 44 px round. `aria-pressed` shows a selected state (accent tint) for toggles such as flag.
- **Split New** (top bar): "New MoM" creates in the current place; the caret opens a menu with Upload, Save a link, New grouping and New sub-area (admin).
- **Quick tile** (Today): the large New MoM tile (accent fill) plus Upload, Save a link, and New area (admin) or Flagged (member). On phone it's one wide tile and three compact ones.

### Inputs
- **Text, textarea, select:** 50 px tall, 16 px radius, 1.5 px border. Focus turns the border sky with a soft halo. Errors turn the border red with a red halo, and a message with an icon appears under the field (`.field.err`).
- **Password:** with a show/hide eye button. On restriction forms there's a strength bar and "At least 6 characters. Stored only as a hash."
- **Search in a page** (`.search-in`): a pill with a leading search icon.
- **Date chip** (editor): shows "12 Oct 2026" and opens the device's date picker.
- **Tags:** chips with a remove ✕, plus an "Add tag" field. Enter adds the tag.
- **Emoji grid:** 8 across (6 on phone). The selected emoji gets an accent ring.
- **Kind tiles** (save a link): six tiles. The selected one gets an accent ring. The kind is guessed from the address and can be changed.

### Chips and pills
Tag (sky), place chip ("Creating in 🌿 Verdant Foods ▾"), status pill (Saving… / Saved / Saved on this device / Couldn't save + Retry), sync pill (Up to date / Catching up with a pulsing dot / Offline), lock pill (Restricted, or "Open for this session · Lock again"), Final mark, Restricted mark, Read only pill, role pill.

### Cards and rows
- **Area card:** emoji on a tint, name, counts, sub-area chips. A restricted area shows only "Restricted" (no counts).
- **Sub-area card:** compact. The "New sub-area" card is dashed (admin only).
- **MoM card:** date (relative), flag, Final mark, title, two-line preview, tags. A ⋯ menu appears on hover (always visible on touch).
- **File tile:** image sample or kind icon on the kind's tint, extension badge, flag, Final mark. A restricted file shows a lock over the tile and "Restricted · note hidden" (P4).
- **File row:** list alternative for busy areas (grid/list switch).
- **Item row:** used in Flagged, Recent and Today lists. Shows where the item lives.
- **Continue card:** Today's "Continue where you left off".
- **Selection:** in "Select" mode a check box sits on each card. Selected cards get a 2 px accent ring.

### Grouping shelf
A soft well with a header showing a kind icon, the name, a count, an add button ("New MoM here" or "Add file here"; "here" drops on phone), and a ⋯ menu (Rename, Remove grouping, admin only). When empty, it has a dashed outline and an "Empty grouping" message.

### Navigation
- **Sidebar (desktop):** brand; Today, Flagged (count), Recent, All areas; the area tree with toggles, emoji, name, a right-aligned count and a lock for restricted areas; Deleted (count) and the account at the foot. The current area is a white raised row. Admins get a ＋ next to "Areas". With no areas it says "No areas yet. Create one" (admins) or "No areas shared with you yet" (members).
- **Tablet rail (768–1023 px):** icons only. The tree is reached through All areas.
- **Top bar:** breadcrumb (or the page name), a compact Search ⌘K pill, the sync pill, split New, and the avatar. Paths deeper than three levels fold the middle into "…", which opens a menu of the hidden levels.
- **Top bar in a MoM (desktop):** the editor's header. The breadcrumb ends in the MoM title (earlier levels fold into "…"), then the save status, Search, flag, ⋯ and Done.
- **Phone top bar:** back (not on the top-level tabs), the page title, the sync dot and search.
- **Phone tabs:** Today · Areas · ＋ (create sheet) · Flagged · Search.
- **Areas tab (phone):** the full tree as a screen, with 52 px rows.
- **Breadcrumb chips (phone area page):** a horizontally scrolling row.

### Layers
- **Dialog:** centred card on desktop. On phone, every dialog becomes a bottom sheet with a grab handle.
- **Drawer:** slides in from the right on desktop, 92% of the screen height on phone. Used for Detailed Remarks.
- **Menu:** anchored to its button on desktop, a bottom sheet on phone. Admin-only items stay visible for members but are greyed. Choosing one says "Only admins can …". Items blocked by Final say "This is marked final, so it can't be changed."
- **⌘K command bar:** full screen on phone. Results are grouped (Actions, Areas, MoMs, Files and links), each showing where it lives. ↑ ↓ ↵ work, and Esc closes it.
- **Lightbox:** a dark scrim with the image at full size and Download, Copy address and Close. Esc closes it.
- **Toast:** a dark pill at the bottom (above the tabs on phone), with an icon, a short message and an optional action (Undo, Open Deleted). It stays 4 seconds, and at most three show at once.
- **Banner:** a full-width strip under the top bar for offline, a new version, and catching up.
- **Bulk bar:** a dark floating pill: "N selected · Select all N matching · Move… · Delete (admin) · Clear".
- **Drop overlay:** a dashed full-screen target, "Drop to add to Verdant Foods".

### Editor parts
- **Toolbar:** Undo, Redo | text style (Normal, Heading 1–3) | Bold, Italic, Underline, Strikethrough | **Aa** (typeface, 8 sizes from 12 to 32, text colour, highlight) | Alignment ▾ | bullets, numbers, quote | link, table, image, ＋ insert | clear formatting. Active formatting shows as pressed (W2). On desktop it floats under the top bar; on phone it docks above the keyboard and scrolls sideways.
- **Selection bubble:** Bold, Italic, Underline, Strikethrough, link and clear, above selected text (desktop).
- **"/" menu:** headings, lists, quote, table, Prospect journal table, image, Link files, Link MoMs. It filters as you type, and ↑ ↓ ↵ and Esc work.
- **Table:** a 3 × 3 table with a heading row. The table bar (desktop) or the Table menu (phone) adds or moves rows and columns, deletes a row, column or table (with Undo), and sets a column to **Long text**. Drag a heading edge to resize a column. Tab moves between cells, and Tab in the last cell adds a row.
- **Long text cell (P-1):** two-line preview plus an expand button. Tap opens the Detailed Remarks drawer.
- **Detailed Remarks drawer (W8):** the entry's name and stage on top, a roomy auto-saving text area first, and the entry details (company, contact, stage, next step) below. A "Saving… → Saved" status shows.
- **Prospect journal bar:** "Prospect journal · N entries · New entry" above the table. In a journal, Detailed Remarks can't be moved, deleted or changed back to plain text, and new rows get it automatically. On phone each entry is a card.
- **Image:** inline or floating. Selecting one shows a resize handle, a "Drag" handle when floating, and Inline / Float / Remove. While uploading it shows a placeholder with a percentage, and on failure a plain reason and Retry.
- **Links in notes:** web links are sky underlines. Links to workspace files and MoMs are pills (file pills sky, MoM pills indigo) that open in the app. Following a MoM link saves the current one first.
- **Remote change bar (S2):** "Priya saved changes to this MoM · Show changes". Applying them keeps your place.
- **Final notice (P7, members):** "Marked final. An admin has agreed this record, so you can read, flag and export it, but not change it."
- **A4 export (W9):** a preview of the A4 page with the title, area, date, tags, body and "Exported 13 Oct 2026", named after the title, then Print or save as PDF.

### States and feedback pieces
Empty state (art tile on the wash, title, one sentence, actions), small empty state (inside sections), no-match message, skeleton blocks (shimmer, static with reduced motion), notice boxes (info, warn, danger), the restricted gate, the "no access" gate, and "This link is no longer available".

---

## 4. Screens

Every screen exists on phone and desktop, in light and dark. Routes are hash addresses, so back, forward and reload work, and every area and MoM has its own address (F7).

| Screen | Route | States shown |
|---|---|---|
| **Today** | `#/today` | Normal; nothing yet (first area first); member (Flagged tile, no Recently added); loading skeleton |
| **All areas** | `#/areas` | Grid (desktop) or full tree (phone); nothing yet; member with granted areas only; new member (no areas) |
| **Area** | `#/areas/:id` | Normal with groupings; filtered; no match; sorted A–Z; list view; selecting several; empty area; restricted gate (wrong password, open for session, lock again); no access (member); read-only items |
| **MoM editor** | `#/mom/:id` | Editing; saving and saved; saved on this device (offline); couldn't save (failure) with Retry; read-only (member, final); remote change arriving; legacy MoM (W11); journal; restricted gate |
| **Flagged** | `#/flagged` | List with unflag; nothing flagged |
| **Recent** | `#/recent` | List; nothing yet |
| **Deleted** | `#/deleted` | List with days left, Restore, Remove forever, Empty all; nothing deleted |
| **Account** | `#/account` | Details and role, Change password (errors), Install, Appearance, Sign out, Your access |
| **Sign in** | `#/signin` | Default; wrong details; missing password |
| **Reset password** | `#/reset` | Default; email missing; sent |
| **New member** | `#/new-member` | Signed in with no areas yet |
| **Shared area (visitor)** | `#/s/a/:id` | Area with sub-areas, MoMs and files; nothing inside; read only |
| **Shared MoM (visitor)** | `#/s/m/:id` | Title, date, tags, body |
| **Shared file (visitor)** | `#/s/f/:id` | Open and download; password first if restricted (wrong password error) |
| **Link unavailable** | any turned-off or missing link | "This link is no longer available" |
| **Missing page** | unknown address | "This page isn't here", with Today and Deleted |

**Dialogs and sheets:** Create (phone ＋), New area, Rename (area with emoji, MoM, file), New grouping, Move (one or several), Upload (choose or drop, progress, name, note, destination, failure with reason and Save as link), Save a link, Restrict with a password, Change or remove password, Share a link, Access, Delete confirmations (area, item, several, remove forever, empty all), Image, Link, Attach a document, Link files, Link MoMs, Export as A4 PDF, Install, Change password.

---

## 5. Patterns

### Feedback (S4)
Every action ends in a toast that names what happened and where: "Moved to 🌿 Verdant Foods · Steering committee", "Added “Shelf mock-up.jpg” to Verdant Foods", "Link copied", "Restricted with a password". Reversible actions offer **Undo** in the toast (move, remove grouping, delete table). Deletes offer **Open Deleted** instead, because they're already reversible for 7 days.

### Confirmations and destructive actions (O8)
- Only deleting, removing for good, emptying Deleted, and removing a grouping ask first.
- The dialog states the impact in a tinted box: "This includes 2 sub-areas, 6 MoMs, 9 files and 4 groupings. Nothing is lost until the 7 days pass." For several items it names them.
- The danger button repeats the verb ("Delete area", "Remove forever", "Empty everything"). Cancel is always on the left of it.
- Anything permanent says "This can't be undone."

### Permissions
Admin-only actions are hidden from members where they'd only add clutter (the New area tile, the sidebar ＋, the Recently added list). They stay visible but greyed inside menus, so a member who tries is told "Only admins can move areas." Final items block rename and move for members with "This is marked final, so it can't be changed."

### Restricted content (P1–P4)
A restricted area shows only its name and a lock everywhere: tree, cards and search results. It has no counts, and nothing inside it appears in Today, Flagged, Recent or search. Opening it shows a password gate. A wrong password gives "That password isn't right. Try again." Once open, it stays open for the session, and a "Open for this session · Lock again" pill locks it at once. A restricted file keeps its name visible, hides its note, and asks for the password before opening or downloading. Admins enter passwords too.

### Empty states
They always say what belongs here and give the next action. They never say "No data". Small ones sit inside sections; full ones get the wash art tile.

### Loading
The first connection after sign-in shows skeleton blocks shaped like the page, never a spinner on a blank page. Uploads show a percentage. Images uploading into a MoM show a placeholder with a percentage where the image will land.

### Saving and sync (C2, C3, S1–S3)
The MoM saves 0.8 s after typing stops. The status pill reads Saving… then Saved. ⌘/Ctrl+S saves at once and confirms with a toast. Done saves and returns to where you were. The top bar's sync pill reads Up to date, Catching up (with a banner), or Offline (with a banner). Offline edits read "Saved on this device" and sync on reconnect. Colleagues' changes appear without reloading. In an open MoM they arrive as a bar you apply, so your caret never jumps.

### Motion
Cards lift 2 px on hover. Menus and dialogs fade and rise 12 px. Sheets slide up. Toasts rise in. Durations are 140, 220 and 340 ms on one ease curve. With reduced motion, all of this becomes instant.

### Keyboard (A6)
- ⌘/Ctrl+K: search and jump.
- ⌘/Ctrl+S: save the MoM.
- Esc: closes the top layer. Otherwise it leaves "Select" mode, otherwise leaves the editor for its area, otherwise goes up one area.
- Enter: confirms short forms (password, rename, new area, link).
- ↑ ↓ ↵: move through ⌘K results, the move destinations and the "/" menu.
- Tab: moves through table cells.

---

## 6. Copy and tone

- **Voice:** plain, calm and specific. Short sentences. Talk to "you". No jargon, no blame, and no exclamation marks.
- **Labels are verbs:** "New MoM", "Upload", "Save a link", "Move here", "Restrict with a password", "Lock again", "Show changes".
- **Say where:** "Creating in 🌿 Verdant Foods", "Currently in Verdant Foods · Steering committee", "Adds to Verdant Foods".
- **Errors give a reason and a way forward:** "Too large for storage. PDFs over about 10 MB can't be uploaded yet." plus "Save as link instead". Or "That password isn't right. Try again." Or "Give the link a name so you can find it later."
- **Numbers are real:** "6 days left", "2 sub-areas · 6 MoMs · 9 files", "4 months old", "Select all 13 matching".
- **Dates:** "12 Oct 2026" in content. "Today", "Yesterday" and "3 days ago" for recent activity.
- **Words:** MoM (kept, see P-3), area, sub-area, grouping, file, link, flagged, final, restricted, shared link, Deleted.

---

## 7. Accessibility

- **Contrast:** every text pair meets WCAG AA in both themes. The measured ratios are in the token table. The flag colour (3.5:1) is used only for icons and always sits next to a text label or an accessible name.
- **Focus:** every interactive element shows the same sky ring with a gap. The page itself never shows a ring when it receives focus after navigation.
- **Touch targets:** at least 44 × 44 px everywhere. On touch screens, the desktop sidebar rows grow to 44 px.
- **Keyboard:** everything works without a mouse (see Patterns). Dialogs move focus to their main field (the remarks text in the drawer) and return focus when they close.
- **Screen readers:** icons are decorative (`aria-hidden`). Icon-only buttons have labels ("Flag as important", "More for Steering committee #7"). The save status, sync and toasts are live regions. The tree uses `tree` and `treeitem` roles, and lists and menus use `listbox`, `option` and `menuitem`.
- **Reduced motion:** respected everywhere (see Motion).
- **Language and zoom:** the page is `lang="en"`. Layouts reflow at 200% zoom, because the phone layout takes over.

---

## 8. Notes for building it

- Plain HTML, CSS and JavaScript, with no framework and no build step. Event handling uses `addEventListener` with one delegated listener per event type, never inline handlers.
- The editor look is for **Tiptap** (headless): style its nodes with the `.ed-body` rules, and its menus with the toolbar, bubble and "/" menu components.
- **PWA:** `manifest.webmanifest` plus a service worker that caches the app shell (A3) and shows the "new version" banner when a new worker is waiting (A4). Service workers only run over http(s), so the prototype simulates these with the panel when it's opened from disk.
- Self-host Plus Jakarta Sans for offline use.
- Store passwords only as salted hashes on the server. The prototype's hash is a stand-in.
