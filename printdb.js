import { db } from './firebase.js';

async function printFirestoreDatabase() {
  try {
    const collections = await db.listCollections();

    for (const collection of collections) {
      console.log(`Collection: ${collection.id}`);
      const snapshot = await collection.get();
      snapshot.forEach(doc => {
        console.log(`${doc.id}:`, doc.data());
      });
    }
  } catch (error) {
    console.error("Error fetching Firestore data:", error);
  }
}

printFirestoreDatabase();
