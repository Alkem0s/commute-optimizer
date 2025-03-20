// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import fs from "fs";

// Read config.json file
const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// Initialize Firebase
const firebaseApp = initializeApp({
    apiKey: config.DB_apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId
});

// Get Firestore instance
const db = getFirestore(firebaseApp);

export { db, addDoc, collection };
