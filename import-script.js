import * as XLSX from "xlsx";
import firebase from "./firebase.js"; // Your provided firebase config module
import fs from "fs";

// Load the Excel file
const workbook = XLSX.readFile("data.xlsx");
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // Preserve empty strings

// Upload each row to Firestore
const uploadToFirestore = async () => {
  for (const row of rows) {
    const docId = `${row["Servis No"]}_${row["SERVİS SIRA"]}`; // Customize as needed

    await firebase.setDoc(
      firebase.doc(firebase.db, "servisler", docId),
      {
        dahiliGosterimAdi: row["Dahili Gösterim Adı"],
        giderYeri: row["GİDER YERİ"],
        giderYeriTanim: row["GİDER YERİ TANIM"],
        servisKullanimi: row["Servis Kullanımı"],
        servisNo: row["Servis No"],
        binisSaati: row["Servise Biniş Saati"],
        inisSaati: row["Servise İniş Saati"],
        servisSira: row["SERVİS SIRA"],
        servisAdresi: row["Servis Adresi"],
        ikametgahUzaklik: row["ikametgah adresine uzaklık"],
      }
    );

    console.log(`Uploaded: ${docId}`);
  }

  console.log("✅ All data uploaded successfully.");
};

uploadToFirestore().catch(console.error);
