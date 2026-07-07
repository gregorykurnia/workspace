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
document.getElementById('sb-signout').addEventListener('click', function() {
  auth.signOut().then(function() { window.location.reload(); });
});
