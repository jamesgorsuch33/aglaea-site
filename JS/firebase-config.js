// ============================================================
// FIREBASE CONFIGURATION (Compat SDK for Signup/Signin)
// For use with older Firebase compat SDK
// ============================================================

// Firebase configuration
const firebaseConfig = {
 		apiKey: "AIzaSyDhHVm4sfnPcmdIykm6uTBdbi3SyRMvB8Q",
  		authDomain: "agleae-remind-app.firebaseapp.com",
  		databaseURL: "https://agleae-remind-app-default-rtdb.europe-west1.firebasedatabase.app",
  		projectId: "agleae-remind-app",
  		storageBucket: "agleae-remind-app.firebasestorage.app",
  		messagingSenderId: "608220667658",
  		appId: "1:608220667658:web:d7676e96c2838b8b3464f3"
};

// Initialize Firebase (compat SDK)
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
