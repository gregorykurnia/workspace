import { ConnectorError } from './firebase.mjs';

export const isVisible = (item, uid) => !item.deleted && (item.privateTo == null || item.privateTo === uid);
export const label = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback;

// All destination reads share the write's transaction. A move, deletion or privacy
// change forces a fresh check before Firestore can commit the new item.
export async function destination(transaction, db, uid, { areaId, groupId }, kind) {
  const chain = [], seen = new Set();
  let id = areaId;
  while (id) {
    if (typeof id !== 'string' || id.includes('/') || seen.has(id)) {
      throw new ConnectorError('Choose an existing, visible Workbench area.');
    }
    seen.add(id);
    const snapshot = await transaction.get(db.collection('folders').doc(id));
    const area = snapshot.data();
    if (!area || !isVisible(area, uid)) {
      throw new ConnectorError('Choose an existing, visible Workbench area.');
    }
    chain.push(area);
    id = area.parent || null;
  }
  let path = chain.map(area => label(area.name, 'Untitled area')).reverse().join(' › ');
  if (groupId) {
    const groups = await Promise.all(['momfolders', 'docfolders'].map(async collection => {
      const snapshot = await transaction.get(db.collection(collection).doc(groupId));
      return { data: snapshot.data(), collection };
    }));
    const match = groups.find(({ data, collection }) => data && data.folderId === areaId && isVisible(data, uid)
      && (kind === 'mom' ? collection === 'momfolders' : collection === 'docfolders' || data.holds === 'both'));
    if (!match) throw new ConnectorError(`Choose a visible grouping in this area that holds ${kind === 'mom' ? 'MoMs' : 'files and links'}.`);
    path += ' › ' + label(match.data.name, 'Grouping');
  }
  return { path, privateTo: chain[0].privateTo ?? null };
}
