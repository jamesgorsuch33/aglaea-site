/* ============================================================
   FIREBASE CONFIGURATION
   ============================================================ */

// TODO: Replace with YOUR Firebase config from Firebase Console
// Get this from: Firebase Console → Project Settings → Your apps → Web app

const firebaseConfig = {
  apiKey: "AIzaSyDhHVm4sfnPcmdIykm6uTBdbi3SyRMvB8Q",
  authDomain: "agleae-remind-app.firebaseapp.com",
  projectId: "agleae-remind-app",
  storageBucket: "agleae-remind-app.firebasestorage.app",
  messagingSenderId: "608220667658",
  appId: "1:608220667658:web:d7676e96c2838b8b3464f3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Export for use in other files
window.firebaseServices = {
    auth,
    db
};
