# Direction C: Atlas (spatial columns)

**Open:** `app.html` (or `index.html`, which redirects to it). The prototype controls (dashed purple pill, bottom-left on desktop, top-right on phone) switch the role between admin and member, show an empty area, simulate being offline, and run a failed upload.

## The idea

The workspace is a **map you can see**. On desktop, areas open as Finder-style columns from left to right. Every level you passed through stays visible, so you always know where you are (F5) without reading breadcrumbs. Whatever you select (an area, a MoM, or a file) opens in a wide, quiet pane on the right. Navigation, filing and creating all happen in the same place, which suits the owner's main work: creating inside sub-areas and groupings, opening files, adding files, and moving them around.

## Where each daily job happens

| Job | How it works |
|---|---|
| **C1** New MoM in one step | Every column header has a **compose** button, and every MoM grouping has a **+** button. One click opens the editor with "Meeting – 13 Oct 2026", today's date, and the cursor already in the body. The area pane has a large **New MoM** button. Press **N** on the keyboard. On phone, use **＋** in the tab bar, which also offers "New MoM in…" for recently used places. |
| **C2 / C3** Saving | A status in the editor bar shows "Saving…" while you type and "Saved" once you pause. ⌘/Ctrl+S saves and shows a "Saved" toast. **Done** (or Esc) takes you back to the columns *exactly* where you were, with the new MoM selected. |
| **C6** Upload | Use the **+** menu, the **+** on a file grouping, or the pane's **Upload file** button. You can also **drag files anywhere on the browser**, and the whole area lights up as a drop target. The dialog shows the name, size and kind, with a live percentage bar, plus optional rename, note and grouping fields. The file appears with a brief highlight and a toast. |
| **C8** Failed upload | A PDF over 10 MB stops at 34% and shows: "Too large for storage… Save it as a link instead". The **Save as link instead** button opens the link dialog with the name and kind already filled in. |
| **C7** Save link | Fields for name, address, and kind (six visual tiles: web link, presentation, PDF/document, spreadsheet, image, other), plus a note and grouping. Missing a name or address shows an inline error. |
| **F9** Open files | Selecting a file shows a large preview card. Images open in a bright, full-size lightbox that closes with Esc or a click on the background. Other files show "Opened in a new tab". |
| **W3** Tables | Put the cursor in a table and a floating table bar appears. It can add rows or columns on either side, move rows up or down, move columns left or right, delete a row, column or the whole table, and insert a new 3 × 3 table with a heading row. Drag a heading's right edge to resize the column. |
| **W8** Prospect journal | The "Detailed Remarks" column stays compact, clipped to two lines with a "Read in full · edit" hint. Tapping it opens a roomy side drawer (a sheet on phone) with a large writing area that autosaves with its own Saving…/Saved status. New rows get a Detailed Remarks cell automatically. This works from both the reading pane and the editor. |
| **O1** Create area | Name, a curated grid of 24 emoji, and a location (top level or any area, shown indented). A missing name shows an inline error. A member who tries this is told "Only admins can create areas." |
| **O5** Move | **Drag** any row onto an area or grouping in any column, or onto a folded "spine". Or use the Move dialog, which shows "Currently in…", lets you search destinations (areas and matching groupings, indented, with their path shown during a search), shows "No destination matches" when nothing fits, and offers **Undo** in the toast. |
| **F4 / F13** Get back to work | With no area selected, the pane shows *Good morning*, with **Continue** (recent items, where MoMs reopen straight into the editor), **Flagged**, and **Recently added** (admins only). On phone this appears at the top of the area list and under the Recent tab. |
| **F6** Reach any area | ⌘K opens one box for searching and jumping, with results grouped by kind and showing paths. On phone, the path pill opens **Go to**, which lists "You are here" and every area. |
| **F7** Web addresses | Hash routes such as `#/browse/clients/verdant/item/f1` and `#/mom/m1`. Back, forward and reload all work. |
| **F8** Size and age | Each column footer reads, for example, "5 MoMs · 8 files · 2 sub-areas / Since Mar 2025 · 1 yr 7 mo". The area pane shows the same figures as large numbers. |
| **P2 / P3** Restricted area | Meridian Health shows a lock, its counts and search results are hidden, and it asks for the password (`meridian`). A wrong password shows an inline error with a shake. After unlocking, it shows "open for this session", with **Lock again**. |

## Personality and branding (proposal)

- **Name:** *Atlas*. The logo is three bars that shorten from left to right, like the columns themselves.
- **Type:** **Geist** for everything, with **Geist Mono** for metadata (dates, sizes, counts, small section labels). That gives an engineered, Swiss feel with no serif in the interface. Inside the editor's content, the "Serif" typeface option uses Source Serif 4, a modern serif rather than a Times-style one.
- **Colour:** a near-white canvas (#FBFBFA) with white panes and hairline dividers in place of boxes. There is **one accent**, teal #0A7D61, which passes AA as text and on buttons, plus a brighter #16B88A used only for dots and highlights. A small orange marks the flag. Each file kind has a soft tint so kinds are easy to tell apart (F11).
- **References:** macOS Finder columns, Apple Notes, the Vercel dashboard's restraint, Things' calm.
- **Calm comes from** white space, large confident headings (40 px, tight letter spacing), and very little chrome. There are almost no shadows: only pop-ups float.

## On phone

The columns become a stack of screens, one level per screen, each with a large title. A tappable **path pill** at the top answers "where am I?" and jumps anywhere. You can swipe from the left edge to go back. The bottom bar holds Areas · Search · **＋** · Flagged · Recent. The editor fills the screen, and its formatting bar sits at the bottom just above the keyboard. Dialogs become bottom sheets. Every touch target is at least 44 px.

## Trade-offs (honest)

- **Width-hungry on desktop.** Three columns plus a pane need about 1280 px. On narrower windows, earlier columns fold into thin "spines" automatically, but in a deep tree you see fewer levels at once than in Finder.
- **Less "home" feeling.** The workspace tree *is* the app. Today's work is one step away (the empty pane, or Recent), but it isn't a dashboard that greets you every time. That's weaker for F4 than a home-first direction, and stronger for filing and moving (O5).
- **Groupings and sub-areas look alike at a glance.** Groupings are labelled rows with a guide line rather than columns of their own. That keeps nesting honest (one level only), but it's a subtle difference to learn.
- **Phone loses the spatial advantage.** On phone it's a well-made screen-by-screen list. The visible map that makes desktop strong doesn't survive at 390 px; the path pill and the Go to sheet stand in for it.
- **Drag to move is desktop-only.** On touch, moving goes through the Move dialog (two taps plus a search).

## Not covered yet (later steps)

Dark theme, selecting several items, the share-link and access-control screens, the member read-only state in the editor, images and file or MoM links inside the editor, the full version of sign-in and account screens, and new-version and sync-conflict states. These come when the chosen direction is expanded.
