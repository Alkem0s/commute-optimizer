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

export async function setupApiTestPage() {
  try {
    await ensureFirebaseInitialized();
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure DOM is fully painted

    const methodSelect = document.getElementById('api-method');
    const resultDiv = document.getElementById('result');
    const apiForm = document.querySelector('.api-test-form');

    if (!apiForm) {
      console.warn("API form (.api-test-form) not found on this page. This page might not function as expected if it relies on this form.");
      return;
    }

    if (currentFormHandler) {
      apiForm.removeEventListener('submit', currentFormHandler);
    }

    currentFormHandler = async (event) => {
      event.preventDefault();
      let selectedMethod = 'setPassenger'; // Default, but should be set by select or hidden input
      
      if (methodSelect && methodSelect.value) {
        selectedMethod = methodSelect.value;
      } else {
        const hiddenMethodInput = document.getElementById('api-method');
        if (hiddenMethodInput && hiddenMethodInput.value) {
          selectedMethod = hiddenMethodInput.value;
        }
      }
      console.log('Selected API method:', selectedMethod);
      if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = 'İşlem yapılıyor...';
      }
      try {
        const result = await handleApiMethod(selectedMethod);
        if (resultDiv) {
          resultDiv.innerHTML = `<strong>Sonuç:</strong><br><pre>${formatResult(result)}</pre>`;
        }
      } catch (error) {
        console.error("API error:", error);
        if (resultDiv) {
          resultDiv.innerHTML = `<strong>Hata:</strong><br>${error.message}`;
        }
      }
    };
    apiForm.addEventListener('submit', currentFormHandler);

    if (methodSelect) {
      const newMethodSelect = methodSelect.cloneNode(true);
      methodSelect.parentNode.replaceChild(newMethodSelect, methodSelect);
      
      newMethodSelect.addEventListener('change', () => {
        document.querySelectorAll('.form-fields').forEach(f => f.style.display = 'none');
        const selected = newMethodSelect.value;
        const targetFields = document.getElementById(`${selected}-fields`);
        if (targetFields) targetFields.style.display = 'block';
      });
      if (newMethodSelect.value) {
        newMethodSelect.dispatchEvent(new Event('change'));
      }
    } else {
      const hiddenMethodInput = document.getElementById('api-method');
      if (hiddenMethodInput && hiddenMethodInput.value) {
        const targetFields = document.getElementById(`${hiddenMethodInput.value}-fields`);
        if (targetFields) {
          document.querySelectorAll('.form-fields').forEach(f => f.style.display = 'none');
          targetFields.style.display = 'block';
        }
      }
    }
    console.log("API test page setup completed for a form-based page.");
  } catch (error) {
    console.error("Setup failed in setupApiTestPage:", error);
  }
}

async function handleApiMethod(method) {
  switch (method) {
    case 'getAllPassengers':
      return await api.getAllPassengers();
      
    case 'getPassenger':
      const id1 = getInputValue('getPassenger-id');
      if (!id1) throw new Error('Yolcu ID gerekli');
      return await api.getPassenger(id1);
      
    case 'setPassenger':
      const id2 = getInputValue('setPassenger-id');
      const routeId = getInputValue('setPassenger-routeId');
      const address = getInputValue('setPassenger-address');
      const destinationDescription = getInputValue('setPassenger-destinationDescription');
      const destinationPlace = getInputValue('setPassenger-destinationPlace');
      const distanceToAddress = getInputValue('setPassenger-distanceToAddress');
      const serviceUsage = getInputValue('setPassenger-serviceUsage');
      const stopAddress = getInputValue('setPassenger-stopAddress');

      if (!id2) throw new Error('Yolcu ID boş olamaz');
      return await api.setPassenger(id2, {
        ADDRESS: address,
        DESTINATION_DESCRIPTION: destinationDescription,
        DESTINATION_PLACE: destinationPlace,
        DISTANCE_TO_ADDRESS: distanceToAddress,
        ROUTE: routeId,
        SERVICE_USAGE: serviceUsage,
        STOP_ADDRESS: stopAddress
      });
      
    case 'deletePassenger':
      const id3 = getInputValue('deletePassenger-id');
      if (!id3) throw new Error('Silinecek yolcu ID boş olamaz');
      return await api.deletePassenger(id3);
      
    case 'searchPassengers':
      const term = getInputValue('searchPassengers-term');
      if (!term) throw new Error('Arama terimi boş olamaz');
      return await api.searchPassengers(term);

    case 'getAllRoutes':
      return await api.getAllRoutes();
      
    case 'getRoute':
      const id4 = getInputValue('getRoute-id');
      if (!id4) throw new Error('Rota ID gerekli');
      return await api.getRoute(id4);
      
    case 'setRoute':
      const id5 = getInputValue('setRoute-id');
      const vehicleId = getInputValue('setRoute-vehicleId');
      const lat = getInputValue('setRoute-lat');
      const long = getInputValue('setRoute-long');
      const passengerIdsRaw = getInputValue('setRoute-passengerIds');

      if (!id5) throw new Error('Rota ID gerekli');

      const stops = (lat && long) ? [{ LAT: lat, LONG: long }] : [];
      const passengerIds = passengerIdsRaw
        ? passengerIdsRaw.split(',').map(id => id.trim())
        : [];

      return await api.setRoute(id5, {
        STOPS: stops,
        VEHICLE_ID: vehicleId.toUpperCase(),
        PASSENGER_IDS: passengerIds
      });

    case 'deleteRoute':
      const id6 = getInputValue('deleteRoute-id');
      if (!id6) throw new Error('Rota ID gerekli');
      return await api.deleteRoute(id6);
      
    case 'addPassengerToRoute':
      const rid1 = getInputValue('addPassengerToRoute-routeId');
      const pid1 = getInputValue('addPassengerToRoute-passengerId');
      if (!rid1 || !pid1) throw new Error('Her iki ID de gerekli');
      return await api.addPassengerToRoute(rid1, pid1);
      
    case 'removePassengerFromRoute':
      const rid2 = getInputValue('removePassengerFromRoute-routeId');
      const pid2 = getInputValue('removePassengerFromRoute-passengerId');
      if (!rid2 || !pid2) throw new Error('Her iki ID de gerekli');
      return await api.removePassengerFromRoute(rid2, pid2);

    case 'getAllVehicles':
      return await api.getAllVehicles();
      
    case 'getVehicle':
      const id7 = getInputValue('getVehicle-id');
      if (!id7) throw new Error('Araç ID gerekli');
      return await api.getVehicle(id7);
      
    case 'setVehicle':
      const id8 = getInputValue('setVehicle-id');
      const plate = getInputValue('setVehicle-plate');
      const capacity = getInputValue('setVehicle-capacity');
      const vehicleManager = getInputValue('setVehicle-vehicleManager');

      if (!id8) throw new Error('Araç ID gerekli');
      return await api.setVehicle(id8, {
        PLATE: plate,
        CAPACITY: capacity,
        ASSIGNED_SEAT_COUNT: "0",
        VEHICLE_MANAGER: vehicleManager
      });
      
    case 'deleteVehicle':
      const id9 = getInputValue('deleteVehicle-id');
      if (!id9) throw new Error('Araç ID gerekli');
      return await api.deleteVehicle(id9);
      
    case 'assignVehicleToRoute':
      const rid3 = getInputValue('assignVehicleToRoute-routeId');
      const vid = getInputValue('assignVehicleToRoute-vehicleId');
      if (!rid3 || !vid) throw new Error('Rota ve araç ID gerekli');
      return await api.assignVehicleToRoute(rid3, vid);

    default:
      throw new Error("Bilinmeyen API metodu: " + method);
  }
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

function formatResult(result) {
  if (result === undefined) return "İşlem başarılı (dönen veri yok)";
  if (typeof result === 'boolean') return result ? "İşlem başarılı" : "İşlem başarısız";
  if (result === null) return "Sonuç bulunamadı";
  if (typeof result === 'object') return JSON.stringify(result, null, 2);
  return result.toString();
}

// Directly execute the setup logic for api_test.html
(async () => {
  await setupApiTestPage();
})();