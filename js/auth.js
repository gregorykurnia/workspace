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
  if (!em) {
    err.textContent = 'Enter your email above first.';
    err.className = 'auth-err on';
    return;
  }
  auth.sendPasswordResetEmail(em).then(function() {
    ok.textContent = 'Reset link sent! Check your inbox.';
    ok.className = 'auth-ok on';
  }).catch(function(e) {
    err.textContent = e.message;
    err.className = 'auth-err on';
  });
});
document.getElementById('sb-changepw').addEventListener('click', function() {
  modal(
    '<div class="m-title">Change Password</div>' +
    '<div class="fr"><label>Current password</label><input type="password" id="cp-cur" placeholder="••••••••"></div>' +
    '<div class="fr"><label>New password</label><input type="password" id="cp-new" placeholder="••••••••"></div>' +
    '<div class="fr"><label>Confirm new password</label><input type="password" id="cp-con" placeholder="••••••••"><div class="e-msg" id="cp-err"></div></div>' +
    '<div class="m-foot"><button class="btn se" id="cp-cancel">Cancel</button><button class="btn pr" id="cp-save">Save</button></div>'
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
      closeModal();
      toast('Password changed successfully.');
    }).catch(function(e) {
      var msg = e.code === 'auth/wrong-password' ? 'Current password is wrong.' : e.message;
      err.textContent = msg; err.className = 'e-msg on';
    });
  });
});
document.getElementById('sb-signout').addEventListener('click', function() {
  auth.signOut().then(function() { window.location.reload(); });
});
