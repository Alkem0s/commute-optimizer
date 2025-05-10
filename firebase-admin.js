import admin from "firebase-admin";
import fs from "fs";

// Load service account config
const config = JSON.parse(fs.readFileSync("config_db.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(config),
});

const db = admin.firestore();

export { db };
