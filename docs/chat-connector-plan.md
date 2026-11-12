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
grouping from chat; editing or deleting; a preview token or duplicate check (a double save shows as two items, easy
to delete); a "from Claude" badge in the app.

**Branch.** Every task runs on `chat-connector` (made from `main`, 2026-11-12). At the start of a session,
`git switch chat-connector`, and `git merge main` if `main` moved. Pushes there only make a Vercel preview; the
connector reaches production at O2. It doesn't depend on the `email-link` plan (`docs/IMPLEMENTATION_PLAN.md`).

**Tests never touch live data.** Every connector test runs on the emulators (`demo-workspace`) through
`npm run test:mcp`, which refuses to start unless `FIRESTORE_EMULATOR_HOST` is set and the project is `demo-…`.
Cloudinary is a fake `fetch` in tests.

**Run it with** `autorun all docs/chat-connector-plan.md`.

## Before the run
- [x] Nothing to set up: every task runs on the emulators. The owner's settings come after the review (O1–O4).

## Phase 1: The connector
- [x] C1 Server and places (spec §A, §B, §E). Files: `api/mcp/[secret].mjs`, `api/_lib/`, `package.json` (runtime `dependencies`, script `test:mcp`), `tests/mcp/`. Done when: `npm run test:mcp` passes; wrong secret → 404, GET → 405, a missing setting → a plain error naming it, never a value; `list_places` hides another admin's private area, deleted areas and areas under a hidden parent, shows the owner's private area marked private, shows no MoM titles for a locked area, and `query` narrows while keeping parents; the test guard refuses to run off the emulator (unit test); `node --check` on changed files; the Vercel preview of the pushed commit built (`gh api repos/gregorykurnia/workspace/commits/<sha>/status`) [no look] · Sol Max: reads the whole workspace through the admin key, so the privacy filter is security work
- [ ] C2 `save_mom` and `save_link` (spec §C). Files: `api/_lib/`, `tests/mcp/`. Done when: a markdown sample (headings, bold, link, bullets, numbers, task items, table, a `<script>`, an `onclick`) converts to the expected HTML with the script and handler gone; a saved MoM carries the area's `privateTo`, `createdBy`, `source`, `edited`, and `momFolderId` when a grouping is given; a link record has the same fields as the app's Save link; refused with nothing written: hidden area, another admin's private area, another area's grouping, a files-only grouping, empty title, a `javascript:` or non-http link [no look] · Sol Max: writes saved data
- [ ] C3 `save_file` and the upload endpoint (spec §D). Files: `api/upload/[token].mjs`, `api/_lib/`, `tests/mcp/`. Done when `npm run test:mcp` passes: `text` and `base64` saves reach the fake Cloudinary with the right type (pdf → raw, png → image); no content → `uploadUrl` and a `curl` line, and a good upload saves the file record and returns its link; expired, edited or wrongly signed token → 403, over 4 MB → 413, area deleted or made private by another admin since the address was made → refused, Cloudinary failure → plain message, nothing written in each case [no look] · Sol Max: a public endpoint and a signed address
- [ ] C4 End-to-end (spec §E): `tests/mcp/protocol.test.mjs` runs a local HTTP server around both handlers and drives it with the MCP SDK `Client` over Streamable HTTP (tools/list → `list_places` → `save_mom` → `save_link` → `save_file` → POST the file to its `uploadUrl`); Playwright `tests/chat-connector.spec.js` (added to the emulator list in `playwright.config.js`) has the seeded admin open the saved MoM's link. Add one line to `CLAUDE.md`'s project structure pointing to this plan. Done when: tools/list shows the four tools and the server's instructions hold §E's steps; every returned link opens the right item; the MoM shows its heading, bullet list, ☐ item and table in the editor, and opening it doesn't rewrite it; the area shows the saved link and file; `npm run test:unit` still passes [no look] · Sol Max: end-to-end specs
- [ ] R1 Phase 1 review: read C1–C4's diff against §A–§E; run `npm run test:unit`, `npm run test:mcp` and `npm run test:emu` once; hunt for a secret, key or token in a log, error or response, a hidden item reachable through any tool, and an upload that skips the signature or the size cap · Opus 5.5 High: phase review of Sol-built work

## Release (owner)
- [ ] O1 *owner*: in Vercel → workspace → Settings → Environment Variables, **Production only**:
  `MCP_SECRET` (make one with `openssl rand -hex 24`), `WORKBENCH_OWNER_EMAIL` (your sign-in email) and
  `FIREBASE_SERVICE_ACCOUNT` (the output of `base64 -w0 ~/.config/workbench/firebase-admin.json`). Never in Preview.
- [ ] O2 *owner*: say "release the connector". Claude merges `main` into `chat-connector` if it moved, runs
  `npm run test:unit` and `npm run test:mcp`, then `git push origin chat-connector:main` (fast-forward only; if it's
  blocked, run it yourself with `!`), and checks `/api/mcp/wrong` answers 404 on the live site.
- [ ] O3 *owner*: claude.ai → Settings → Connectors → Add custom connector → name "Workbench", address
  `https://workspace-mzyz.vercel.app/api/mcp/<MCP_SECRET>`. For files Claude makes: Settings → Capabilities → code
  execution network access → allow `workspace-mzyz.vercel.app`. Without it, files under 1 MB still save, larger
  ones go as a link.
- [ ] O4 *owner*: in a normal chat, save a meeting summary (MoM), a link and a PDF Claude made; check Claude
  proposed the place and waited for your yes; open each returned link on your phone.

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
