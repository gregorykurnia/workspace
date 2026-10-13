# Direction A: Folio, the sidebar workbench

Open `app.html` (`index.html` redirects to it). It's one file with no build step. The only outside resource is the Inter font from Google Fonts.

## The idea

The whole workspace stays visible at all times. A calm sidebar holds the full area tree, and the main pane shows where you are and what's in it. One indigo **New MoM** button sits in the same place on every screen. This is the most structured of the three directions: it suits a desktop-first power user who lives in the app all day, knows the structure well, and wants every area one click away.

**References:** Linear (the inset main panel and how it handles hierarchy), Notion (sidebar tree, documents that feel like pages), Height (dense lists that stay calm).

## Jobs it optimises for

| Daily job | How it works here |
|---|---|
| **C1** New MoM in one step | **New MoM** in the top bar (or the round button on phone) creates the MoM in the area you're looking at. Inside a grouping, use **+ New MoM here**. The editor opens straight away with "Meeting – 13 Oct 2026", today's date, and the cursor in the body. Home has **New MoM in 🌿 *last area*** plus **New MoM in…** for any other place. |
| **C2 / C3** Saves itself, and you know it | A status next to the title shows *Saving…* after a short pause, then *Saved*. ⌘S saves and confirms. **Done** saves and returns you to where you were. |
| **C6** Upload | **Upload** (in the area, the New menu, or a file grouping's **Add file here**), or drag files anywhere onto an area for a full-pane drop overlay. The dialog shows a live progress percentage while you type an optional name and note, then lets you change the area or grouping it goes to. |
| **C8** Upload fails | The "Board pack.pdf · 14 MB" sample fails with a plain reason and **Save as link instead**, which opens Save link with the name and kind already filled in. |
| **C7** Save link | Address first. The kind is guessed from the address (a Google Slides link becomes Presentation) and can be changed with six large tiles. Name and address are required, with inline errors. |
| **F9** Open files | Images open in a bright lightbox with download and copy-address buttons; Esc or clicking outside closes it. Every other kind opens in a new tab (shown with a toast). |
| **W3** Tables | Put the cursor in a table and a small bar appears above it, with **Row ▾**, **Column ▾** and **Delete table**. Rows and columns can be added, deleted and moved; drag a column edge to resize it. The toolbar button inserts a 3 × 3 table with a heading row. |
| **W8** Prospect journal | On desktop the journal uses a wider page. Remarks are cut to two lines, and clicking one opens a roomy side panel with that prospect's details, which saves as you type. **New entry** adds a row at the top with a remarks field ready. If the remarks column is deleted, it comes back automatically. On phone, each entry becomes a card. |
| **O1** Create area | Use **+** next to "Areas", **New sub-area** cards, or the New menu. The dialog has a name, a 20-emoji grid, a location, and a live preview. |
| **O5** Move (most frequent weekly job) | The move icon on hover, or **⋯ → Move to…**. The dialog says where the item is now, searches areas and groupings (with highlighted matches and paths), shows a "no destination matches" state, and supports ↑ ↓ ↵. The toast includes **Undo**. |
| **F5 / F6** Where am I, and jump anywhere | The sidebar tree always shows your position and opens to match it. The breadcrumb hides middle levels behind "…" when the path is deep. ⌘K searches areas, MoMs and files, and also runs create actions. |

Also in the prototype: Home with **Continue where you left off** (F4/F13), Flagged (F3), **Recently added** for admins (F4b), area size and age (F8), filter and sort with a no-match state (F2), restricted areas (P2/P3, password "meridian"), a Deleted bin with days remaining (O9), delete confirmations that state the impact (O8), web addresses for every view (F7), and toasts for every action (S4). The **Prototype** pill switches between admin and member, shows an empty area, and simulates being offline.

## Trade-offs (honest)

- **Strong on desktop, more work on phone.** The tree is the main way to move around, and on phone it sits in a drawer, so getting around a phone takes one extra tap. The breadcrumb title and ⌘K search help, but phone isn't as fast here as in a direction designed phone-first.
- **Less character.** Neutral greys and one accent read as professional and calm, but also like many SaaS tools. It's polished rather than memorable.
- **The tree gets long.** With 50+ areas the sidebar needs scrolling and good collapsing. Pinning or "favourite areas" may be needed later.
- **Today's work is one click away, not in your face.** Home helps, but the app opens into the structure. It doesn't push today's MoMs forward the way a "Today" view would.
- **Hover actions** keep rows tidy on desktop. On touch screens (and on phone) they're always visible or tucked into ⋯, so the two look slightly different.

## What changes on phone

- The sidebar becomes a slide-over drawer. The top bar shows ‹ back, the current title with its path above it (tap it for a "where you are" sheet), the sync dot and search.
- A floating **New MoM** pill plus a round **+** button open a bottom sheet: upload, link, sub-area, grouping.
- Dialogs become bottom sheets. ⌘K becomes full-screen search. The remarks panel goes full-screen.
- The editor toolbar docks at the bottom, above the keyboard, and scrolls sideways. Touch targets are 44 px.
- The prospect journal becomes stacked cards, with remarks cut short and a tap to open them in full.

## Branding proposal

- **Name:** *Folio*, a portfolio of everything for each subject. It's short, neutral and professional. (It's a working name, not checked as a trademark.)
- **Typeface:** Inter, at 400/500/600/700, with its tidier alternate letterforms for a crisp, modern feel. The interface uses only sans-serif type. "Serif" appears only as a typeface choice inside the editor (W1).
- **Colour:** white surfaces on a very light cool-grey canvas (#F7F8FA), with a single **indigo accent (#4F46E5)** used for primary actions, selection and focus. File kinds are colour-coded with soft tints (PDF red, image teal, video pink, link blue, spreadsheet green, presentation orange). Flags are amber.
- **Shape:** 8–10 px corners on controls, 14–16 px on cards and dialogs, hairline borders, and shadows only on things that float.
- **Logo:** an indigo rounded square with a folded white page.

## Accessibility notes

Inter on white passes AA (body text #101828, secondary text #475467 and #667085). Focus rings are visible indigo outlines. Escape closes any overlay, Enter submits short forms, and ⌘S and ⌘K work everywhere. Touch targets are 44 px on phone and other touch screens. Desktop mouse rows are 34–36 px to keep the tree compact. Reduced motion turns animation off.
