// Function to add Yolcular data with individual parameters
async function addYolcularData(
  dahili_gosterim_adi,
  gider_yeri,
  gider_yeri_tanim,
  servis_kullanimi,
  servis_no,
  servise_binis_saati,
  servise_inis_saati,
  servis_sira,
  servis_adresi,
  ikametgah_adresine_uzaklik
) {
  try {
    const docRef = await addDoc(collection(db, "YOLCULAR"), {
      "Dahili Gösterim Adı": dahili_gosterim_adi,
      "GİDER YERİ": gider_yeri,
      "GİDER YERİ TANIM": gider_yeri_tanim,
      "Servis Kullanımı": servis_kullanimi,
      "Servis No": servis_no,
      "Servise Biniş Saati": servise_binis_saati,
      "Servise İniş Saati": servise_inis_saati,
      "SERVİS SIRA": servis_sira,
      "Servis Adresi": servis_adresi,
      "ikametgah adresine uzaklık": ikametgah_adresine_uzaklik
    });

    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

import { doc, deleteDoc } from "firebase/firestore"; // Import necessary functions

// Function to remove Yolcular data by document ID
async function removeYolcularData(documentId) {
  try {
    // Reference to the specific document in the "YOLCULAR" collection
    const docRef = doc(db, "YOLCULAR", documentId);

    // Delete the document
    await deleteDoc(docRef);

    console.log("Document successfully deleted!");
  } catch (e) {
    console.error("Error deleting document: ", e);
  }
}

async function modifyYolcularData(documentId, field, newValue) {
    try {
      // Reference to the specific document in the "YOLCULAR" collection
      const docRef = doc(db, "YOLCULAR", documentId);
  
      // Update the specific field with the new value
      await updateDoc(docRef, {
        [field]: newValue, // Dynamic field update using bracket notation
      });
  
      console.log(`Document with ID ${documentId} successfully updated!`);
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  }

  import { query, where, getDocs, collection } from "firebase/firestore"; // Import necessary Firestore functions

// Function to find a Yolcu by their Dahili Gösterim Adı
async function findYolcu(dahili_gosterim_adi) {
  try {
    // Reference to the "YOLCULAR" collection
    const yolcularRef = collection(db, "YOLCULAR");

    // Create a query to find documents where the "Dahili Gösterim Adı" field matches the provided value
    const q = query(yolcularRef, where("Dahili Gösterim Adı", "==", dahili_gosterim_adi));

    // Get the snapshot of documents matching the query
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("No Yolcu found with that Dahili Gösterim Adı");
      return null;
    }

    // Map through the documents and return the data
    const yolcuData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return yolcuData; // Returns an array of matching documents

  } catch (e) {
    console.error("Error finding Yolcu: ", e);
    return null;
  }
}
