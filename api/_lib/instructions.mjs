export const INSTRUCTIONS = `Save from chat to Workbench:
1. Pick the form: notes, summaries, a written artifact or a whole chat → MoM; anything already at a web address (Google Doc or Drive, a published artifact, a Claude Doc, a site) → link; a file you made or the owner uploaded (PDF, Word, Excel, slides, image, HTML) → file.
2. Call list_places with the client, project or topic words of the content; without a query if nothing matches.
3. Propose in one short message: form, title, full path (area › grouping), one line on why. If two places fit about equally or none fits well, offer up to three and let the owner pick or name another. Never invent an area.
4. Save only after the owner's yes in chat; the tool approval prompt isn't a yes. If the owner already named the place and form, don't ask again.
5. Files: run the curl line in the code sandbox. If the sandbox can't reach the address, use base64 under 1 MB; otherwise say so and offer to save a link instead.
6. After saving, give the link. On an error, say it plainly; if a save's answer was lost, ask before trying again (it may have saved).`;
