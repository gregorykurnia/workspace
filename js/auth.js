const auth = firebase.auth();

function doSignIn() {
  var em = document.getElementById('auth-email').value.trim();
  var pw = document.getElementById('auth-pw').value;
  var err = document.getElementById('auth-err');
  var btn = document.getElementById('auth-btn');
  err.className = 'auth-err';
  if (!em || !pw) {
    err.textContent = 'Please enter your email and password.';
    err.className = 'auth-err on';
    return;
  }
  btn.textContent = 'Signing in...';
  btn.disabled = true;
  auth.signInWithEmailAndPassword(em, pw).catch(function(e) {
    var msg = (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential')
      ? 'Wrong email or password.' : e.message;
    err.textContent = msg;
    err.className = 'auth-err on';
    btn.textContent = 'Sign in';
    btn.disabled = false;
  });
}

auth.onAuthStateChanged(function(user) {
  if (user) {
    document.getElementById('auth-screen').style.display = 'none';
    // Update sidebar user chip with real name
    var n = user.displayName || user.email || 'User';
    var ini = n.split(/\s+/).map(function(w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var av = document.getElementById('sb-av'); if (av) av.textContent = ini;
    var un = document.getElementById('sb-uname'); if (un) un.textContent = n;
    var ur = document.getElementById('sb-urole'); if (ur) ur.textContent = user.email;
  } else {
    document.getElementById('auth-screen').style.display = 'flex';
  }
});

document.getElementById('auth-btn').addEventListener('click', doSignIn);
document.getElementById('auth-pw').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') doSignIn();
});
document.getElementById('auth-forgot').addEventListener('click', function() {
  var em = document.getElementById('auth-email').value.trim();
  var err = document.getElementById('auth-err');
  var ok = document.getElementById('auth-ok');
  err.className = 'auth-err'; ok.className = 'auth-ok';
  if (!em) { err.textContent = 'Enter your email above first.'; err.className = 'auth-err on'; return; }
  auth.sendPasswordResetEmail(em).then(function() {
    ok.textContent = 'Reset link sent! Check your inbox.';
    ok.className = 'auth-ok on';
  }).catch(function(e) { err.textContent = e.message; err.className = 'auth-err on'; });
});

function openChangePassword() {
  modal(
    '<div class="m-title">Change Password</div>' +
    '<div class="fr"><label>Current password</label><input type="password" id="cp-cur" placeholder="••••••••"></div>' +
    '<div class="fr"><label>New password</label><input type="password" id="cp-new" placeholder="••••••••"></div>' +
    '<div class="fr"><label>Confirm new password</label><input type="password" id="cp-con" placeholder="••••••••"><div class="e-msg" id="cp-err"></div></div>' +
    '<div class="m-foot"><button class="btn se" id="cp-cancel">Cancel</button><button class="btn pr" id="cp-save">Update password</button></div>'
  );
  document.getElementById('cp-cancel').addEventListener('click', closeModal);
  document.getElementById('cp-save').addEventListener('click', function() {
    var cur = document.getElementById('cp-cur').value;
    var nw = document.getElementById('cp-new').value;
    var con = document.getElementById('cp-con').value;
    var err = document.getElementById('cp-err');
    err.className = 'e-msg';
    if (!cur || !nw || !con) { err.textContent = 'All fields required.'; err.className = 'e-msg on'; return; }
    if (nw !== con) { err.textContent = 'New passwords do not match.'; err.className = 'e-msg on'; return; }
    if (nw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.className = 'e-msg on'; return; }
    var user = auth.currentUser;
    var credential = firebase.auth.EmailAuthProvider.credential(user.email, cur);
    user.reauthenticateWithCredential(credential).then(function() {
      return user.updatePassword(nw);
    }).then(function() {
      closeModal(); toast('Password updated!');
    }).catch(function(e) {
      err.textContent = e.code === 'auth/wrong-password' ? 'Current password is wrong.' : e.message;
      err.className = 'e-msg on';
    });
  });
}

function closeUserPopup() {
  var p = document.getElementById('user-popup'); if (p) p.remove();
}

document.getElementById('sb-user-btn').addEventListener('click', function(e) {
  e.stopPropagation();
  if (document.getElementById('user-popup')) { closeUserPopup(); return; }
  var user = auth.currentUser;
  var name = (document.getElementById('sb-uname') || {}).textContent || '';
  var email = user ? user.email : '';
  var role = (document.getElementById('sb-urole') || {}).textContent || '';
  var popup = document.createElement('div');
  popup.id = 'user-popup';
  popup.innerHTML =
    '<div class="up-head">' +
      '<div class="up-name">' + name + '</div>' +
      '<div class="up-email">' + email + '</div>' +
      '<span class="up-role">' + role + '</span>' +
    '</div>' +
    '<div class="up-item" id="up-changepw">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' +
      'Change password' +
    '</div>' +
    '<div class="up-divider"></div>' +
    '<div class="up-item danger" id="up-signout">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
      'Sign out' +
    '</div>';
  document.body.appendChild(popup);
  document.getElementById('up-changepw').addEventListener('click', function() { closeUserPopup(); openChangePassword(); });
  document.getElementById('up-signout').addEventListener('click', function() { auth.signOut().then(function() { window.location.reload(); }); });
});

document.addEventListener('click', closeUserPopup);
