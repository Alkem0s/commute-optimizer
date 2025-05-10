import { db } from "./firebase.js";

async function visualizePassengers() {
  const passengersDocRef = db.collection("COMMUTE_OPTIMIZER_COLLECTION").doc("PASSENGERS");
  const userCollections = await passengersDocRef.listCollections();

  if (userCollections.length === 0) {
    console.log("No user collections found under PASSENGERS.");
    return;
  }

  console.log("COMMUTE_OPTIMIZER_COLLECTION");
  console.log("└── PASSENGERS");

  for (const userCol of userCollections) {
    const userCollectionName = userCol.id;
    const userDocRef = userCol.doc(`ID:${userCollectionName}`);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.log(`    └── ${userCollectionName} (ID:${userCollectionName}) → Document not found`);
      continue;
    }

    const data = userDocSnap.data();
    console.log(`    └── ${userCollectionName}`);
    console.log(`        └── ID:${userCollectionName}`);
    for (const [key, value] of Object.entries(data)) {
      console.log(`            ├── ${key}: ${JSON.stringify(value)}`);
    }
  }
}

visualizePassengers().catch(console.error);
