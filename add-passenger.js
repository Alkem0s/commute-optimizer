import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let currentFormHandler = null;
let xlsxLib = null; // Cache for the xlsx library

// Excel column mapping
const EXCEL_COLUMN_MAPPING = {
  'Dahili Gösterim Adı': 'id',
  'Servis No': 'ROUTE',
  'Servis Adresi': 'ADDRESS',
  'TANIM': 'DESTINATION_DESCRIPTION',
  'GİDER YERİ': 'DESTINATION_PLACE',
  'ikametgah adresine uzaklık': 'DISTANCE_TO_ADDRESS',
  'Servis Kullanımı': 'SERVICE_USAGE',
  'Servise Biniş': 'STOP_ADDRESS'
};

async function ensureFirebaseInitialized() {
  if (!isFirebaseInitialized) {
    try {
      await initializeFirebase();
      isFirebaseInitialized = true;
    } catch (error) {
      console.error("Firebase init failed:", error);
      alert("Firebase başlatılamadı.");
      throw error;
    }
  }
}

async function handleExcelImport() {
  const fileInput = document.getElementById('excel-file-input');
  fileInput.click();
}

async function processExcelFile(event) {
  const file = event.target.files[0];

  // Dosya yoksa veya geçersizse: çık
  if (!file || !(file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
    alert("Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)");
    event.target.value = '';
    const progressDiv = document.getElementById('import-progress');
    if (progressDiv) progressDiv.classList.add('hidden');
    return;
  }
   const progressDiv = document.getElementById('import-progress');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const resultDiv = document.getElementById('result');

progressDiv.classList.remove('hidden');
console.log("✅ Excel dosyası geçerli, progress gösteriliyor.");



  try {
    progressBar.style.width = '0%';

    if (!xlsxLib) {
      progressText.textContent = 'XLSX kütüphanesi yükleniyor...';
      xlsxLib = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');
    }

    progressText.textContent = 'Excel dosyası okunuyor...';

    const data = await readExcelFile(file);
    const passengers = parseExcelData(data);

    progressDiv.classList.remove('hidden'); // ✅ Artık güvenle gösterebiliriz

    if (passengers.length === 0) {
      throw new Error('Excel dosyasında geçerli yolcu verisi bulunamadı');
    }

    let processed = 0;
    let successful = 0;
    let errors = [];

    for (const passenger of passengers) {
      try {
        await api.setPassenger(passenger.id, {
          ADDRESS: passenger.ADDRESS || '',
          DESTINATION_DESCRIPTION: passenger.DESTINATION_DESCRIPTION || '',
          DESTINATION_PLACE: passenger.DESTINATION_PLACE || '',
          DISTANCE_TO_ADDRESS: passenger.DISTANCE_TO_ADDRESS || '',
          ROUTE: passenger.ROUTE || '',
          SERVICE_USAGE: passenger.SERVICE_USAGE || '',
          STOP_ADDRESS: passenger.STOP_ADDRESS || ''
        });
        successful++;
      } catch (error) {
        errors.push(`${passenger.id}: ${error.message}`);
      }

      processed++;
      const progress = (processed / passengers.length) * 100;
      progressBar.style.width = `${progress}%`;
      progressText.textContent = `${processed} / ${passengers.length} yolcu işlendi`;

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    progressDiv.classList.add('hidden');

    if (resultDiv) {
      resultDiv.classList.remove('hidden');
      resultDiv.style.display = 'block';
      let resultText = `<strong>İçe Aktarma Tamamlandı:</strong><br>`;
      resultText += `Toplam: ${passengers.length} yolcu<br>`;
      resultText += `Başarılı: ${successful} yolcu<br>`;
      resultText += `Başarısız: ${errors.length} yolcu<br><br>`;
      if (errors.length > 0) {
        resultText += `<strong>Hatalar:</strong><br>`;
        resultText += errors.slice(0, 10).join('<br>');
        if (errors.length > 10) {
          resultText += `<br>... ve ${errors.length - 10} hata daha`;
        }
      }
      resultDiv.innerHTML = resultText;
    }

  } catch (error) {
    console.error("Excel import error:", error);
    progressDiv.classList.add('hidden');

    if (resultDiv) {
      resultDiv.classList.remove('hidden');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `<strong>Hata:</strong><br>${error.message}`;
    }
  }

  event.target.value = '';
}


function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!xlsxLib) {
      reject(new Error('XLSX kütüphanesi yüklenmedi'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const workbook = xlsxLib.read(e.target.result, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = xlsxLib.utils.sheet_to_json(worksheet, { header: 1 });
        resolve(data);
      } catch (error) {
        reject(new Error('Excel dosyası okunamadı: ' + error.message));
      }
    };
    
    reader.onerror = function() {
      reject(new Error('Dosya okuma hatası'));
    };
    
    reader.readAsBinaryString(file);
  });
}
function parseExcelData(data) {
  if (data.length < 2) {
    throw new Error('Excel dosyası en az başlık satırı ve bir veri satırı içermelidir');
  }

  const headers = data[0];
  const passengers = [];

  // Find column indices based on mapping
  const columnIndices = {};
  for (const [excelCol, dbCol] of Object.entries(EXCEL_COLUMN_MAPPING)) {
    const index = headers.findIndex(header => 
      header && header.toString().trim().toLowerCase().includes(excelCol.toLowerCase())
    );
    if (index !== -1) {
      columnIndices[dbCol] = index;
    }
  }

  // Process data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const passenger = {};
    
    // Map columns
    for (const [dbCol, excelIndex] of Object.entries(columnIndices)) {
      if (row[excelIndex] !== undefined && row[excelIndex] !== null) {
        passenger[dbCol] = row[excelIndex].toString().trim();
      }
    }

    // Generate ID if not provided
    if (!passenger.id || passenger.id === '') {
      passenger.id = `passenger_${Date.now()}_${i}`;
    }

    // Skip if no meaningful data
    if (Object.keys(passenger).length > 1) { // More than just ID
      passengers.push(passenger);
    }
  }

  return passengers;
}

async function handleSetPassenger(event) {
  event.preventDefault();

  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = 'İşlem yapılıyor...';
  }

  try {
    const id = document.getElementById('setPassenger-id').value.trim();
    const routeId = document.getElementById('setPassenger-routeId').value.trim();
    const address = document.getElementById('setPassenger-address').value.trim();
    const destinationDescription = document.getElementById('setPassenger-destinationDescription').value.trim();
    const destinationPlace = document.getElementById('setPassenger-destinationPlace').value.trim();
    const distanceToAddress = document.getElementById('setPassenger-distanceToAddress').value.trim();
    const serviceUsage = document.getElementById('setPassenger-serviceUsage').value.trim();
    const stopAddress = document.getElementById('setPassenger-stopAddress').value.trim();

    if (!id) throw new Error('Yolcu ID boş olamaz');

    const result = await api.setPassenger(id, {
      ADDRESS: address,
      DESTINATION_DESCRIPTION: destinationDescription,
      DESTINATION_PLACE: destinationPlace,
      DISTANCE_TO_ADDRESS: distanceToAddress,
      ROUTE: routeId,
      SERVICE_USAGE: serviceUsage,
      STOP_ADDRESS: stopAddress
    });

    if (resultDiv) {
      resultDiv.innerHTML = `<strong>Sonuç:</strong><br><pre>${formatResult(result)}</pre>`;
    }
  } catch (error) {
    console.error("API error:", error);
    if (resultDiv) {
      resultDiv.innerHTML = `<strong>Hata:</strong><br>${error.message}`;
    }
  }
}

function formatResult(result) {
  if (result === undefined) return "İşlem başarılı (dönen veri yok)";
  if (typeof result === 'boolean') return result ? "İşlem başarılı" : "İşlem başarısız";
  if (result === null) return "Sonuç bulunamadı";
  if (typeof result === 'object') return JSON.stringify(result, null, 2);
  return result.toString();
}

// Directly execute the setup logic when the script is parsed
(async () => {
  await ensureFirebaseInitialized();
  
  // Setup form handler
  const apiForm = document.querySelector('.api-test-form');
  if (apiForm) {
    currentFormHandler = handleSetPassenger;
    apiForm.addEventListener('submit', currentFormHandler);
  } else {
    console.error("Form with class 'api-test-form' not found in add-passenger.html");
  }

  // Setup Excel import functionality
  const importBtn = document.getElementById('import-excel-btn');
  const fileInput = document.getElementById('excel-file-input');
  
  if (importBtn) {
    importBtn.addEventListener('click', handleExcelImport);
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', processExcelFile);
  }
})();