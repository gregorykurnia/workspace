// Data layer: Firebase Auth, the signed-in user's role, folder access and workspace users. No DOM.
const auth=firebase.auth();
var FA=[],CURR_USER_ROLE='member',WORKSPACE_USERS=[];

// Share link: sign in anonymously so no login screen is needed
(function(){
  var p=new URLSearchParams(window.location.search);
  if(p.has('folder')||p.has('doc')||p.has('mom')){
    auth.signInAnonymously().catch(console.error);
  }
})();

function signIn(em,pw){
  return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(function(){
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
    if(!user){CURR_USER_ROLE='member';FA=[];return;}

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

// Returns true if the current user can see a given folder
function canSeeFolder(fid){
  if(CURR_USER_ROLE==='admin')return true;
  var user=auth.currentUser;
  if(!user)return false;
  // Anonymous share-link guests: allow access only within a folder tree that
  // has link-sharing explicitly turned on
  if(user.isAnonymous&&typeof SHARE_MODE!=='undefined'&&SHARE_MODE&&SHARE_FOLDER_ID){
    var shareRoot=gf(SHARE_FOLDER_ID);
    if(!shareRoot||!shareRoot.shared)return false;
    var check=gf(fid);
    while(check){
      if(check.id===SHARE_FOLDER_ID)return true;
      check=check.parent?gf(check.parent):null;
    }
    return false;
  }
  // Walk up the folder tree — access on any ancestor grants access
  var current=gf(fid);
  while(current){
    if(FA.some(function(fa){return fa.folderId===current.id&&fa.uid===user.uid;}))return true;
    current=current.parent?gf(current.parent):null;
  }
  return false;
}
