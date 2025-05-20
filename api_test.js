import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let isSetupDone = false;

function setupApiTestPage() {
  if (isSetupDone) return;
  isSetupDone = true;

  if (!isFirebaseInitialized) {
    initializeFirebase().catch(error => {
      console.error("Firebase init failed:", error);
      alert("Firebase başlatılamadı.");
    });
    isFirebaseInitialized = true;
  }

  const methodSelect = document.getElementById('api-method');
  const resultDiv = document.getElementById('result');
  const apiForm = document.querySelector('.api-test-form');

  if (!methodSelect || !resultDiv || !apiForm) {
    console.warn("Gerekli DOM elemanları henüz yüklenmedi. Tekrar deneniyor...");
    isSetupDone = false;
    setTimeout(setupApiTestPage, 100); // DOM hazır değilse tekrar dene
    return;
  }

  methodSelect.addEventListener('change', () => {
    document.querySelectorAll('.form-fields').forEach(f => f.style.display = 'none');
    const selected = methodSelect.value;
    const targetFields = document.getElementById(`${selected}-fields`);
    if (targetFields) targetFields.style.display = 'block';
  });

  apiForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const selectedMethod = methodSelect.value;
    if (!selectedMethod) {
      alert('Lütfen bir API metodu seçin.');
      return;
    }

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = 'İşlem yapılıyor...';

    try {
      const result = await handleApiMethod(selectedMethod);
      resultDiv.innerHTML = `<strong>Sonuç:</strong><br><pre>${formatResult(result)}</pre>`;
    } catch (error) {
      console.error("API error:", error);
      resultDiv.innerHTML = `<strong>Hata:</strong><br>${error.message}`;
    }
  });
}

setupApiTestPage(); // ilk tetikleme

// 👇 Bu fonksiyon, her bir API metodunu yönetir
async function handleApiMethod(method) {
  switch (method) {
    case 'getAllPassengers':
      return await api.getAllPassengers();
    case 'getPassenger':
      const id1 = document.getElementById('getPassenger-id').value;
      if (!id1) throw new Error('Yolcu ID gerekli');
      return await api.getPassenger(id1);
    case 'setPassenger':
      const id2 = document.getElementById('setPassenger-id').value;
      const routeId = document.getElementById('setPassenger-routeId').value;
      const address = document.getElementById('setPassenger-address').value;
      if (!id2) throw new Error('Yolcu ID boş olamaz');
      return await api.setPassenger(id2, [routeId, address]);
    case 'deletePassenger':
      const id3 = document.getElementById('deletePassenger-id').value;
      if (!id3) throw new Error('Silinecek yolcu ID boş olamaz');
      return await api.deletePassenger(id3);
    case 'searchPassengers':
      const term = document.getElementById('searchPassengers-term').value;
      if (!term) throw new Error('Arama terimi boş olamaz');
      return await api.searchPassengers(term);

    case 'getAllRoutes':
      return await api.getAllRoutes();
    case 'getRoute':
      const id4 = document.getElementById('getRoute-id').value;
      if (!id4) throw new Error('Rota ID gerekli');
      return await api.getRoute(id4);
    case 'setRoute':
      const id5 = document.getElementById('setRoute-id').value;
      const vehicleId = document.getElementById('setRoute-vehicleId').value;
      const lat = document.getElementById('setRoute-lat').value;
      const long = document.getElementById('setRoute-long').value;
      const passengerIdsInput = document.getElementById('setRoute-passengerIds').value;

      if (!id5) throw new Error('Rota ID gerekli');
      const stops = (lat && long) ? [{ LAT: lat, LONG: long }] : [];
      const passengerIds = passengerIdsInput
        ? passengerIdsInput.split(',').map(id => id.trim())
        : [];

      return await api.setRoute(id5, {
        STOPS: stops,
        VEHICLE_ID: vehicleId.toUpperCase(),
        PASSENGER_IDS: passengerIds
      });

    case 'deleteRoute':
      const id6 = document.getElementById('deleteRoute-id').value;
      if (!id6) throw new Error('Rota ID gerekli');
      return await api.deleteRoute(id6);
    case 'addPassengerToRoute':
      const rid1 = document.getElementById('addPassengerToRoute-routeId').value;
      const pid1 = document.getElementById('addPassengerToRoute-passengerId').value;
      if (!rid1 || !pid1) throw new Error('Her iki ID de gerekli');
      return await api.addPassengerToRoute(rid1, pid1);
    case 'removePassengerFromRoute':
      const rid2 = document.getElementById('removePassengerFromRoute-routeId').value;
      const pid2 = document.getElementById('removePassengerFromRoute-passengerId').value;
      if (!rid2 || !pid2) throw new Error('Her iki ID de gerekli');
      return await api.removePassengerFromRoute(rid2, pid2);

    case 'getAllVehicles':
      return await api.getAllVehicles();
    case 'getVehicle':
      const id7 = document.getElementById('getVehicle-id').value;
      if (!id7) throw new Error('Araç ID gerekli');
      return await api.getVehicle(id7);
    case 'setVehicle':
      const id8 = document.getElementById('setVehicle-id').value;
      const plate = document.getElementById('setVehicle-plate').value;
      const capacity = document.getElementById('setVehicle-capacity').value;
      if (!id8) throw new Error('Araç ID gerekli');
      return await api.setVehicle(id8, {
        PLATE: plate,
        CAPACITY: capacity,
        ASSIGNED_SEAT_COUNT: "0"
      });
    case 'deleteVehicle':
      const id9 = document.getElementById('deleteVehicle-id').value;
      if (!id9) throw new Error('Araç ID gerekli');
      return await api.deleteVehicle(id9);
    case 'assignVehicleToRoute':
      const rid3 = document.getElementById('assignVehicleToRoute-routeId').value;
      const vid = document.getElementById('assignVehicleToRoute-vehicleId').value;
      if (!rid3 || !vid) throw new Error('Rota ve araç ID gerekli');
      return await api.assignVehicleToRoute(rid3, vid);

    default:
      throw new Error("Bilinmeyen API metodu: " + method);
  }
}

function formatResult(result) {
  if (result === undefined) return "İşlem başarılı (dönen veri yok)";
  if (typeof result === 'boolean') return result ? "İşlem başarılı" : "İşlem başarısız";
  if (result === null) return "Sonuç bulunamadı";
  if (typeof result === 'object') return JSON.stringify(result, null, 2);
  return result.toString();
}
