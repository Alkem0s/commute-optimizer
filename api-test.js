import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let currentFormHandler = null; // Storing the bound handler for form submit
let methodSelectElement = null; // Reference to the API method select element
let apiFormElement = null; // Reference to the API test form


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

async function handleApiCall(event) {
  event.preventDefault();

  let selectedMethod = 'setPassenger'; // Default, but should be set by select or hidden input
  if (methodSelectElement) {
    selectedMethod = methodSelectElement.value;
  }

  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = 'İşlem yapılıyor...';
  }

  try {
    const result = await makeApiCall(selectedMethod);
    if (resultDiv) {
      resultDiv.innerHTML = `<strong>Sonuç:</strong><br><pre>${formatResult(result)}</pre>`;
    }
  } catch (error) {
    console.error("API çağrısı hatası:", error);
    if (resultDiv) {
      resultDiv.innerHTML = `<strong>Hata:</strong><br>${error.message}`;
    }
  }
}

async function updateFormInputs(selectedMethod) {
  const formFieldsContainer = document.getElementById('form-fields');
  if (!formFieldsContainer) return;

  // Clear previous fields
  formFieldsContainer.innerHTML = '';

  // Define fields for each method
  const fields = {
    'getPassenger': ['id'],
    'setPassenger': ['id', 'routeId', 'address', 'destinationDescription', 'destinationPlace', 'distanceToAddress', 'serviceUsage', 'stopAddress'],
    'deletePassenger': ['id'],
    'getAllPassengers': [],
    'getAllRoutes': [],
    'getRoute': ['id'],
    'setRoute': ['id', 'name', 'startDate', 'endDate', 'startKm', 'endKm', 'fuelConsumption', 'vehicleId'],
    'deleteRoute': ['id'],
    'getAllVehicles': [],
    'getVehicle': ['id'],
    'setVehicle': ['id', 'plate', 'capacity', 'vehicleManager'],
    'deleteVehicle': ['id'],
    'assignVehicleToRoute': ['routeId', 'vehicleId'],
  };

  const currentFields = fields[selectedMethod] || [];

  currentFields.forEach(field => {
    let type = 'text'; // Default input type
    let label = '';
    let id = `${selectedMethod}-${field}`;
    let placeholder = '';

    switch (field) {
      case 'id':
        label = 'ID (Zorunlu)';
        placeholder = 'Yolcu/Rota/Araç ID';
        break;
      case 'routeId':
        label = 'Rota ID';
        placeholder = 'Rota ID';
        break;
      case 'address':
        label = 'Adres';
        placeholder = 'Yolcu Adresi';
        break;
      case 'destinationDescription':
        label = 'Varış Açıklaması';
        placeholder = 'Varış Noktası Açıklaması';
        break;
      case 'destinationPlace':
        label = 'Varış Yeri';
        placeholder = 'Varış Yeri (Konum)';
        break;
      case 'distanceToAddress':
        label = 'Adrese Uzaklık';
        placeholder = 'İkametgah adresine uzaklık';
        type = 'number';
        break;
      case 'serviceUsage':
        label = 'Servis Kullanımı';
        placeholder = 'Servis kullanım bilgisi';
        break;
      case 'stopAddress':
        label = 'Biniş Adresi';
        placeholder = 'Servise biniş adresi';
        break;
      case 'name':
        label = 'Rota Adı';
        placeholder = 'Rota Adı';
        break;
      case 'startDate':
      case 'endDate':
        label = field === 'startDate' ? 'Başlangıç Tarihi' : 'Bitiş Tarihi';
        type = 'date';
        break;
      case 'startKm':
      case 'endKm':
        label = field === 'startKm' ? 'Başlangıç KM' : 'Bitiş KM';
        type = 'number';
        break;
      case 'fuelConsumption':
        label = 'Yakıt Tüketimi';
        type = 'number';
        break;
      case 'vehicleId':
        label = 'Araç ID';
        placeholder = 'Araç ID';
        break;
      case 'plate':
        label = 'Plaka';
        placeholder = 'Araç Plakası';
        break;
      case 'capacity':
        label = 'Kapasite';
        type = 'number';
        break;
      case 'vehicleManager':
        label = 'Araç Yöneticisi';
        placeholder = 'Araç Yöneticisi Adı';
        break;
    }

    const inputHtml = `
      <div class="mb-4">
        <label for="${id}" class="block text-sm font-medium text-gray-700">${label}</label>
        <input type="${type}" id="${id}" name="${field}"
               class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3
                      focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
               placeholder="${placeholder}">
      </div>
    `;
    formFieldsContainer.insertAdjacentHTML('beforeend', inputHtml);
  });
}

async function makeApiCall(method) {
  switch (method) {
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

      if (!id2) throw new Error('Yolcu ID gerekli');
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
      if (!id3) throw new Error('Yolcu ID gerekli');
      return await api.deletePassenger(id3);

    case 'getAllPassengers':
      return await api.getAllPassengers();

    case 'getAllRoutes':
      return await api.getAllRoutes();

    case 'getRoute':
      const id4 = getInputValue('getRoute-id');
      if (!id4) throw new Error('Rota ID gerekli');
      return await api.getRoute(id4);

    case 'setRoute':
      const id5 = getInputValue('setRoute-id');
      const name = getInputValue('setRoute-name');
      const startDate = getInputValue('setRoute-startDate');
      const endDate = getInputValue('setRoute-endDate');
      const startKm = getInputValue('setRoute-startKm');
      const endKm = getInputValue('setRoute-endKm');
      const fuelConsumption = getInputValue('setRoute-fuelConsumption');
      const vehicleId = getInputValue('setRoute-vehicleId');

      if (!id5) throw new Error('Rota ID gerekli');
      return await api.setRoute(id5, {
        NAME: name,
        START_DATE: startDate,
        END_DATE: endDate,
        START_KM: startKm,
        END_KM: endKm,
        FUEL_CONSUMPTION: fuelConsumption,
        VEHICLE_ID: vehicleId
      });

    case 'deleteRoute':
      const id6 = getInputValue('deleteRoute-id');
      if (!id6) throw new Error('Rota ID gerekli');
      return await api.deleteRoute(id6);

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

export async function initApiTest() {
  console.log("🚀 initApiTest called...");
  
  await ensureFirebaseInitialized();
  console.log("🔥 Firebase başlatıldı");
  
  methodSelectElement = document.getElementById('api-method');
  apiFormElement = document.querySelector('.api-test-form');

  if (!apiFormElement) {
    console.warn("API form (.api-test-form) not found on this page. This page might not function as expected if it relies on this form.");
    return;
  }

  // Set up the form handler (re-attach if necessary)
  currentFormHandler = handleApiCall;
  apiFormElement.addEventListener('submit', currentFormHandler);
  console.log("📝 API Form handler kuruldu");

  if (methodSelectElement) {
    // Initial update based on selected method
    updateFormInputs(methodSelectElement.value);

    // Add change listener to update form fields dynamically
    methodSelectElement.addEventListener('change', (e) => updateFormInputs(e.target.value));
    console.log("⚙️ API Method select listener kuruldu");
  } else {
    console.error("❌ API Method select element not found.");
  }
  
  console.log("✅ api-test.js initialization complete");
}

export function cleanupApiTest() {
  console.log("🧹 cleanupApiTest called...");
  if (apiFormElement && currentFormHandler) {
    apiFormElement.removeEventListener('submit', currentFormHandler);
    apiFormElement = null;
    currentFormHandler = null;
    console.log("📝 API Form handler kaldırıldı");
  }
  if (methodSelectElement) {
    methodSelectElement.removeEventListener('change', (e) => updateFormInputs(e.target.value)); // Needs to be the exact same function reference
    methodSelectElement = null;
    console.log("⚙️ API Method select listener kaldırıldı");
  }
  isFirebaseInitialized = false; // Reset Firebase flag if needed for re-init on subsequent page load
  console.log("✅ api-test.js cleanup complete");
}