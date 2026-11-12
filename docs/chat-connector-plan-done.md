# Chat connector: finished rows

Moved from `docs/chat-connector-plan.md` once their review was ticked. The spec stays in the live plan.

## Phase 1: The connector
- [x] C1 Server and places (spec §A, §B, §E). Files: `api/mcp/[secret].mjs`, `api/_lib/`, `package.json` (runtime `dependencies`, script `test:mcp`), `tests/mcp/`. Done when: `npm run test:mcp` passes; wrong secret → 404, GET → 405, a missing setting → a plain error naming it, never a value; `list_places` hides another admin's private area, deleted areas and areas under a hidden parent, shows the owner's private area marked private, shows no MoM titles for a locked area, and `query` narrows while keeping parents; the test guard refuses to run off the emulator (unit test); `node --check` on changed files; the Vercel preview of the pushed commit built (`gh api repos/gregorykurnia/workspace/commits/<sha>/status`) [no look] · Sol Max: reads the whole workspace through the admin key, so the privacy filter is security work
- [x] C2 `save_mom` and `save_link` (spec §C). Files: `api/_lib/`, `tests/mcp/`. Done when: a markdown sample (headings, bold, link, bullets, numbers, task items, table, a `<script>`, an `onclick`) converts to the expected HTML with the script and handler gone; a saved MoM carries the area's `privateTo`, `createdBy`, `source`, `edited`, and `momFolderId` when a grouping is given; a link record has the same fields as the app's Save link; refused with nothing written: hidden area, another admin's private area, another area's grouping, a files-only grouping, empty title, a `javascript:` or non-http link [no look] · Sol Max: writes saved data
- [x] C3 `save_file` and the upload endpoint (spec §D). Files: `api/upload/[token].mjs`, `api/_lib/`, `tests/mcp/`. Done when `npm run test:mcp` passes: `text` and `base64` saves reach the fake Cloudinary with the right type (pdf → raw, png → image); no content → `uploadUrl` and a `curl` line, and a good upload saves the file record and returns its link; expired, edited or wrongly signed token → 403, over 4 MB → 413, area deleted or made private by another admin since the address was made → refused, Cloudinary failure → plain message, nothing written in each case [no look] · Sol Max: a public endpoint and a signed address
- [x] C4 End-to-end (spec §E): `tests/mcp/protocol.test.mjs` runs a local HTTP server around both handlers and drives it with the MCP SDK `Client` over Streamable HTTP (tools/list → `list_places` → `save_mom` → `save_link` → `save_file` → POST the file to its `uploadUrl`); Playwright `tests/chat-connector.spec.js` (added to the emulator list in `playwright.config.js`) has the seeded admin open the saved MoM's link. Add one line to `CLAUDE.md`'s project structure pointing to this plan. Done when: tools/list shows the four tools and the server's instructions hold §E's steps; every returned link opens the right item; the MoM shows its heading, bullet list, ☐ item and table in the editor, and opening it doesn't rewrite it; the area shows the saved link and file; `npm run test:unit` still passes [no look] · Sol Max: end-to-end specs
- [x] R1 Phase 1 review: read C1–C4's diff against §A–§E; run `npm run test:unit`, `npm run test:mcp` and `npm run test:emu` once; hunt for a secret, key or token in a log, error or response, a hidden item reachable through any tool, and an upload that skips the signature or the size cap · Opus 5.5 High: phase review of Sol-built work

## Release (owner)
- [x] O1 *owner*: in Vercel → workspace → Settings → Environment Variables, **Production only**:
  `MCP_SECRET` (make one with `openssl rand -hex 24`), `WORKBENCH_OWNER_EMAIL` (your sign-in email) and
  `FIREBASE_SERVICE_ACCOUNT` (the output of `base64 -w0 ~/.config/workbench/firebase-admin.json`). Never in Preview.
- [x] O2 *owner*: say "release the connector". Claude merges `main` into `chat-connector` if it moved, runs
  `npm run test:unit` and `npm run test:mcp`, then `git push origin chat-connector:main` (fast-forward only; if it's
  blocked, run it yourself with `!`), and checks `/api/mcp/wrong` answers 404 on the live site.
- [x] O3 *owner*: claude.ai → Settings → Connectors → Add custom connector → name "Workbench", address
  `https://workspace-mzyz.vercel.app/api/mcp/<MCP_SECRET>`. For files Claude makes: Settings → Capabilities → code
  execution network access → allow `workspace-mzyz.vercel.app`. Without it, files under 1 MB still save, larger
  ones go as a link.
- [x] O4 *owner*: in a normal chat, save a meeting summary (MoM), a link and a PDF Claude made; check Claude
  proposed the place and waited for your yes; open each returned link on your phone.
