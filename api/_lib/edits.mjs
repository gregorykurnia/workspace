import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ConnectorError } from './firebase.mjs';
import { delta, readInputs, splitSections, visiblePlace } from './reads.mjs';
import { markdownToHtml, MAX_CONTENT_BYTES } from './saves.mjs';

export const editInputMessage = 'Check edit_mom inputs: give one MoM id, its exact expectEdited value (null if never edited), and mode append, replace_section or undo. Append and replace_section need markdown; replace_section also needs a nonnegative section number.';
export const editInputs = z.object({
  id: readInputs.shape.id,
  expectEdited: z.union([z.number(), z.string(), z.null()]),
  mode: z.enum(['append', 'replace_section', 'undo']),
  section: z.number().int().nonnegative().optional(),
  markdown: z.string().optional(),
}).refine(args => args.mode === 'undo' || (typeof args.markdown === 'string'
  && (args.mode !== 'replace_section' || args.section !== undefined)));

export async function editMom({ db, owner, origin }, input, now = Date.now()) {
  const parsed = editInputs.safeParse(input);
  if (!parsed.success) throw new ConnectorError(editInputMessage);
  const args = parsed.data;
  const ref = db.collection('moms').doc(args.id);
  // Keep one backup id across Firestore's transaction retries.
  const backup = db.collection('mom_backups').doc();
  const url = new URL(`/#/mom/${encodeURIComponent(args.id)}`, origin).href;
  return db.runTransaction(async transaction => {
    const get = async (collection, id) => {
      const snapshot = await transaction.get(db.collection(collection).doc(id));
      return snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
    };
    const item = await get('moms', args.id);
    if (!await visiblePlace(get, owner.uid, item, 'mom')) {
      throw new ConnectorError('No MoM with that id.');
    }
    const before = typeof item.content === 'string' ? item.content : '';
    if (delta(before)) throw new ConnectorError('This MoM is in the old format: open it in Workbench once, then try again.');
    const previous = item.edited ?? null;
    if (previous !== args.expectEdited) throw new ConnectorError('This MoM changed since you read it: read it again.');

    let content;
    if (args.mode === 'undo') {
      // Equality filters need no extra composite index; normally exactly one
      // backup matches because every chat edit gets a distinct version.
      const matches = await transaction.get(db.collection('mom_backups')
        .where('momId', '==', args.id).where('afterEdited', '==', previous));
      const latest = matches.docs.map(doc => doc.data()).sort((a, b) => b.savedAt - a.savedAt)[0];
      if (!latest || typeof latest.content !== 'string') {
        throw new ConnectorError('Nothing to undo: the MoM changed after the last chat edit.');
      }
      content = latest.content;
    } else if (args.mode === 'append') {
      content = before + markdownToHtml(args.markdown);
    } else {
      const sections = splitSections(before);
      const section = sections[args.section];
      if (!section) throw new ConnectorError('No section with that number: read the MoM again.');
      if (!section.plain) throw new ConnectorError('This section has formatting markdown cannot preserve. Append instead.');
      section.html = markdownToHtml(args.markdown);
      content = sections.map(section => section.html).join('');
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
      throw new ConnectorError('MoM content is over 500 KB. Shorten it or save it as a file instead.');
    }
    // Match the editor's version chain, including two edits in one millisecond.
    const edited = Math.max(now, typeof previous === 'number' ? previous + 1 : 0);
    if (!Number.isSafeInteger(edited) || edited === previous) {
      throw new ConnectorError('This MoM has an invalid edit version: open it in Workbench once, then try again.');
    }
    transaction.update(ref, {
      content, edited, editedBy: { uid: owner.uid, name: owner.name },
      prevEdited: typeof previous === 'number' ? previous : FieldValue.delete(),
    });
    transaction.create(backup, {
      momId: args.id, content: before, edited: previous, afterEdited: edited, mode: args.mode, savedAt: now,
    });
    return { id: args.id, url, edited, backupId: backup.id };
  });
}
