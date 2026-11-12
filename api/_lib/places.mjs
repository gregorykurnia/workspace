const isVisible = (item, uid) => !item.deleted && (item.privateTo == null || item.privateTo === uid);
const label = (value, fallback) => typeof value === 'string' && value.trim() ? value : fallback;
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
const itemTime = item => Number(item.date) || Number(item.created) || 0;

async function readCollection(db, name, fields) {
  const snapshot = await db.collection(name).select(...fields).get();
  // Firestore's document ID wins over a stale or malformed stored id field.
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

export async function listPlaces({ db, owner }, { query = '' } = {}) {
  // Read only destination metadata; MoM contents, keys and password hashes never leave the server.
  const [areas, momGroups, fileGroups, moms] = await Promise.all([
    readCollection(db, 'folders', ['name', 'parent', 'privateTo', 'deleted', 'pw']),
    readCollection(db, 'momfolders', ['name', 'folderId', 'holds', 'privateTo', 'deleted']),
    readCollection(db, 'docfolders', ['name', 'folderId', 'privateTo', 'deleted']),
    readCollection(db, 'moms', ['title', 'date', 'created', 'folderId', 'privateTo', 'deleted']),
  ]);
  const byId = new Map(areas.map(area => [area.id, area]));
  const resolved = new Map();

  function resolve(id) {
    const chain = [], seen = new Set();
    let current = id;
    while (current && !resolved.has(current)) {
      const area = byId.get(current);
      if (!area || !isVisible(area, owner.uid) || seen.has(current)) {
        for (const member of chain) resolved.set(member.id, null);
        return null;
      }
      seen.add(current);
      chain.push(area);
      current = area.parent || null;
    }
    let parent = current ? resolved.get(current) : { path: '', locked: false, private: false };
    for (const area of chain.reverse()) {
      parent = parent && {
        id: area.id,
        path: [parent.path, label(area.name, 'Untitled area')].filter(Boolean).join(' › '),
        private: parent.private || area.privateTo === owner.uid,
        locked: parent.locked || !!area.pw,
      };
      resolved.set(area.id, parent);
    }
    return resolved.get(id);
  }

  const groupsByArea = new Map(), momsByArea = new Map();
  for (const [groups, holds] of [[momGroups, 'mom'], [fileGroups, 'file']]) {
    for (const group of groups) {
      if (!isVisible(group, owner.uid)) continue;
      if (!groupsByArea.has(group.folderId)) groupsByArea.set(group.folderId, []);
      groupsByArea.get(group.folderId).push({
        id: group.id, name: label(group.name, 'Grouping'),
        holds: holds === 'mom' && group.holds === 'both' ? 'both' : holds,
      });
    }
  }
  for (const mom of moms) {
    if (!isVisible(mom, owner.uid)) continue;
    if (!momsByArea.has(mom.folderId)) momsByArea.set(mom.folderId, []);
    momsByArea.get(mom.folderId).push(mom);
  }
  const places = areas.map(area => resolve(area.id)).filter(Boolean).map(place => ({
    ...place,
    groupings: (groupsByArea.get(place.id) || []).sort(byName),
    recentMoms: place.locked ? [] : (momsByArea.get(place.id) || [])
      .sort((a, b) => itemTime(b) - itemTime(a) || a.id.localeCompare(b.id)).slice(0, 3)
      .map(mom => ({ title: label(mom.title, 'Untitled meeting'), date: typeof mom.date === 'number' || typeof mom.date === 'string' ? mom.date : null })),
  }));
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const kept = new Set();
  for (const place of places) {
    const haystack = [place.path, ...place.groupings.map(group => group.name), ...place.recentMoms.map(mom => mom.title)].join(' ').toLowerCase();
    if (!words.every(word => haystack.includes(word))) continue;
    let id = place.id;
    while (id && !kept.has(id)) {
      kept.add(id);
      id = byId.get(id).parent || null;
    }
  }
  // A parent path always precedes its children, including when the 200-area cap is reached.
  const matches = places.filter(place => kept.has(place.id))
    .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
  return { places: matches.slice(0, 200), hasMore: matches.length > 200 };
}
