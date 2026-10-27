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

// Sign-in by email link (plan spec §H). Firebase mails a link to any address typed: whether the email may open the
// workspace is decided by the rules (allowed_emails), never by this screen. The email being waited for is kept in
// localStorage G_signin_email (removed once signed in), and "Stay signed in on this device" in G_signin_stay.
var SIGNIN_EMAIL_KEY='G_signin_email',SIGNIN_STAY_KEY='G_signin_stay';
function _lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function _lsSet(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch(e){/* private window: the choice just won't persist */}}
function pendingSignInEmail(){return _lsGet(SIGNIN_EMAIL_KEY)||'';}
// The address typed, trimmed. Empty when it can't be an email (the screen asks again before anything is sent).
function cleanEmail(text){var t=String(text==null?'':text).trim();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)?t:'';}
// The link in a piece of text (a pasted email line, a whole address with spaces or <> around it), or ''. Only a
// real sign-in link counts: the Firebase address from the email, or this app's address after the redirect.
function signInLinkIn(text){
  var m=String(text==null?'':text).replace(/&amp;/g,'&').match(/https?:\/\/[^\s<>"']+/);
  var link=m?m[0]:'';
  return link&&auth.isSignInWithEmailLink(link)?link:'';
}
// Asks Firebase to mail the link. The link comes back to this page (with ?emulator on the emulator, so the
// returning page keeps talking to it).
function sendSignInLink(email,stay){
  var url=location.origin+location.pathname+(EMULATOR?'?emulator':'');
  return auth.sendSignInLinkToEmail(email,{url:url,handleCodeInApp:true}).then(function(){
    _lsSet(SIGNIN_EMAIL_KEY,email);
    if(stay!==undefined)_lsSet(SIGNIN_STAY_KEY,stay===false?'0':'1');
  });
}
// Finishes the link. "Stay signed in" off → the session ends when the browser closes; the choice was made
// where the link was asked for, so it is read back here (it can't be known on another device: stays on).
function signInWithLink(email,link){
  var stay=_lsGet(SIGNIN_STAY_KEY)!=='0';
  var kind=stay?firebase.auth.Auth.Persistence.LOCAL:firebase.auth.Auth.Persistence.SESSION;
  return auth.setPersistence(kind).then(function(){
    return auth.signInWithEmailLink(email,link);
  }).then(function(cred){
    _lsSet(SIGNIN_EMAIL_KEY,null);_lsSet(SIGNIN_STAY_KEY,null);
    return cred;
  });
}
// What went wrong with a link: 'expired' (used up, out of time or not a real link: it needs a new one), 'email'
// (it was sent to another address) or 'retry' (anything else, such as no connection: the same link still works).
function linkProblem(e){
  var c=e&&e.code;
  return c==='auth/invalid-action-code'||c==='auth/expired-action-code'?'expired':c==='auth/invalid-email'?'email':'retry';
}
function signOut(){return auth.signOut();}

// A person whose email isn't on the approved list signs in fine, but the rules refuse every read (spec §D), so
// their listeners fail with permission-denied. ACCESS_DENIED turns the "This email can't open the workspace"
// screen on. A permission error alone doesn't: it is confirmed by the one thing an unapproved person may read,
// their own entry on the list (a missing entry, or a refusal, means no; a network failure means nothing yet).
var ACCESS_DENIED=false,_denyCheck=null;
function _maybeDenied(e){
  var u=auth.currentUser,email=u&&String(u.email||'').trim().toLowerCase();
  if(!e||e.code!=='permission-denied'||!u||u.isAnonymous||!email||ACCESS_DENIED||_denyCheck)return;
  var uid=u.uid,deny=function(){if(auth.currentUser&&auth.currentUser.uid===uid){ACCESS_DENIED=true;Store._emit('denied');}};
  _denyCheck=db.collection('allowed_emails').doc(email).get().then(function(d){if(!d.exists)deny();},function(e2){if(e2&&e2.code==='permission-denied')deny();}).then(function(){_denyCheck=null;});
}
Store.onChange(function(what,e){if(what==='error')_maybeDenied(e);});

// Loads role + folder access once per auth session. Emits through Store.onChange:
// 'guest' (anonymous share-link visitor), 'role' (CURR_USER_ROLE known), 'access' (FA changed),
// 'users' (WORKSPACE_USERS changed), 'denied' (this email isn't approved: ACCESS_DENIED).
function startSession(){
  auth.onAuthStateChanged(function(user){
    ACCESS_DENIED=false;   // a new sign-in is judged afresh
    if(!user){CURR_USER_ROLE='member';FA=[];CURR_USER_RECENT=[];return;}

    // Anonymous share-link guests skip user record lookup
    if(user.isAnonymous){
      CURR_USER_ROLE='member';
      Store._emit('guest');
      return;
    }

    // Get or create this user's record in Firestore. Read through a listener, not get(): get() waits
    // for the server, and on the shared connection that means waiting until every collection has
    // caught up (after a while away, all the MoMs again), or ~10 s when the network is poor, with the
    // app on a skeleton although its data is already on this device. The device copy answers at once;
    // the server's answer follows and replaces it, then the listener stops.
    var offUser=db.collection('users').doc(user.uid).onSnapshot({includeMetadataChanges:true},function(doc){
      var fromCache=!!(doc.metadata&&doc.metadata.fromCache);
      if(doc.exists){
        CURR_USER_ROLE=doc.data().role||'member';
        CURR_USER_RECENT=Array.isArray(doc.data().recent)?doc.data().recent:[];
      }else if(fromCache){
        return;   // not on this device yet: only the server can say the record doesn't exist
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
      if(!fromCache)offUser();
    },function(e){console.error(e);_maybeDenied(e);});

    // Watch folder_access collection
    db.collection('folder_access').onSnapshot(function(snap){
      FA=snap.docs.map(function(d){return d.data();});
      Store._emit('access');
    },_maybeDenied);

    // Load all users (for the Manage Access dropdown)
    db.collection('users').onSnapshot(function(snap){
      WORKSPACE_USERS=snap.docs.map(function(d){return d.data();});
      Store._emit('users');
    },_maybeDenied);
  });
}

