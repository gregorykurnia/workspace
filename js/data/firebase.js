// Data layer: Firebase app, Firestore handle and Cloudinary settings. No DOM.
const FB={apiKey:"AIzaSyA0ZOM95oAxG0X8JC26yX9V2S9PcSCOI0Y",authDomain:"greg-project-5b838.firebaseapp.com",projectId:"greg-project-5b838",storageBucket:"greg-project-5b838.firebasestorage.app",messagingSenderId:"695512510143",appId:"1:695512510143:web:ceed96aacd618115ba600a"};
const CL_CLOUD='dgznvawnm',CL_PRESET='workspace_uploads';
firebase.initializeApp(FB);
const db=firebase.firestore();
