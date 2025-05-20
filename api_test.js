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
              const id1Input = document.getElementById('getPassenger-id');
              const id1 = id1Input ? id1Input.value : '';
              if (!id1) throw new Error('Yolcu ID gerekli');
              return await api.getPassenger(id1);
            case 'setPassenger':
              const id2Input = document.getElementById('setPassenger-id');
              const routeIdInput = document.getElementById('setPassenger-routeId');
              const addressInput = document.getElementById('setPassenger-address');
              const destinationDescriptionInput = document.getElementById('setPassenger-destinationDescription');
              const destinationPlaceInput = document.getElementById('setPassenger-destinationPlace');
              const distanceToAddressInput = document.getElementById('setPassenger-distanceToAddress');
              const serviceUsageInput = document.getElementById('setPassenger-serviceUsage');
              const stopAddressInput = document.getElementById('setPassenger-stopAddress');

              const id2 = id2Input ? id2Input.value : '';
              const routeId = routeIdInput ? routeIdInput.value : '';
              const address = addressInput ? addressInput.value : '';
              const destinationDescription = destinationDescriptionInput ? destinationDescriptionInput.value : '';
              const destinationPlace = destinationPlaceInput ? destinationPlaceInput.value : '';
              const distanceToAddress = distanceToAddressInput ? distanceToAddressInput.value : '';
              const serviceUsage = serviceUsageInput ? serviceUsageInput.value : '';
              const stopAddress = stopAddressInput ? stopAddressInput.value : '';

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
              const id3Input = document.getElementById('deletePassenger-id');
              const id3 = id3Input ? id3Input.value : '';
              if (!id3) throw new Error('Silinecek yolcu ID boş olamaz');
              return await api.deletePassenger(id3);
            case 'searchPassengers':
              const termInput = document.getElementById('searchPassengers-term');
              const term = termInput ? termInput.value : '';
              if (!term) throw new Error('Arama terimi boş olamaz');
              return await api.searchPassengers(term);

            case 'getAllRoutes':
              return await api.getAllRoutes();
            case 'getRoute':
              const id4Input = document.getElementById('getRoute-id');
              const id4 = id4Input ? id4Input.value : '';
              if (!id4) throw new Error('Rota ID gerekli');
              return await api.getRoute(id4);
            case 'setRoute':
              const id5Input = document.getElementById('setRoute-id');
              const vehicleIdInput = document.getElementById('setRoute-vehicleId');
              const latInput = document.getElementById('setRoute-lat');
              const longInput = document.getElementById('setRoute-long');
              const passengerIdsInput = document.getElementById('setRoute-passengerIds');

              const id5 = id5Input ? id5Input.value : '';
              const vehicleId = vehicleIdInput ? vehicleIdInput.value : '';
              const lat = latInput ? latInput.value : '';
              const long = longInput ? longInput.value : '';
              const passengerIdsRaw = passengerIdsInput ? passengerIdsInput.value : '';

              if (!id5) throw new Error('Rota ID gerekli');

              // Construct STOPS array with LAT and LONG as strings
              const stops = (lat && long) ? [{ LAT: lat, LONG: long }] : [];

              // Parse passenger IDs into an array of strings
              const passengerIds = passengerIdsRaw
                ? passengerIdsRaw.split(',').map(id => id.trim())
                : [];

              return await api.setRoute(id5, {
                STOPS: stops,
                VEHICLE_ID: vehicleId.toUpperCase(),
                PASSENGER_IDS: passengerIds
              });

            case 'deleteRoute':
              const id6Input = document.getElementById('deleteRoute-id');
              const id6 = id6Input ? id6Input.value : '';
              if (!id6) throw new Error('Rota ID gerekli');
              return await api.deleteRoute(id6);
            case 'addPassengerToRoute':
              const rid1Input = document.getElementById('addPassengerToRoute-routeId');
              const pid1Input = document.getElementById('addPassengerToRoute-passengerId');
              const rid1 = rid1Input ? rid1Input.value : '';
              const pid1 = pid1Input ? pid1Input.value : '';
              if (!rid1 || !pid1) throw new Error('Her iki ID de gerekli');
              return await api.addPassengerToRoute(rid1, pid1);
            case 'removePassengerFromRoute':
              const rid2Input = document.getElementById('removePassengerFromRoute-routeId');
              const pid2Input = document.getElementById('removePassengerFromRoute-passengerId');
              const rid2 = rid2Input ? rid2Input.value : '';
              const pid2 = pid2Input ? pid2Input.value : '';
              if (!rid2 || !pid2) throw new Error('Her iki ID de gerekli');
              return await api.removePassengerFromRoute(rid2, pid2);

            case 'getAllVehicles':
              return await api.getAllVehicles();
            case 'getVehicle':
              const id7Input = document.getElementById('getVehicle-id');
              const id7 = id7Input ? id7Input.value : '';
              if (!id7) throw new Error('Araç ID gerekli');
              return await api.getVehicle(id7);
            case 'setVehicle':
              const id8Input = document.getElementById('setVehicle-id');
              const plateInput = document.getElementById('setVehicle-plate');
              const capacityInput = document.getElementById('setVehicle-capacity');
              const vehicleManagerInput = document.getElementById('setVehicle-vehicleManager');

              const id8 = id8Input ? id8Input.value : '';
              const plate = plateInput ? plateInput.value : '';
              const capacity = capacityInput ? capacityInput.value : ''; // Keep as string
              const vehicleManager = vehicleManagerInput ? vehicleManagerInput.value : ''; // New field

              if (!id8) throw new Error('Araç ID gerekli');
              return await api.setVehicle(id8, {
                PLATE: plate,
                CAPACITY: capacity, // Now passed as a string
                ASSIGNED_SEAT_COUNT: "0", // Assuming this remains a string
                VEHICLE_MANAGER: vehicleManager // New field
              });
            case 'deleteVehicle':
              const id9Input = document.getElementById('deleteVehicle-id');
              const id9 = id9Input ? id9Input.value : '';
              if (!id9) throw new Error('Araç ID gerekli');
              return await api.deleteVehicle(id9);
            case 'assignVehicleToRoute':
              const rid3Input = document.getElementById('assignVehicleToRoute-routeId');
              const vidInput = document.getElementById('assignVehicleToRoute-vehicleId');
              const rid3 = rid3Input ? rid3Input.value : '';
              const vid = vidInput ? vidInput.value : '';
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
