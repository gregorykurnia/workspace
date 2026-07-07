// Called once per auth session to load role + folder access
auth.onAuthStateChanged(function(user) {
  if (!user) { CURR_USER_ROLE = 'member'; FA = []; return; }

  // Get or create this user's record in Firestore
  db.collection('users').doc(user.uid).get().then(function(doc) {
    if (doc.exists) {
      CURR_USER_ROLE = doc.data().role || 'member';
    } else {
      db.collection('users').doc(user.uid).set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        role: 'member'
      });
      CURR_USER_ROLE = 'member';
    }
    var ur = document.getElementById('sb-urole');
    if (ur) ur.textContent = CURR_USER_ROLE === 'admin' ? 'Admin' : 'Member';
    if (typeof render === 'function') render();
  });

  // Watch folder_access collection
  db.collection('folder_access').onSnapshot(function(snap) {
    FA = snap.docs.map(function(d) { return d.data(); });
    if (typeof render === 'function') render();
  });

  // Load all users (for the Manage Access dropdown)
  db.collection('users').onSnapshot(function(snap) {
    WORKSPACE_USERS = snap.docs.map(function(d) { return d.data(); });
  });
});

// Returns true if the current user can see a given folder
function canSeeFolder(fid) {
  if (CURR_USER_ROLE === 'admin') return true;
  var user = auth.currentUser;
  if (!user) return false;
  // Walk up the folder tree — access on any ancestor grants access
  var current = gf(fid);
  while (current) {
    if (FA.some(function(fa) { return fa.folderId === current.id && fa.uid === user.uid; })) return true;
    current = current.parent ? gf(current.parent) : null;
  }
  return false;
}

// Admin-only modal to grant/revoke access per folder
function openAccessModal(fid) {
  var f = gf(fid); if (!f) return;
  var existing = FA.filter(function(fa) { return fa.folderId === fid; });
  var available = WORKSPACE_USERS.filter(function(u) {
    return u.role !== 'admin' && !existing.some(function(fa) { return fa.uid === u.uid; });
  });

  var existingHTML = existing.length
    ? existing.map(function(fa) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F3F4F6">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:13px;font-weight:500;color:#111827">' + esc(fa.displayName || fa.email) + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF">' + esc(fa.email) + '</div>' +
          '</div>' +
          '<button class="btn da sm" data-revoke="' + fa.id + '">Revoke</button>' +
        '</div>';
      }).join('')
    : '<div style="font-size:13px;color:#9CA3AF;padding:10px 0">No one else has access to this folder yet.</div>';

  var addHTML = available.length
    ? '<div class="fr" style="margin-top:8px"><label>Add user</label>' +
      '<div style="display:flex;gap:8px">' +
        '<select id="ac-user" style="flex:1">' +
          available.map(function(u) {
            return '<option value="' + esc(u.uid) + '">' + esc(u.displayName || u.email) + ' (' + esc(u.email) + ')</option>';
          }).join('') +
        '</select>' +
        '<button class="btn pr" id="ac-grant" style="white-space:nowrap;flex-shrink:0">Grant</button>' +
      '</div></div>'
    : '<div style="font-size:12px;color:#9CA3AF;margin-top:8px">All members already have access, or no other members exist.</div>';

  modal(
    '<div class="m-title">&#128274; Manage Access — ' + esc(f.name) + '</div>' +
    '<div class="m-sub">Control who can see this folder. Admins always have full access.</div>' +
    '<div>' + existingHTML + '</div>' +
    addHTML +
    '<div class="m-foot"><button class="btn se" id="ac-close">Done</button></div>',
    true
  );

  document.getElementById('ac-close').addEventListener('click', closeModal);

  var acg = document.getElementById('ac-grant');
  if (acg) acg.addEventListener('click', function() {
    var sel = document.getElementById('ac-user');
    var userDoc = WORKSPACE_USERS.find(function(u) { return u.uid === sel.value; });
    if (!userDoc) return;
    var fa = { id: uid(), folderId: fid, uid: userDoc.uid, email: userDoc.email, displayName: userDoc.displayName || userDoc.email };
    db.collection('folder_access').doc(fa.id).set(fa).catch(console.error);
    closeModal();
    toast('Access granted to ' + (userDoc.displayName || userDoc.email));
  });

  document.getElementById('MR').querySelectorAll('[data-revoke]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      db.collection('folder_access').doc(btn.dataset.revoke).delete().catch(console.error);
      closeModal();
      toast('Access revoked.');
    });
  });
}
