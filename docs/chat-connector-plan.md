# Save from Claude chat to Workbench (chat connector)

AI Build Log project: workspace

**What the owner asked (2026-11-12).** "Send a Claude chat or results of a Claude chat, say a meeting summary or the
inside of an artifact, or a PDF it generates … directly to Workbench. The Claude chat will suggest which
sub-area/subfolder it should go into, or if it's not sure it can ask me to double check … then it will put it either
as an MoM or as a link or as a file."

**Smallest design that does it.** One MCP server inside this Vercel project, added once in claude.ai as a custom
connector. Four tools: `list_places` (read only), `save_mom`, `save_link`, `save_file`. Claude reads the list of
areas, proposes the place and the form in chat, saves only after the owner says yes, and answers with a link that
opens the item in the app. Claude chooses the place itself: no AI call on the server, no new screen in the app.

Safeguards beyond that, each for a risk the simple design leaves open:
- **Secret address** `/api/mcp/<MCP_SECRET>`, 404 for anything else: the address is public, and whoever holds it can
  write (the same pattern as the Teams DEUS connector).
- **The server filters privacy itself** (`privateTo`, `deleted`): the admin key skips the security rules, so without
  it chat would see other admins' private areas.
- **A signed upload address, valid 15 minutes:** a PDF Claude makes sits in its code sandbox and is too big to pass
  inside a tool call, so the sandbox sends it with `curl`; the upload endpoint is public, so the address names the
  area and file name and expires.
- **4 MB file cap with a plain message:** Vercel refuses request bodies over 4.5 MB.

Cut (follow-ups if wanted): sign-in per person (OAuth) so teammates connect as themselves; creating an area or
grouping from chat; deleting; a preview token or duplicate check (a double save shows as two items, easy
to delete); a "from Claude" badge in the app.

**Phase 2 ask (2026-11-12).** "From Claude chat, it can also reference and pull exact content of MoM's, files etc.
from the Workbench … say if I refer 'pull up our notes from x meeting on x date' … and if unclear it can ask me for
which company etc. till we find it", and then: "Is it possible to also edit the MoM from Claude chat?"

**Smallest design for it.** Three more tools on the same connector: `find_items` (MoMs, files and links by words,
area and dates, with no contents), `read_mom` (one MoM as markdown in numbered sections) and `edit_mom` (add to the
end, or replace one section). Claude narrows the search by asking the owner, as it already does before a save; the
server has no AI. Files and links come back as their name, note and address, not their contents.

Safeguards beyond that, each for a risk the simple design leaves open:
- **The read tools filter privacy and locks** exactly as `list_places` does: the admin key skips the security rules.
- **A stale-copy check** (`expectEdited`): an edit based on an old read would wipe a change made in the app since.
- **Edits write `edited`, `prevEdited` and `editedBy` the way the app does:** an editor with the MoM open then merges
  the chat edit instead of saving over it.
- **A backup per edit, and `undo`:** the app keeps no history, so a wrong rewrite would be lost for good.
- **No rewrite of a section with formatting markdown can't hold** (colours, highlights, fonts, alignment, images,
  journal tables): the round trip would drop it. Adding to the end is always allowed.

Cut from Phase 2 (follow-ups if wanted): changing a MoM's title, date or tags; deleting; editing files or links;
reading inside PDFs; undoing more than the latest chat edit.

**Branch.** Every task runs on `chat-connector` (made from `main`, 2026-11-12). At the start of a session,
`git switch chat-connector`, and `git merge main` if `main` moved. Pushes there only make a Vercel preview; the
connector reaches production at O2 (Phase 2 at O5). It doesn't depend on the `email-link` plan (`docs/IMPLEMENTATION_PLAN.md`).

**Tests never touch live data.** Every connector test runs on the emulators (`demo-workspace`) through
`npm run test:mcp`, which refuses to start unless `FIRESTORE_EMULATOR_HOST` is set and the project is `demo-…`.
Cloudinary is a fake `fetch` in tests.

**Run it with** `autorun all docs/chat-connector-plan.md`.

## Before the run
- [x] Nothing to set up: every task runs on the emulators. The owner's settings come after the review (O1–O4).

## Phase 1: The connector
Phase 1 and its release (C1–C4, R1, O1–O4): done, see `docs/chat-connector-plan-done.md`.

## Phase 2: Find, read and edit MoMs from chat
- [x] C5 `find_items` and `read_mom` (spec §F, §G). Files: `api/_lib/reads.mjs` (new), `api/_lib/server.mjs`, `package.json` (an HTML-to-markdown library, exact version), `tests/mcp/`. Read `js/data/content.js` (`isDeltaContent`, `plainText`, `NOTE_TAGS`) for the stored formats; copy nothing about the screen. Done when: `npm run test:mcp` passes, and tools/list shows six tools; `find_items` narrows by words, area, dates and kind; a body match carries a snippet; files and links carry their stored address; never listed, and `read_mom` answers each with the same "not found" as a missing id: another admin's private area, a deleted item, an item in a hidden grouping, anything under a locked area, a file with its own lock; a seeded editor MoM (headings, bullets, table, coloured text, image) comes back as markdown in numbered sections, with the coloured and image sections marked `plain: false`; an old-format (Delta) MoM comes back as text with `format: 'old'`; `node --check` on changed files; the Vercel preview of the pushed commit built [no look] · Sol Max: reads every MoM's contents through the admin key, so the privacy filter is security work
- [x] C6 `edit_mom` (spec §H). Files: `api/_lib/edits.mjs` (new), `api/_lib/server.mjs`, `tests/mcp/`, `tests/rules/rules.test.mjs`. Done when: `append` and `replace_section` write the new content, `edited`, `prevEdited`, `editedBy` and a `mom_backups` record in one transaction; refused with nothing written: a stale `expectEdited`; a hidden, locked or missing MoM; an old-format MoM; a section that isn't plain or doesn't exist; a result over 500 KB; a `<script>` or `onclick` in the markdown is stripped, as in `save_mom`; `undo` puts back the backup only while the MoM hasn't changed since that chat edit; otherwise it's refused; `npm run test:rules` proves a signed-in admin can't read or write `mom_backups`; `npm run test:mcp` passes; `node --check` on changed files [no look] · Sol Max: writes saved data
- [x] C7 What Claude is told, and end to end (spec §I). Files: `api/_lib/instructions.mjs`, `api/_lib/server.mjs` (tool descriptions), `tests/mcp/protocol.test.mjs`, `tests/chat-connector.spec.js`. Done when: the server's instructions hold §E's and §I's steps, and each new tool's description repeats its step briefly; the protocol test drives `find_items` → `read_mom` → `edit_mom` append → replace a section → undo over Streamable HTTP; Playwright, the seeded admin with the MoM open in the editor: with no typing, the appended paragraph appears; with unsaved typing, after the save both the typed text and the appended paragraph are in the stored content; a replaced section shows its new text; `npm run test:unit` and `npm run test:mcp` pass [no look] · Sol Max: end-to-end specs
- [x] R2 Phase 2 review: read C5–C7's diff against §F–§I; run `npm run test:unit`, `npm run test:mcp`, `npm run test:rules` and `npm run test:emu` once; hunt for MoM content reachable from a hidden or locked item through any tool or error message, an edit that skips the stale check or the backup, and a section rewrite that drops formatting · Opus 5.5 High: phase review of Sol-built work
- [x] 2.F1 Markdown round trip keeps every word (spec §G, §H). Files: `api/_lib/reads.mjs`, `tests/mcp/reads.test.mjs`, `tests/mcp/edits.test.mjs`. Found by R2: a table cell holding two paragraphs or a list reads as one run-on word (`<td><p>one</p><p>two</p></td>` → "onetwo") and is marked `plain`, so `replace_section` saves the merged text; text that looks like a tag (`&lt;name&gt;`, `&lt;script&gt;`) comes out of `read_mom` unescaped and the rewrite's sanitizer deletes it; other `plain: true` losses: a merged cell (`colspan`/`rowspan` over 1), a table without a header row, empty paragraphs (blank lines), `<u>` inside a link. Fix each by keeping it through the round trip (cells: blocks joined with `<br>`; text `<` escaped) or by marking the section `plain: false`. Done when: a test runs each case through `splitSections` → `markdownToHtml` and gets the same words and formatting back or `plain: false`, and `read_mom` quotes the cell text with its line break; `npm run test:mcp` passes; `node --check` on changed files [no look] · Sol Max: fix of C5's converter

## Release 2 (owner)
- [ ] O5 *owner*: say "release the connector". Claude merges `main` into `chat-connector` if it moved, runs
  `npm run test:unit` and `npm run test:mcp`, then `git push origin chat-connector:main` (fast-forward only; if it's
  blocked, run it yourself with `!`), and checks `/api/mcp/wrong` answers 404 on the live site. No new settings.
- [ ] O6 *owner*: in a new chat (so claude.ai picks up the new tools), ask "pull up our notes from <a real meeting>"
  without naming the company; check Claude asks until one MoM is left and quotes it. Then on a test MoM: add a line,
  rewrite one section, ask Claude to undo it; check each in the app.

## Spec

**§A Server.** `api/mcp/[secret].mjs`: a Vercel Node function taking a web `Request`. Same libraries and versions as
`~/deus-team-tasks/app/api/mcp/[secret]/route.ts` (`@modelcontextprotocol/sdk` 1.26.0, `mcp-handler` 1.1.0, `zod`
4.4.3); read it for the pattern (constant-time secret check, POST only, stateless, JSON-RPC checks before the SDK),
copy nothing about tasks. `.mjs` because `package.json` has no `"type": "module"` and Playwright's config is CommonJS.
Shared code in `api/_lib/` (Vercel doesn't route `_` folders). Move `firebase-admin` to `dependencies` with the new
libraries. Admin app from `FIREBASE_SERVICE_ACCOUNT` (base64 JSON); on the emulators, project `demo-workspace` and no
key. The owner is `WORKBENCH_OWNER_EMAIL`, looked up once per instance through Admin Auth (uid, display name). App
links use the request's origin: a MoM is `<origin>/#/mom/<id>`, an area `<origin>/#/areas/<id>`. `test:mcp` =
`firebase emulators:exec --only auth,firestore --project demo-workspace "node --test tests/mcp/*.test.mjs"`.

**§B `list_places({ query? })`, read only.** Every area the owner can see: `privateTo` null or the owner's uid, not
`deleted`, and every parent also visible. Per area: `id`, `path` ("Clients › Acme › Board"), `private`, `locked`
(a `pw` on it or a parent), its groupings (`id`, `name`, `holds`: `mom`, `file` or `both`, worked out as the app does
in `js/ui/area.js`'s groupings), and its 3 latest MoM titles with dates (none for a locked area). `query` keeps areas
whose path, grouping names or titles contain its words (any case), plus their parents. At most 200 areas, `hasMore`.

**§C `save_mom` and `save_link`.** `save_mom({ areaId, groupId?, title, date?, markdown, tags? })`: `date` is
`yyyy-mm-dd` (default today in Asia/Jakarta), stored as the app stores it. Markdown → HTML with `marked`, then
`sanitize-html` keeping only what `js/editor/tiptap.js` opens: p, h1–h3, strong, em, u, s, a (http, https, mailto),
ul, ol, li, blockquote, code, pre, hr, br, table, thead, tbody, tr, th, td. Task items (`- [ ]`, `- [x]`) become
list items starting with ☐ or ☑ (the editor has no checklist). Fields as `createMom` in `js/data/actions.js`, plus the
area's `privateTo`, `createdBy {uid, name}`, `source: 'claude-chat'`, `edited`. Content over 500 KB is refused.
`save_link({ areaId, groupId?, name, url, kind?, note? })`: http or https only; `kind` from `LINK_TYPE` in
`js/ui/files.js`; the record as that file's Save link writes, plus `privateTo` and `source`. Each returns
`{ id, path, url }`. A grouping must belong to the area and hold that kind of item.

**§D `save_file`.** `save_file({ areaId, groupId?, name, note?, text?, base64? })`, `name` with its extension. At most
one of `text` (md, html, csv, txt, json, svg; ≤ 1 MB) or `base64` (≤ 1 MB decoded) saves straight away. With neither,
it returns `{ uploadUrl, expiresAt, curl }`, the `curl` line being `curl -sS -F file=@<path> '<uploadUrl>'`.
`uploadUrl` = `<origin>/api/upload/<token>`; token = base64url(payload) + "." + HMAC-SHA256 of it with `MCP_SECRET`;
payload `{ areaId, groupId, name, note, exp }`, 15 minutes. `api/upload/[token].mjs`: POST, multipart, one file,
≤ 4 MB; checks signature and expiry, checks the area again, sends the file to Cloudinary with the unsigned preset and
the type routing of `js/data/uploads.js`, writes the record as the app's upload does (`js/ui/files.js`, the
`uploaded: true` record) plus `privateTo` and `source`, and answers `{ id, path, url }`. Cloudinary's size and type
errors become plain messages (too big → "save it as a link instead").

**§E What Claude is told** (the server's `instructions`, repeated briefly in each tool's description):
1. Pick the form: notes, summaries, a written artifact or a whole chat → MoM; anything already at a web address
   (Google Doc or Drive, a published artifact, a Claude Doc, a site) → link; a file Claude made or the owner uploaded
   (PDF, Word, Excel, slides, image, HTML) → file.
2. Call `list_places` with the client, project or topic words of the content; without a query if nothing matches.
3. Propose in one short message: form, title, full path (area › grouping), one line on why. If two places fit about
   equally or none fits well, offer up to three and let the owner pick or name another. Never invent an area.
4. Save only after the owner's yes in chat; the tool approval prompt isn't a yes. If the owner already named the
   place and form, don't ask again.
5. Files: run the `curl` line in the code sandbox. If the sandbox can't reach the address, use `base64` under 1 MB;
   otherwise say so and offer to save a link instead.
6. After saving, give the link. On an error, say it plainly; if a save's answer was lost, ask before trying again
   (it may have saved).

**§F `find_items({ query?, areaId?, from?, to?, kind? })`, read only.** Finds MoMs, files and links so Claude can
narrow down "our notes from x meeting". `kind` is `mom`, `file` (a `docs` record with `uploaded: true`) or `link`
(any other `docs` record); omitted, all three. `query`'s words (any case) must all appear somewhere in the item's
title or name, tags, note, area path or grouping name, or, for a MoM, its body text (`plainText`'s rules in
`js/data/content.js`; a Delta MoM's text is its `ops` inserts). `areaId` keeps that area and the areas under it.
`from` and `to` are `yyyy-mm-dd`, inclusive, as Asia/Jakarta days, on a MoM's `date` and a file's `added`. Visible
means: the item, its grouping (`momFolderId` or `docFolderId`) and every area up its chain pass `isVisible`; no
area on the chain has a `pw`; a file has no `pw` of its own. Newest first, at most 20, with `total` and `hasMore`.
Each result: `kind`, `id`, `title`, `date` (`yyyy-mm-dd`), `path` ("Clients › Acme › Board"), `tags`,
`matchedIn` (`title`, `place` or `body`), `snippet` (about 120 characters around the first body match, body matches
only) and `url` (the app link, as §A); files and links also `address` (the stored `url`) and `note`. Never content.

**§G `read_mom({ id })`, read only.** One MoM, for quoting or answering from it. A MoM that is missing or that §F
wouldn't show gets the same answer: "No MoM with that id." Returns `id`, `title`, `date`, `path`, `tags`, `url`,
`edited` (the stored value, or null), `format` (`html`, or `old` for Delta content) and `markdown`. For `html`, also
`sections`: the top-level blocks split before each h1–h3 (section 0 is anything before the first heading), each
`{ n, heading, markdown, plain }`. HTML → markdown with one library (tables kept as GFM tables, ☐/☑ list items kept
as text, links kept). `plain` is true when every element in the section is one `save_mom` writes (§C's tag list)
and no element has a `style`, `class`, `data-*` or `colwidth` attribute; images, colours, highlights, fonts,
alignment and the prospect-journal table (`data-template`) make it false. `old` MoMs have no sections.

**§H `edit_mom({ id, expectEdited, mode, section?, markdown? })`.** Changes one MoM's body, nothing else. In one
Firestore transaction: the MoM must pass §G's visibility (else "No MoM with that id."), have `format` `html` (else
"This MoM is in the old format: open it in Workbench once, then try again."), and its stored `edited` must equal
`expectEdited` (null matches a MoM never edited; else "This MoM changed since you read it: read it again."). Modes:
- `append`: `markdown` → HTML with `save_mom`'s converter and sanitizer, added after the existing content.
- `replace_section`: section `section` (numbered as `read_mom` numbers them) must exist and be `plain`; its blocks,
  heading included, are replaced by `markdown` converted the same way. Every other block stays byte for byte.
- `undo`: the newest `mom_backups` record for this MoM whose `afterEdited` equals the stored `edited` puts back its
  `content`; none → "Nothing to undo: the MoM changed after the last chat edit."
A result over 500 KB is refused. Each write sets `content`, `edited` (now), `prevEdited` (the old `edited` when it's
a number), `editedBy {uid, name}` (the owner), and adds `mom_backups/<new id>` = `{ momId, content (before),
edited (before), afterEdited, mode, savedAt }`. `mom_backups` is server-only: `firestore.rules` has no catch-all,
so clients are already refused; C6 adds a rules test that proves it. Returns `{ id, url, edited, backupId }`.

**§I What Claude is told, added to §E:**
7. Finding: call `find_items` with the meeting, client or topic words and any date the owner gave. Turn a relative
   date ("last Tuesday") into `yyyy-mm-dd` from today in Asia/Jakarta and say the date used; for a date without a
   year, use the latest one not in the future. One match → `read_mom`. Several → list up to five (title, date, path)
   and ask which; none → say so, ask for the company, area or rough date, and search again with fewer words. Never
   pick between matches yourself.
8. When asked for the notes or exact content, quote what `read_mom` returns; say so when summarising instead.
9. Editing: `read_mom` first. Show the change (for an append, the new text; for a section, before → after) and edit
   only after the owner's yes in chat. Prefer `append`; replace a section only when asked to change existing text.
   If the section isn't plain, say its formatting would be lost and offer to append instead. On "changed since you
   read it", read again and show the change again. After an edit, give the link and say "undo" puts it back.
