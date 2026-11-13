import { z } from 'zod';
import { ConnectorError } from './firebase.mjs';
import { destination, isVisible, label } from './destinations.mjs';
import { id } from './saves.mjs';

// One line, no control characters and no path separator, so a returned path reads as its real levels.
const areaName = z.string().trim().min(1).max(200).refine(value => !/[\p{Cc}\u2028\u2029›]/u.test(value));
export const areaInputs = z.object({ parentId: id, name: areaName });
export const areaInputMessage = 'Check create_area inputs: choose an existing parent area and give a one-line name of at most 200 characters, without ›.';
const same = name => typeof name === 'string' ? name.normalize('NFC').trim().toLocaleLowerCase() : '';

// A sub-area made from chat is the record the app's "New area" dialog writes, with the
// parent's privateTo as the app copies it. A visible sibling with the same name is
// returned instead, so a retry after a lost answer never makes a second area.
export async function createArea({ db, owner, origin }, input, now = Date.now()) {
  const parsed = areaInputs.safeParse(input);
  if (!parsed.success) throw new ConnectorError(areaInputMessage);
  const { parentId, name } = parsed.data;
  const ref = db.collection('folders').doc();
  return db.runTransaction(async transaction => {
    const parent = await destination(transaction, db, owner.uid, { areaId: parentId }, 'area');
    const siblings = await transaction.get(db.collection('folders').where('parent', '==', parentId).select('name', 'privateTo', 'deleted'));
    const existing = siblings.docs.find(doc => isVisible(doc.data(), owner.uid) && same(doc.data().name) === same(name));
    const areaId = existing ? existing.id : ref.id;
    const privateTo = existing ? existing.data().privateTo ?? null : parent.privateTo;
    if (!existing) {
      transaction.create(ref, {
        id: ref.id, name, icon: '🌿', parent: parentId, created: now, privateTo: parent.privateTo,
        createdBy: { uid: owner.uid, name: owner.name }, source: 'claude-chat',
      });
    }
    return {
      id: areaId, path: `${parent.path} › ${existing ? label(existing.data().name, 'Untitled area') : name}`,
      url: new URL(`/#/areas/${encodeURIComponent(areaId)}`, origin).href, created: !existing,
      private: privateTo === owner.uid,
    };
  });
}
