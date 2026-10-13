# Decisions

Choices made, open questions, and proposals for the owner. Nothing in "Proposals" is adopted until the owner says so.

---

## Decided

| Date | Decision | Why |
|---|---|---|
| 2026-10-13 | Three directions explored: **A · Folio** (sidebar tree), **B · Daybook** (Today hub and command bar), **C · Atlas** (Finder-style columns). | Step 2. They vary the navigation model, personality and type while all staying bright, spacious and light-first as the brief asks. |
| 2026-10-13 | Directions are designed in light mode only. Dark mode is designed in step 4, on the chosen direction. | The brief puts light first. Dark is secondary but still required. |
| 2026-10-13 | The interface uses sans-serif type only. "Serif" exists only as a content typeface inside the editor. | The brief rules out a classic serif feel. W1 still requires a serif option for note text. |
| 2026-10-13 | Each direction's page is `app.html`, and `index.html` is a one-line redirect to it. | The studio's permission settings block the file tools on any file named `index.html`, probably as part of the firewall. The redirect keeps the required `index.html` entry point. |
| 2026-10-13 | **Chosen: combine B · Daybook with A · Folio's sidebar.** (C · Atlas not taken forward.) | Owner's choice. B has the welcome-back home page and warm brightness; A's sidebar keeps the area structure visible on desktop. |
| 2026-10-13 | **Colour: A · Folio's indigo replaces B's coral.** B's shapes, spacing, soft washes, large radius and Plus Jakarta Sans stay. The washes move to cool tones (sky to lavender). One small warm accent (amber) is kept for flags and highlights so the product doesn't look generic. | Owner prefers the blue-ish scheme. Designer agrees, with the amber accent added to keep some character. |
| 2026-10-13 | **Owner: "go with your recommendations"** on the open questions below. P-1 is adopted. P-2 and P-3 are not adopted for now (separate groupings and "MoM" stay). The proposed ranking of the weekly jobs is adopted. | All can be revisited. |
| 2026-10-13 | **Step 4 prototype structure.** `prototype/app.html` loads `../tokens.css`, `styles/*.css` and `js/*.js` as classic scripts (no modules), so it runs straight from disk. | Matches the real app's plain HTML/CSS/JS with no build step. |
| 2026-10-13 | **No `prototype/index.html` yet.** The studio's permission settings refuse that file name for both the file tools and the shell. Open `prototype/app.html` directly. | Needs a permission change, not a design change. See open question 5. |
| 2026-10-13 | **Review pass (owner asked for a strict check and rebuilds).** Rebuilt: the editor header (on desktop the top bar becomes the editor's header: breadcrumb ending in the MoM title, save status, flag, ⋯, Done; this replaced three stacked rows); the formatting toolbar (typeface, size, text colour and highlight in one "Aa" menu, alignment in one menu, so it fits without scrolling); the empty workspace (leads with "Create your first area"); the area counts (now include sub-areas and never count what is inside a closed restricted area). Fixed: dark-mode fills failing contrast, bullets not showing, the US-style date, the journal's cramped Detailed Remarks column, the bulk bar not appearing, touch targets under 44 px in the sidebar, the signed-in person not following the role. | A model change mid-step made the owner unsure of the first build. Every screen was then reviewed in light and dark, on phone and desktop. |
| 2026-10-13 | **Separate fill tokens.** `--accent-fill` / `--on-accent` are used for filled buttons and tiles; `--accent-strong` is only for accent text. | In dark mode the text accent is light lavender, and white on it measured 1.99:1. The fill now measures 6.2:1 in dark and 7.9:1 in light. |
| 2026-10-13 | **Today's fourth tile is "New area" for admins** (members see "Flagged"). | Creating areas is a daily job (O1); Flagged already has its own place in the sidebar and the phone tabs. |
| 2026-10-13 | **An item's own share link wins over its area's link.** If a MoM's or file's link is turned off, it is hidden from a shared area too, and its direct link says "no longer available". | Turning a link off must stop it working (P5). Otherwise the item would still be visible through the area. |
| 2026-10-13 | **Deleting is admin-only for MoMs and files as well as areas**; members can still restore, remove for good, and empty Deleted. **Admins can still edit items marked final**; only members are read-only. | Both follow the roles table in the inventory exactly. |
| 2026-10-13 | **Appearance setting** on the account page: Light (default), Dark, Match system. | The brief makes light the default and dark secondary. A visible choice lets people keep light even when their device is dark. |
| 2026-10-13 | **Prototype personas:** the admin is the owner; the member is Priya Nair (granted Verdant Foods and Weekly sync); the new member is Sam Lee (no areas). | Lets every role be reviewed with realistic data. |

### What the combination takes from each

| From **B · Daybook** | From **A · Folio** |
|---|---|
| **Today** home page: Continue (F4/F13), one-tap create with a "Creating in" place chip, Flagged, and Recently added (F4b) | **Always-visible left sidebar on desktop:** Today, Flagged, Recent, the collapsible **area tree**, then Deleted and account at the bottom (F5/F6) |
| Personality: Plus Jakarta Sans, soft bright colour washes (now in cool tones; colour is indigo, see above), large radius, the most spacious layout | Breadcrumb in the top bar of every area and MoM |
| ⌘K command bar for jumping and creating | "+ New MoM here" inside each grouping, and a split **New** button in the top bar |
| Files as visual tiles with image samples, with a list/grid switch | Compact row lists, an option for busy areas |
| Editor: centred canvas, a floating bar for formatting selected text, a "/" insert menu, and a minimal top toolbar | |
| **Phone:** bottom tabs (Today · Areas · ＋ · Flagged · Search) and the create sheet. The **Areas** tab shows A's tree as a full screen. | |

The sidebar is restyled in B's look: a soft tinted panel rather than a grey utility column, and spacing is kept generous so the combination stays calm.


## CDN libraries used

| Library | Where | Could the real app use it? |
|---|---|---|
| Google Fonts: Inter (A, compare page), Plus Jakarta Sans (B), Geist and Geist Mono (C) | `directions/*` | Yes. They can also be self-hosted for offline use (A3). The final choice should be self-hosted so the installed app keeps its typeface offline. |
| Google Fonts: Source Serif 4, used only as the editor's "Serif" content option | `directions/c-atlas` | Yes. It's a modern serif used only for note text, never for the interface. |

| Google Fonts: Plus Jakarta Sans | `prototype/` | Yes, but self-host it so the installed app keeps its typeface offline (A3). |

Icons are inline SVG, and the prototypes use no other libraries. The editor in the directions and the prototype is a `contenteditable` mock (it uses the browser's own editing commands). The real app will use Tiptap, so the look shown here is what Tiptap will be styled to match. The prototype's service worker and manifest (`prototype/sw.js`, `prototype/manifest.webmanifest`) are plain browser APIs, not libraries.

---

## Open questions for the owner

1. ~~**Which direction?**~~ Decided 2026-10-13: B combined with A's sidebar (see above).
2. **Working names** (Folio / Daybook / Atlas) are placeholders, one per direction. Keep one, or give the product its real name.
3. ~~**Ranking within "weekly".**~~ Adopted 2026-10-13 as proposed. The weekly tier is unranked, so I propose this order of prominence after the daily jobs: **O5 Move** (you named it the most frequent) → F1 Search → F13 Recent / F4 Continue → F3 Flagged → O4 Groupings → everything else. Is that right?
4. **PDF export (W9).** The prototype shows an A4 preview and uses the browser's print-to-PDF. Should the real app generate the PDF itself (exact layout, file named after the title, no print dialog) instead? I recommend generating it, so the name and layout are guaranteed.
5. **`index.html` entry point.** The permission settings in this studio block that file name. If you allow writing `redesign/design/prototype/index.html`, I'll add the one-line redirect so the folder opens by itself.
6. **Spell-check (W10).** The design relies on the browser's built-in spell-check (red underlines, right-click suggestions). Is that enough, or do you need a shared custom dictionary (client names, product terms)?

## Proposals to change the model (not adopted)

- **P-1 · Make "Detailed Remarks" general (W8).** ✅ *Adopted 2026-10-13.* Today this only applies to one journal, identified by its title. Proposal: any table column can be set to **"Long text"**. It stays compact (two lines) when reading, opens a roomy, autosaving editor on tap, and shows in full on demand. A **"Prospect journal" table template** inserts the usual columns with Detailed Remarks already set to Long text. Every job still covered: W8 and W3.
- **P-2 · One kind of grouping.** ⏸ *Not adopted for now: separate MoM and file groupings stay. Still open.* Right now a MoM grouping holds only MoMs and a file grouping holds only files. Proposal: a single **Section** per area that can hold both, e.g. "Steering committee" holding its minutes *and* its decks. This is fewer concepts, and it's closer to how meetings and their material relate. Every job still covered: O4, C1 and C6 in a grouping.
- **P-3 · Plain-language name for "MoM".** ⏸ *Not adopted for now: "MoM" stays. Still open.* "MoM" is an abbreviation that visitors (V2) and new members may not know. Options: keep **MoM**; use **Minutes**; or use **Meeting notes**. The directions use "MoM" for now, as the inventory does.
