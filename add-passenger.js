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

// Create our own progress bar functions to ensure they work
function createAndShowProgressBar() {
  console.log("🎯 createAndShowProgressBar çağrıldı");
  
  const progressContainer = document.getElementById('progress-container');
  if (!progressContainer) {
    console.error('❌ Progress container bulunamadı');
    return false;
  }
  
  // Create progress bar HTML
  progressContainer.innerHTML = `
    <div class="import-progress show" id="import-progress">
      <div class="progress-content">
        <div class="spinner"></div>
        <span class="font-semibold text-blue-800">Excel dosyası işleniyor...</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" id="progress-bar"></div>
      </div>
      <div id="progress-text" class="text-sm text-blue-700 mt-2">0 / 0 yolcu işlendi</div>
    </div>
  `;
  
  console.log("✅ Progress bar HTML oluşturuldu");
  return true;
}

function updateProgressBar(current, total) {
  console.log(`📊 Progress güncelleniyor: ${current}/${total}`);
  
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  if (progressBar && progressText) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressBar.style.width = percentage + '%';
    progressText.textContent = `${current} / ${total} yolcu işlendi`;
    console.log(`✅ Progress güncellendi: ${percentage.toFixed(1)}%`);
  } else {
    console.warn('⚠️ Progress elementleri bulunamadı:', { 
      progressBar: !!progressBar, 
      progressText: !!progressText 
    });
  }
}

function hideProgressBar() {
  console.log("🎯 hideProgressBar çağrıldı");
  
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    progressContainer.innerHTML = '';
    console.log("✅ Progress bar gizlendi");
  } else {
    console.warn("⚠️ Progress container bulunamadı");
  }
}

function updateProgressText(text) {
  console.log("📝 Progress text güncelleniyor:", text);
  
  const progressText = document.getElementById('progress-text');
  if (progressText) {
    const currentText = progressText.textContent;
    const match = currentText.match(/(\d+) \/ (\d+) yolcu işlendi/);
    if (match) {
      progressText.innerHTML = `${text}<br><small>${currentText}</small>`;
    } else {
      progressText.textContent = text;
    }
    console.log("✅ Progress text güncellendi");
  } else {
    console.warn("⚠️ Progress text element bulunamadı");
  }
}

async function processExcelFile(event) {
  console.log("🚀 processExcelFile başladı");
  
  const file = event.target.files[0];

  // First check if file exists
  if (!file) {
    console.log("❌ Dosya seçilmedi");
    return;
  }

  console.log("📁 Dosya seçildi:", file.name, "Boyut:", file.size, "bytes");

  // Show progress bar immediately
  const progressShown = createAndShowProgressBar();
  if (!progressShown) {
    console.error("❌ Progress bar gösterilemedi");
    return;
  }

  // Small delay to ensure DOM is ready
  await new Promise(resolve => setTimeout(resolve, 100));

  // Now validate file type
  if (!(file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
    console.error("❌ Geçersiz dosya türü:", file.name);
    alert("Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)");
    event.target.value = '';
    hideProgressBar();
    return;
  }

  console.log("✅ Excel dosyası geçerli, işleme başlanıyor");

  try {
    // Update initial progress
    updateProgressBar(0, 1);

    if (!xlsxLib) {
      updateProgressText('XLSX kütüphanesi yükleniyor...');
      console.log("📚 XLSX kütüphanesi yükleniyor...");
      
      // Try to load from the existing script tag first
      if (typeof XLSX !== 'undefined') {
        xlsxLib = XLSX;
        console.log("✅ XLSX global olarak bulundu");
      } else {
        // Fallback to dynamic import
        xlsxLib = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');
        console.log("✅ XLSX dinamik olarak yüklendi");
      }
    }

    updateProgressText('Excel dosyası okunuyor...');
    console.log("📖 Excel dosyası okunuyor...");

    const data = await readExcelFile(file);
    console.log("📋 Excel verisi okundu, satır sayısı:", data.length);

    const passengers = parseExcelData(data);
    console.log("👥 Parse edilen yolcu sayısı:", passengers.length);

    if (passengers.length === 0) {
      throw new Error('Excel dosyasında geçerli yolcu verisi bulunamadı');
    }

    let processed = 0;
    let successful = 0;
    let errors = [];

    console.log("🚀 Yolcu kaydetme işlemi başlıyor...");
    updateProgressText('Yolcular kaydediliyor...');

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
        console.log(`✅ Yolcu kaydedildi: ${passenger.id}`);
      } catch (error) {
        errors.push(`${passenger.id}: ${error.message}`);
        console.error(`❌ Yolcu kaydedilemedi: ${passenger.id}`, error);
      }

      processed++;
      updateProgressBar(processed, passengers.length);

      // Small delay to make progress visible
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log("🏁 İşlem tamamlandı. Başarılı:", successful, "Hatalı:", errors.length);

    // Keep progress bar visible for a moment before hiding
    updateProgressText('İşlem tamamlandı!');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    hideProgressBar();

    // Show results
    const resultDiv = document.getElementById('result');
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
    console.error("❌ Excel import error:", error);
    
    hideProgressBar();

    const resultDiv = document.getElementById('result');
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
        let workbook;
        
        // Handle both global XLSX and module import
        if (typeof xlsxLib.read === 'function') {
          workbook = xlsxLib.read(e.target.result, { type: 'binary' });
        } else if (xlsxLib.default && typeof xlsxLib.default.read === 'function') {
          workbook = xlsxLib.default.read(e.target.result, { type: 'binary' });
        } else {
          throw new Error('XLSX read function not found');
        }
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        let data;
        if (typeof xlsxLib.utils === 'object') {
          data = xlsxLib.utils.sheet_to_json(worksheet, { header: 1 });
        } else if (xlsxLib.default && typeof xlsxLib.default.utils === 'object') {
          data = xlsxLib.default.utils.sheet_to_json(worksheet, { header: 1 });
        } else {
          throw new Error('XLSX utils not found');
        }
        
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

  console.log("📋 Excel başlıkları:", headers);

  // Find column indices based on mapping
  const columnIndices = {};
  for (const [excelCol, dbCol] of Object.entries(EXCEL_COLUMN_MAPPING)) {
    const index = headers.findIndex(header => 
      header && header.toString().trim().toLowerCase().includes(excelCol.toLowerCase())
    );
    if (index !== -1) {
      columnIndices[dbCol] = index;
      console.log(`📍 Kolon eşleşmesi: ${excelCol} -> ${dbCol} (index: ${index})`);
    }
  }

  console.log("🗂️ Kolon indeksleri:", columnIndices);

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
  console.log("🚀 add-passenger.js yükleniyor...");
  
  await ensureFirebaseInitialized();
  console.log("🔥 Firebase başlatıldı");
  
  // Setup form handler
  const apiForm = document.querySelector('.api-test-form');
  if (apiForm) {
    currentFormHandler = handleSetPassenger;
    apiForm.addEventListener('submit', currentFormHandler);
    console.log("📝 Form handler kuruldu");
  } else {
    console.error("❌ Form with class 'api-test-form' not found in add-passenger.html");
  }

  // Setup Excel import functionality
  const importBtn = document.getElementById('import-excel-btn');
  const fileInput = document.getElementById('excel-file-input');
  
  if (importBtn) {
    importBtn.addEventListener('click', handleExcelImport);
    console.log("📊 Excel import button handler kuruldu");
  } else {
    console.error("❌ Import button not found");
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', processExcelFile);
    console.log("📁 File input handler kuruldu");
  } else {
    console.error("❌ File input not found");
  }

  // Check if progress container exists
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    console.log("✅ Progress container bulundu");
  } else {
    console.error("❌ Progress container bulunamadı - HTML'de progress-container ID'li element var mı?");
  }
  
  console.log("✅ add-passenger.js tamamen yüklendi");
})();