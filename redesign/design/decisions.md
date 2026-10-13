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
| _pending_ | **Which direction (or combination) to take forward.** | Step 3. The owner chooses. |

## CDN libraries used

| Library | Where | Could the real app use it? |
|---|---|---|
| Google Fonts: Inter (A, compare page), Plus Jakarta Sans (B), Geist and Geist Mono (C) | `directions/*` | Yes. They can also be self-hosted for offline use (A3). The final choice should be self-hosted so the installed app keeps its typeface offline. |

Icons are inline SVG, and the prototypes use no other libraries. The editor in the directions is a `contenteditable` mock. The real app will use Tiptap, so the look shown here is what Tiptap will be styled to match.

---

## Open questions for the owner

1. **Which direction?** Pick A, B or C, or combine them (e.g. "B's Today page and personality with A's sidebar").
2. **Working names** (Folio / Daybook / Atlas) are placeholders, one per direction. Keep one, or give the product its real name.
3. **Ranking within "weekly".** The weekly tier is unranked, so I propose this order of prominence after the daily jobs: **O5 Move** (you named it the most frequent) → F1 Search → F13 Recent / F4 Continue → F3 Flagged → O4 Groupings → everything else. Is that right?

## Proposals to change the model (not adopted)

- **P-1 · Make "Detailed Remarks" general (W8).** Today this only applies to one journal, identified by its title. Proposal: any table column can be set to **"Long text"**. It stays compact (two lines) when reading, opens a roomy, autosaving editor on tap, and shows in full on demand. A **"Prospect journal" table template** inserts the usual columns with Detailed Remarks already set to Long text. Every job still covered: W8 and W3.
- **P-2 · One kind of grouping.** Right now a MoM grouping holds only MoMs and a file grouping holds only files. Proposal: a single **Section** per area that can hold both, e.g. "Steering committee" holding its minutes *and* its decks. This is fewer concepts, and it's closer to how meetings and their material relate. Every job still covered: O4, C1 and C6 in a grouping.
- **P-3 · Plain-language name for "MoM".** "MoM" is an abbreviation that visitors (V2) and new members may not know. Options: keep **MoM**; use **Minutes**; or use **Meeting notes**. The directions use "MoM" for now, as the inventory does.
