// Firebase configuration and initialization
const { initializeApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator } = require('firebase/firestore');
const { getAuth } = require('firebase/auth');

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyDPEMw5tzQ6UpWzB1Femj04f71rIx2qETk",
  authDomain: "solomaxstudios-246c0.firebaseapp.com",
  projectId: "solomaxstudios-246c0",
  storageBucket: "solomaxstudios-246c0.firebasestorage.app",
  messagingSenderId: "636289372629",
  appId: "1:636289372629:web:f8c37785cb827b6ab8ed5c",
  measurementId: "G-WZ872HZ7N8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Auth (if needed)
const auth = getAuth(app);

// Export for use in other modules
module.exports = {
  app,
  db,
  auth,
  firebaseConfig
};
