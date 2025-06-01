import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let currentFormHandler = null;

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
  const apiForm = document.querySelector('.api-test-form');
  if (apiForm) {
    currentFormHandler = handleSetPassenger;
    apiForm.addEventListener('submit', currentFormHandler);
  } else {
    console.error("Form with class 'api-test-form' not found in add-passenger.html");
  }
})();