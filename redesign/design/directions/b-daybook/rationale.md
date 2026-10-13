# Direction B — Daybook

**One line:** a bright, friendly *Today* home page and a ⌘K command bar take the place of a sidebar. Everything gets bigger, softer and calmer, and the next thing you'll create is always one tap away.

Open `app.html` (`index.html` just redirects to it). The **Prototype** pill (bottom-left on desktop, top-right on phone) switches role (Admin / Member), shows an empty area, and simulates being offline. It isn't part of the design.

## Navigation model

- **No persistent sidebar.** Desktop has a slim top bar: brand, a wide centred **"Search or jump to… ⌘K"** bar, three pills (Today · Areas · Flagged), sync status and avatar.
- **The command bar is the main way to get around** (F6, F1). It searches areas, MoMs (title and opening text) and files (name and note), grouped by kind, each with its location. It also creates things: "New MoM in 🌿 Verdant Foods", "Upload to…", "Save a link in…", "New area", and "New MoM ‘whatever you typed’".
- **Today** is home (F4). It shows a greeting and the date, quick-create tiles with a "Creating in 🌿 Verdant Foods ▾" place chip, *Continue where you left off* (F13), *Flagged* (F3), and *Recently added across the workspace* (F4b, admins only).
- **Areas** is a grid of large soft cards. An **area page** has a breadcrumb trail of pill chips (F5), a big emoji header with size and age (F8), sub-areas as cards, then *Meeting notes* and *Files & links*. Groupings show as soft labelled **shelves**, each with its own "New MoM here" or "Add here" button.
- **Phone:** a bottom tab bar (Today · Areas · **＋** · Flagged · Search). ＋ opens a "Create in [place]" sheet with *New MoM* as the largest target. Breadcrumbs become a horizontal chip row. The area title moves into the top bar as you scroll. Every dialog becomes a bottom sheet.

## How each daily job works

| Job | Steps |
|---|---|
| **C1** New MoM | One tap on **New MoM** in the hero tile on Today, the area header, a grouping shelf's *New MoM here*, the phone ＋ sheet, or ⌘K → Enter. The editor opens straight away with the title "Meeting – 13 Oct 2026", today's date, and the cursor in the body. Status reads *Saving… → Saved*. ⌘S shows a "Saved" toast. **Done** saves and takes you back to where you were. |
| **C6** Upload | **Upload**, or drop files **anywhere** on an area page (a full-page "Drop to add to Verdant Foods" target appears). The dialog shows the file, an optional name (the file's own name is the placeholder), a note, and a live % bar. **Add file** puts it on the shelf with a toast. **Failure demo:** "try a 14 MB PDF". The upload stops with *Too large for storage* and a plain reason, and **Save as link** opens C7 prefilled. |
| **C7** Save link | Name, web address, a visual chooser for the 6 kinds, and a note. Leaving the name empty shows *Give the link a name so you can find it later*. |
| **F9** Open files | Images open in a lightbox over the page (Esc or ✕ closes it, Download is there too). Everything else shows "Opened in a new tab". Files are tiles with image thumbnails and colour-coded kind badges (F11), with a list view as an alternative. |
| **W3** Tables | Insert from the toolbar or the "/" menu (3 × 3 with a header row). Putting the cursor in a cell shows a floating table bar: add row above/below, add column left/right, move row up/down, move column left/right, delete row/column, delete table (with **Undo**). Column widths can be dragged from the header edge. |
| **W8** Prospect journal | Each *Detailed Remarks* cell shows two lines with an ⤢ button. Tapping it opens a roomy side drawer (a bottom sheet on phone) with company, contact, stage and next step on top. It saves as you type (*Saving… → Saved*) and you can read it in full. New rows get Remarks automatically, and the column can't be deleted or moved. On phone, each journal row becomes a readable card instead of a sideways-scrolling table. |
| **O1** Create area | From the Areas page, an area's *New sub-area* card, ⋯, Today's tile, or ⌘K. It has a name (required), a 24-emoji picker, and a location (Top level or any area, indented). |
| **O5** Move | ⋯ → *Move…* shows "Currently in …", a search over areas and groupings (indented, with their path), a *No destination matches* message, and **Move here**. The toast offers **Undo**. |

Also shown: the Meridian Health restricted area (wrong-password error, then open for the session; the password is "meridian"); filtering and sorting inside an area, with a no-match state; flag and unflag; outside-doc link (C5); tags; "/" insert menu with *Link files* / *Link MoMs* (W6/W7); hash URLs so back, forward and reload work (F7); offline banner and *Saved on this device*; member view (admin-only items hidden; attempts say *Only admins can…*).

## What it optimises for

- **Starting things fast from anywhere.** The quick-create row and the remembered place make C1/C6/C7 one tap from the home screen without hunting for the area first. That matches the owner's habit of "creating new things inside areas".
- **Feeling light.** With no tree chrome, every screen is mostly content: big type, soft colour, generous space. This is the most spacious of the three directions.
- **Phone parity.** The bottom tabs plus a central ＋ are a pattern people already know, and the editor goes full-screen with formatting docked above the keyboard.

## Trade-offs (honest)

- **Deep nesting costs more clicks if you don't use ⌘K.** Without a persistent tree you can't *see* the whole structure at once. Getting from one deep area to another means going back through the breadcrumbs or the command bar. Power users will love ⌘K; occasional members may not find it.
- **Less information per screen.** Large cards and shelves mean more scrolling in busy areas (20+ MoMs). A list toggle exists for files, but not yet for MoMs.
- **The "Creating in" place is invisible state.** It's convenient, but if you forget it changed you can create something in the wrong area. That's mitigated by showing the place in every create dialog and toast, and by Move + Undo.
- **Warm coral is distinctive but opinionated.** It may read as "consumer app" more than "SaaS tool". The palette can be cooled without changing the structure.

## References

Things 3 (calm hierarchy, the Today view), Craft (soft cards, big type), Arc (command bar first), Apple Reminders (friendly colour blocks), Linear's ⌘K.

## Branding proposal (placeholder)

- **Name:** *Daybook*, a record you keep every day. Warm and human, not corporate.
- **Type:** **Plus Jakarta Sans** (Google Fonts), 400–800. Geometric, modern, very readable at small sizes. The interface has no serifs; *Serif* appears only as a typeface option inside the editor (W1).
- **Colour:** warm white `#FCFBF9` base and white cards. Coral `#F2613F` for decoration, darkened to `#C93F1A` for text and filled buttons (4.99:1 on white, AA). Sky blue `#1A6FB0` for links, tags and focus rings. A soft sky→lilac→peach wash on the Today hero. Each file kind has its own tint (PDF red, image violet, video pink, sheet green, slides amber, link blue).
- **Shape:** 16–30 px radii, gentle layered shadows, pill buttons. Logo mark: an open book on a sunrise-gradient tile.
