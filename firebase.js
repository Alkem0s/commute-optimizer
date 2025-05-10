// firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

let db = null;

export async function initializeFirebase() {
  try {
    const response = await fetch('./config.json');
    const firebaseConfig = await response.json();

    console.log('Initializing Firebase with config:', firebaseConfig);
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);

    console.log('✅ Firebase initialized successfully.');
  } catch (error) {
    console.error('❌❌❌❌ Firebase initialization failed:', error);
  }
}

export function getDb() {
  return db;
}
