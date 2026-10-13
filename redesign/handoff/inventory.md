# Capability Inventory

What people need to be able to do, written as job stories. This describes needs only, not how anything looks or is arranged.

Each story has an ID (e.g. `C3`) so that `priorities.md` can tag it daily / weekly / rare.

---

## Words used here

- **Area**: a named place a person creates to organise work around one subject, such as a client, a team, or an initiative. Areas can sit inside other areas, to any depth. An area has a name, a small emoji to recognise it by, and a creation date.
- **MoM** (minutes of meeting): a written record of a meeting. It has a title, a meeting date, free-text tags, an optional link to an outside document (e.g. a Google Doc), and a rich-text body.
- **File**: either something uploaded (an image, PDF, video, or any other document) or a saved web link. It has a name, a kind, an optional short note, and the date it was added.
- **Grouping**: a light, single-level way to bunch MoMs together, or files together, inside one area without creating a new area. A MoM grouping holds only MoMs and a file grouping holds only files. Things not in a grouping simply sit in the area.
- **Admin**: a person who runs the workspace.
- **Member**: a person with an account who sees only the areas they've been given.
- **Visitor**: someone without an account who opened a shared link.

---

## 1. Capture

**C1.** When a meeting starts, I want to start a new MoM in the area (or grouping) it belongs to in one step, with today's date and a default title already filled in, so that I can start typing immediately.

**C2.** When I'm writing a MoM, I want it to save itself shortly after I pause typing, and to always know whether it is saving or saved, so that I never lose notes and never have to think about saving.

**C3.** When I'm done with a MoM, I want to be certain it's saved (including with a keyboard shortcut) and carry on with what I was doing, so that finishing a MoM never costs me my place.

**C4.** When I record a meeting, I want to set its title, meeting date (defaulting to today), and free-text tags, so that I can recognise and find it later.

**C5.** When a meeting has a companion document elsewhere (e.g. a Google Doc), I want to attach that link to the MoM and open it from there, so that the two stay connected.

**C6.** When I have a file on my device, I want to add it to an area or grouping by choosing it or dragging it in. I want to see upload progress, optionally give it a different name (otherwise the file's own name is used), and add a short note, so that everything for that subject sits in one place.

**C7.** When the material lives somewhere online, I want to save it as a link with a name, a kind (web link, presentation, PDF/document, spreadsheet, image, or other), the address, and a short note, so that I can keep it next to my uploads.

**C8.** When an upload fails, I want a plain-language reason (format not allowed, a storage set-up problem, a network problem, or too large) and a suggested way forward, such as saving it as a link instead, so that I'm never stuck.

---

## 2. Write and format a MoM

**W1.** When I write, I want to format text with bold, italic, underline, and strikethrough; three heading levels plus normal text; a small choice of typefaces (sans-serif, serif, monospace); a wide range of text sizes; text colour; highlight colour; alignment (start, centre, end); bulleted and numbered points; and quotes. I want to be able to clear formatting, undo, and redo, so that my notes are as structured as the meeting needs.

**W2.** While I write, I want to see which formatting is active where I'm typing, so that I know what I'll get.

**W3.** When I need a table, I want to insert one (starting 3 × 3, with headings), grow or shrink it in either direction, reorder its entries in either direction, resize its widths, and delete it, so that I can track structured information inside notes.

**W4.** When a picture helps, I want to add an image to a MoM from a web address, from my device, or by pasting it. I want to resize it by dragging, keep it flowing with the text or let it float freely anywhere over the note and drag it into place, switch between the two, and remove it, so that visuals sit exactly where they make sense.

**W5.** When I mention something on the web, I want to turn any text into a link and remove links again, so that references are one step away.

**W6.** When a meeting relates to files in the workspace, I want to search all files by name, see where each one lives, pick several at once, and insert them into the MoM as named links, so that notes point to the material discussed.

**W7.** When a meeting continues an earlier one, I want to pick one or more other MoMs (newest first, showing their area and date) and insert them as named links. Following such a link should open that MoM inside the app, saving the current one first, so that a series of meetings reads as a chain.

**W8.** When I keep a running client-prospect journal as a table in a MoM, I want every entry to have a "Detailed Remarks" field. It should be added automatically if missing, give me roomy space to write long remarks that saves itself as I type, and stay compact when I'm only reading while letting me read any remark in full, so that the table stays scannable while each prospect still has room for long context.
  *This currently applies only to one specific journal, identified by its title. A more general mechanism is welcome as a proposal.*

**W9.** When I need to send minutes to someone outside, I want to export a MoM as an A4 PDF with its title, area, date, tags, full body, and an export date stamp, named after the title, so that I can email or archive it. This must work for MoMs I can only read, too.

**W10.** When I type, I want spelling mistakes flagged, so that minutes go out clean.

**W11.** When I open an old MoM written before the current editor existed, I want it to still open and display correctly, so that nothing from the past is lost.

---

## 3. Find

**F1.** When I don't know where something is, I want one search across the whole workspace: areas by name, MoMs by title and opening text, and files by name and note. I want results separated by kind, each showing where it lives, and choosing one should take me there, so that I can find anything in seconds.

**F2.** When an area gets busy, I want to narrow down what's in it by name or content, order things by newest or A–Z, and be told when nothing matches, so that I can find things without scrolling through everything.

**F3.** When something matters a lot, I want to flag a MoM or file as important, get back to everything I've flagged quickly, and unflag it later, so that important things are never buried.

**F4.** When I open the app, I want to get straight back into today's work, so that I don't have to hunt for where I stopped.

**F4b.** As an admin, I want to notice what was recently added across the workspace (what it is, where it lives, and when it was added), so that I stay aware of what my team is producing.

**F5.** When I'm deep inside nested areas, I want to always know where I am within the nesting (with restricted areas marked) and get to any enclosing area quickly, so that I never lose context.

**F6.** When I have many nested areas, I want to reach any of them quickly from anywhere, without opening every level on the way, so that moving around stays fast.

**F7.** When I want to come back to or send someone a specific place, I want every area and every MoM to have its own web address. The browser's back and forward should work, and reloading should return me to the same place, so that the app behaves like the web.

**F8.** When I'm in an area, I want a sense of how big and how old it is, so that I can judge it at a glance.

**F9.** When I open a file, I want images to show at full size without leaving the app (and to dismiss them easily, including with Escape), and other kinds of files to open in the browser, so that I can check things without losing my place.

**F10.** When I need a copy, I want to download a file to my device, falling back to opening it if a direct download isn't allowed, so that I can use it offline or attach it elsewhere.

**F11.** When I scan files, I want to tell their kind apart at a glance (PDF, image, video, link, spreadsheet, presentation, other) and see small samples of images, so that I pick the correct one.

---

## 4. Organise

**O1.** When a new subject comes up, I want to create an area with a name and an emoji, either at the highest level or inside another area, so that work has a home. *(Admin only)*

**O2.** When a subject changes, I want to rename an area and change its emoji, so that the structure stays accurate.

**O3.** When the structure needs rearranging, I want to move an area, with everything inside it, to any other area or to the highest level. Moving it into itself or into anything inside it must be impossible, so that reorganising is safe. *(Admin only)*

**O4.** When an area has many MoMs or files, I want to create, rename, and remove groupings for them inside that area. Removing a grouping keeps its contents in the area, so that I can bunch things without deeper nesting. *(Removing is admin only)*

**O5.** When something is filed in the wrong place, I want to move a MoM or file to any area or grouping in the workspace. I want to see where it currently is, search destinations by name, and be told when no destination matches, so that I can fix filing quickly.

**O6.** When a name is wrong, I want to rename a MoM or file without opening it, so that small fixes are quick.

**O7.** When I tidy up, I want to select several areas, MoMs, or files, select everything that currently matches my filter, see how many are selected, and then move them all to one destination or delete them all, so that clean-ups aren't one-by-one. *(Deleting, and selecting areas, are admin only)*

**O8.** When I delete an area, MoM, file, or grouping, I want to be asked first with a clear statement of the impact (e.g. that an area will go with everything inside it and how much that is; for several items, which ones), so that I never delete by accident. *(Admin only)*

**O9.** When I've deleted something by mistake, I want it to stay recoverable for 7 days. I want to see every deleted thing with its kind, when it was deleted, and how many days remain, restore any of them, permanently remove one, or empty everything at once (with a warning that this can't be undone), so that mistakes are reversible and clutter still goes away. Anything older than 7 days is removed automatically.

---

## 5. Protect and share

**P1.** When something is sensitive, I want to restrict an area or a file with a password (typed twice to confirm), change it or remove it (both require the current password), so that only people who know it can open it. Passwords are never stored in readable form.

**P2.** When I open a restricted area, or anything inside it, I want to be asked for the password, told clearly if it's wrong, and allowed to try again. Once I've opened it, it should stay open for this session until I restrict it again, and restricting it again shuts it immediately, even if I'm inside it, so that protection is real but not a constant nuisance.

**P3.** While an area is restricted, I want its contents hidden everywhere (wherever areas appear, in counts and summaries, in search, and inside it), with only the fact that it is restricted showing, so that nothing leaks.

**P4.** When a file is restricted, I want its name to stay visible but its note hidden, and to be unable to open, look inside, or download it until the password is entered, so that I know it exists without exposing it.

**P5.** When someone outside the workspace needs to see something, I want to create a link to an area, a single MoM, or a single file that anyone can open without an account. I want to turn it on or off, copy it, and see a plain explanation of exactly what the link exposes. Turning it off must stop the link working immediately, so that sharing is deliberate and reversible. *(Admin only)*

**P6.** When a member should see only some areas, I want to grant specific members access to an area (which then includes everything inside it), see who has access, and revoke it. Admins always see everything, so that people see only what they should. *(Admin only)*

**P7.** When a MoM or file is final, I want to mark it so that members can read it but not change it, with that status clearly visible, and undo it later, so that agreed records stay intact. *(Admin only)*

---

## 6. Work together, stay in sync

**S1.** When colleagues add, change, move, or delete things, I want to see it immediately without reloading, so that everyone works from the same picture.

**S2.** When someone else edits the MoM I have open, I want their saved changes to appear in my copy without losing my place, so that two people can take notes on the same meeting.

**S3.** When I'm working, I want to know whether I'm connected and seeing the latest, so that I trust what I see.

**S4.** When I do something (save, move, rename, restore, copy a link, set a password, etc.), I want a short confirmation, so that I know it worked.

---

## 7. Work anywhere

**A1.** When I'm on my phone, I want every capability to work, with as much room as possible for what I'm reading or writing, and every action reachable by touch, so that I can take minutes in a meeting room.

**A2.** When I use the app daily, I want to install it on my phone or computer and have it open on its own like a native app, so that it's one tap away.

**A3.** When I have no connection, I want the app itself to still open, so that I'm not staring at a browser error.

**A4.** When a new version is released, I want to be told and able to refresh into it, so that I'm never stuck on an old version.

**A5.** When I prefer less motion, I want animation reduced, so that the app is comfortable to use.

**A6.** When I use a keyboard, I want Escape to back out of whatever I'm in the middle of, Enter to confirm short inputs, and Cmd/Ctrl+S to save a MoM, so that I can work without a mouse.

---

## 8. Account

**U1.** When I arrive, I want to sign in with email and password and stay signed in on this device, with a clear message if my details are wrong, so that access is quick and secure.

**U2.** When I forget my password, I want to request a reset email (I'm reminded to enter my email first), with confirmation that it was sent, so that I can get back in on my own.

**U3.** When I'm signed in, I want to see my name, email, and role, change my password (current, new, and confirm; at least 6 characters; clear errors for mismatch or wrong current password), and sign out, so that I control my account.

**U4.** When someone signs in for the first time, they become a member with no areas until an admin grants access. There is no self sign-up: accounts are created by the workspace owner.

---

## 9. Visiting through a shared link

**V1.** When I open a shared area link, I want to get in without signing in and browse that area and everything inside it, read MoMs, and open files, with no way to reach anything outside the shared area, so that I see exactly what was shared. Visitors can read only.

**V2.** When I open a shared MoM link, I want to read its title, date, tags, and full body, so that I get the minutes without an account.

**V3.** When I open a shared file link, I want to see its name and note and open or download it. If it is password-restricted, I want to enter the password first.

**V4.** When a link has been turned off or the item no longer exists, I want a clear "this link is no longer available" message, not an error.

---

## States the design must cover

| State | Where it occurs |
|---|---|
| **Nothing yet** | No areas; area with no sub-areas, no MoMs, no files, nothing flagged; empty grouping; nothing deleted; no other MoMs to link; no files to link |
| **No match** | Workspace search, in-area filters, destination search, file-link search |
| **Loading** | First connection after sign-in; image uploading into a MoM; file uploading (with percentage) |
| **Saving / saved** | MoM body, Detailed Remarks |
| **Failure** | Wrong sign-in details; wrong password on a restricted item; upload failed (with reason); password-change errors; required name missing |
| **No connection** | Offline status; app opening with no network |
| **Restricted by password** | Area (and everything inside), file; restricted, and opened-for-this-session |
| **Read-only** | MoM or file marked final, as seen by a member |
| **Visiting via shared link** | Shared area, shared MoM, shared file, shared file that is password-restricted, link turned off or missing |
| **Selecting several** | Nothing selected, some selected, all matching selected |
| **Sync** | Current; catching up; no connection; someone else's change arriving in an open MoM |
| **Shared / not shared** | An item's link sharing is on or off |
| **Flagged / not flagged** | MoMs and files |
| **New version available** | After an update is released |

---

## Roles and permissions

| Capability | Admin | Member | Visitor |
|---|---|---|---|
| See areas | All | Only areas granted (and everything inside them) | Only the shared area and what's inside |
| Create highest-level area; create sub-area | ✓ | | |
| Rename area, change emoji | ✓ | ✓ | |
| Move area | ✓ | | |
| Password-restrict / unrestrict area or file | ✓ | ✓ (files: not if read-only) | |
| Create MoM; create grouping; add file or link | ✓ | ✓ | |
| Edit MoM | ✓ | ✓ unless read-only | |
| Read MoM | ✓ | ✓ | ✓ |
| Move / rename MoM or file | ✓ | ✓ (files: not if read-only) | |
| Flag as important | ✓ | ✓ | |
| Select several and move | ✓ (incl. areas) | ✓ (MoMs, files) | |
| Delete anything (single or several) | ✓ | | |
| Recover deleted items | ✓ | ✓ | |
| Mark MoM / file read-only | ✓ | | |
| Create / turn off shared links | ✓ | | |
| Grant / revoke member access | ✓ | | |
| Notice what was recently added across the workspace (F4b) | ✓ | | |
| Export MoM to PDF | ✓ | ✓ | |
| Account details, change password, sign out | ✓ | ✓ | |

When a member attempts something admin-only, they are told plainly that only admins can do it.

---

## Hard constraints

- Works fully on phones and on desktop computers.
- Installable on phones and computers; runs on its own like a native app.
- App opens without a connection; data needs a connection.
- Real-time sync between everyone in the workspace.
- Rich text editing as described in W1–W8, including tables and freely positioned images.
- Export MoMs to A4 PDF.
- Uploads: images, videos, PDFs, any other file. PDFs over roughly 10 MB currently fail on the storage plan, so suggest saving a link instead.
- Image open and download must work with files hosted on a different domain.
- Shared links work with no account and no sign-in.
- Deleted items are recoverable for exactly 7 days.
- Respects the reduced-motion preference.
- Every action must be reachable by touch alone.
