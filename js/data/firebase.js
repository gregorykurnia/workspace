// Data layer: Firebase app, Firestore handle and Cloudinary settings. No DOM.
const FB={apiKey:"AIzaSyA0ZOM95oAxG0X8JC26yX9V2S9PcSCOI0Y",authDomain:"greg-project-5b838.firebaseapp.com",projectId:"greg-project-5b838",storageBucket:"greg-project-5b838.firebasestorage.app",messagingSenderId:"695512510143",appId:"1:695512510143:web:ceed96aacd618115ba600a"};
const CL_CLOUD='dgznvawnm',CL_PRESET='workspace_uploads';
firebase.initializeApp(FB);
const db=firebase.firestore();

// Offline copy of the data on this device (IndexedDB), so the app opens and saves offline.
// Opt-in per page: <script src="js/data/firebase.js" data-persist="on">. The old index.html does
// not opt in, so it behaves exactly as before. Must run before any other Firestore call.
// PERSISTENCE: 'off' (page didn't ask) | 'pending' | 'on' | 'failed' (private window, old browser,
// or another tab holding the cache without tab sync). On 'failed' the app keeps working online.
var PERSISTENCE='off';
(function(){
  var s=document.currentScript;
  if(!s||s.dataset.persist!=='on')return;
  PERSISTENCE='pending';
  db.enablePersistence({synchronizeTabs:true})
    .then(function(){PERSISTENCE='on';})
    .catch(function(e){PERSISTENCE='failed';console.warn('Offline copy unavailable on this device:',e&&e.code);});
})();
