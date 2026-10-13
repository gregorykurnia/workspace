// Data layer: Firebase Auth, the signed-in user's role, folder access and workspace users. No DOM.
const auth=firebase.auth();
var FA=[],CURR_USER_ROLE='member',WORKSPACE_USERS=[],CURR_USER_RECENT=[];   // recent: [{k:'m'|'f', id, at}], newest first, 8 at most (F13)

// Share link: sign in anonymously so no login screen is needed. The old app's links carry
// ?folder= ?doc= ?mom=; the new ones are #/s/a|m|f/:id.
var _visitorTry=null;
// Waits for Auth to report who is signed in (a saved session is restored asynchronously), and
// signs in anonymously only when nobody is. A signed-in colleague opening a link stays signed in.
function signInAsVisitor(){
  if(!_visitorTry)_visitorTry=new Promise(function(res,rej){
    var off=auth.onAuthStateChanged(function(u){
      off();
      if(u)return res();
      auth.signInAnonymously().then(function(){res();},function(e){console.error(e);_visitorTry=null;rej(e);});
    });
  });
  return _visitorTry;
}
(function(){
  var p=new URLSearchParams(window.location.search);
  if(p.has('folder')||p.has('doc')||p.has('mom')||/^#\/s\//.test(window.location.hash)){
    signInAsVisitor().catch(function(){});
  }
})();

// stay: "Stay signed in on this device" (U1). Off → the session ends when the browser closes.
// Old callers pass no stay value and keep the on-device session they always had.
function signIn(em,pw,stay){
  var kind=stay===false?firebase.auth.Auth.Persistence.SESSION:firebase.auth.Auth.Persistence.LOCAL;
  return auth.setPersistence(kind).then(function(){
    return auth.signInWithEmailAndPassword(em,pw);
  });
}
function sendReset(em){return auth.sendPasswordResetEmail(em);}
function changePassword(cur,nw){
  var user=auth.currentUser;
  var credential=firebase.auth.EmailAuthProvider.credential(user.email,cur);
  return user.reauthenticateWithCredential(credential).then(function(){
    return user.updatePassword(nw);
  });
}
function signOut(){return auth.signOut();}

// Loads role + folder access once per auth session. Emits through Store.onChange:
// 'guest' (anonymous share-link visitor), 'role' (CURR_USER_ROLE known), 'access' (FA changed),
// 'users' (WORKSPACE_USERS changed).
function startSession(){
  auth.onAuthStateChanged(function(user){
    if(!user){CURR_USER_ROLE='member';FA=[];CURR_USER_RECENT=[];return;}

    // Anonymous share-link guests skip user record lookup
    if(user.isAnonymous){
      CURR_USER_ROLE='member';
      Store._emit('guest');
      return;
    }

    // Get or create this user's record in Firestore
    db.collection('users').doc(user.uid).get().then(function(doc){
      if(doc.exists){
        CURR_USER_ROLE=doc.data().role||'member';
        CURR_USER_RECENT=Array.isArray(doc.data().recent)?doc.data().recent:[];
      }else{
        _w(db.collection('users').doc(user.uid).set({
          uid:user.uid,
          email:user.email,
          displayName:user.displayName||user.email.split('@')[0],
          role:'member'
        }));
        CURR_USER_ROLE='member';
      }
      Store._emit('role');
    });

    // Watch folder_access collection
    db.collection('folder_access').onSnapshot(function(snap){
      FA=snap.docs.map(function(d){return d.data();});
      Store._emit('access');
    });

    // Load all users (for the Manage Access dropdown)
    db.collection('users').onSnapshot(function(snap){
      WORKSPACE_USERS=snap.docs.map(function(d){return d.data();});
      Store._emit('users');
    });
  });
}

