import { initializeFirebase, getDb } from './firebase.js';
import { collection, doc, setDoc } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs';

document.getElementById('excelFile').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  await initializeFirebase();
  const db = getDb();
  if (!db) {
    console.error("Firestore is not initialized.");
    return;
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  for (const row of jsonData) {
    try {
      const passengerName = row["Dahili Gösterim Adı"];
      if (!passengerName) continue;

      const passengerData = {
        ADDRESS: row["Servis Adresi"],
        DESTINATION_DESCRIPTION: row["GİDER YERİ TANIM"],
        DESTINATION_PLACE: row["GİDER YERİ"],
        DISTANCE_TO_ADDRESS: String(row["ikametgah adresine uzaklık"] ?? ""),
        ROUTE: row["Servis No"],
        SERVICE_USAGE: row["Servis Kullanımı"]?.toUpperCase() === "EVET" ? "TRUE" : "FALSE",
        STOP_ADDRESS: row["Servis Adresi"]
      };

      const docRef = doc(
        collection(db, "COMMUTE_OPTIMIZER_COLLECTION", "PASSENGERS", passengerName),
        "ID:" + passengerName
      );

      await setDoc(docRef, passengerData);
      console.log(`✅ Uploaded data for: ${passengerName}`);
    } catch (err) {
      console.error(`❌ Failed to upload for a row:`, err);
    }
  }
});
