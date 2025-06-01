import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let currentFormHandler = null;

// Initialize Firebase once
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

// Main setup function that can be called multiple times safely
export async function setupApiTestPage() {
  try {
    await ensureFirebaseInitialized();
    await new Promise(resolve => setTimeout(resolve, 100)); // DOM ready

    // --- START: Passenger List Page Detection ---
    const passengerListContainer = document.getElementById('passengers-list-container');
    if (passengerListContainer) {
      // We are on passengers-list.html, initialize its specific logic
      console.log("Passenger list page detected. Initializing...");
      await initializePassengerListPageLogic(api); // Pass the imported 'api' module
      return; // Important: Stop further execution of form-specific logic for this page
    }
    // --- END: Passenger List Page Detection ---

    // Original logic for form-based pages (api-test.html, add-passenger.html)
    const methodSelect = document.getElementById('api-method');
    const resultDiv = document.getElementById('result');
    const apiForm = document.querySelector('.api-test-form');

    if (!apiForm) {
      // This warning will now only appear if the page is not passengers-list.html 
      // AND is expected to have a form but doesn't.
      // The problematic retry loop "setTimeout(() => setupApiTestPage(), 200);" has been removed.
      console.warn("API form (.api-test-form) not found on this page. This page might not function as expected if it relies on this form.");
      return;
    }

    // Remove existing event listener if any for the form
    if (currentFormHandler) {
      apiForm.removeEventListener('submit', currentFormHandler);
    }

    // Create new form handler
    currentFormHandler = async (event) => {
      event.preventDefault();
      let selectedMethod = 'setPassenger';
      
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
        const result = await handleApiMethod(selectedMethod); // handleApiMethod should use the 'api' module directly
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

// Handle different API methods
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

// Helper function to safely get input values
function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : '';
}

// Format results for display
function formatResult(result) {
  if (result === undefined) return "İşlem başarılı (dönen veri yok)";
  if (typeof result === 'boolean') return result ? "İşlem başarılı" : "İşlem başarısız";
  if (result === null) return "Sonuç bulunamadı";
  if (typeof result === 'object') return JSON.stringify(result, null, 2);
  return result.toString();
}

let allPassengersData = [];
let currentSortCriteria = 'name'; // Default sort: 'name' or 'route'

function displayPassengerListError(message) {
    const loadingIndicator = document.getElementById('loading-indicator');
    const listContainer = document.getElementById('passengers-list-container');
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const errorMessageContainer = document.getElementById('error-message');
    const errorTextElement = document.getElementById('error-text');

    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (listContainer) listContainer.innerHTML = '';
    if (noPassengersMessage) noPassengersMessage.style.display = 'none';
    
    if (errorMessageContainer && errorTextElement) {
        errorTextElement.textContent = `Error: ${message}. Please check the console for more details.`;
        errorMessageContainer.classList.remove('hidden');
    } else {
        console.error("Error display elements not found for passenger list:", message);
    }
}

function renderPassengersList() {
    const listContainer = document.getElementById('passengers-list-container');
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageContainer = document.getElementById('error-message');


    if (!listContainer || !noPassengersMessage || !loadingIndicator || !errorMessageContainer) {
        console.error("One or more passenger list display elements are missing.");
        return;
    }

    listContainer.innerHTML = ''; 

    if (allPassengersData.length === 0) {
        noPassengersMessage.style.display = 'block';
        loadingIndicator.style.display = 'none';
        errorMessageContainer.classList.add('hidden');
        return;
    }
    
    noPassengersMessage.style.display = 'none';
    errorMessageContainer.classList.add('hidden');

    let sortedPassengers = [...allPassengersData];
    if (currentSortCriteria === 'name') {
        sortedPassengers.sort((a, b) => a.id.localeCompare(b.id));
    } else if (currentSortCriteria === 'route') {
        sortedPassengers.sort((a, b) => {
            const routeA = a.data.ROUTE || ''; 
            const routeB = b.data.ROUTE || '';
            return routeA.localeCompare(routeB);
        });
    }

    sortedPassengers.forEach(passenger => {
        const card = document.createElement('div');
        card.className = 'passenger-card'; // Uses style from passengers-list.html
        
        card.innerHTML = `
            <h3 class="text-xl font-semibold text-indigo-700 mb-2 capitalize">${passenger.id.replace(/_/g, ' ')}</h3>
            <p class="text-sm text-gray-600 mb-1"><strong>Route:</strong> ${passenger.data.ROUTE || 'N/A'}</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Address:</strong> ${passenger.data.ADDRESS || 'N/A'}</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Destination:</strong> ${passenger.data.DESTINATION_PLACE || 'N/A'}</p>
            <p class="text-sm text-gray-600"><strong>Stop Address:</strong> ${passenger.data.STOP_ADDRESS || 'N/A'}</p>
        `;
        listContainer.appendChild(card);
    });
    loadingIndicator.style.display = 'none';
}

async function initializePassengerListPageLogic(apiModule) {
    const loadingIndicator = document.getElementById('loading-indicator');
    const listContainer = document.getElementById('passengers-list-container');
    const errorMessageContainer = document.getElementById('error-message');
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const sortByNameButton = document.getElementById('sortByNameBtn'); // Ensure ID matches HTML
    const sortByRouteButton = document.getElementById('sortByRouteBtn'); // Ensure ID matches HTML

    if (!listContainer || !loadingIndicator || !errorMessageContainer || !noPassengersMessage || !sortByNameButton || !sortByRouteButton) {
        console.error("Essential elements for passenger list page are missing. Cannot initialize.");
        if(loadingIndicator) loadingIndicator.style.display = 'none';
        // Optionally display an error in a known fallback element if others are missing
        return;
    }
    
    loadingIndicator.style.display = 'block';
    errorMessageContainer.classList.add('hidden');
    noPassengersMessage.style.display = 'none';
    listContainer.innerHTML = '';

    try {
        // Firebase should already be initialized by ensureFirebaseInitialized() in setupApiTestPage
        const passengersObject = await apiModule.getAllPassengers();
        
        allPassengersData = Object.entries(passengersObject).map(([id, data]) => ({
            id: id,
            data: data 
        }));

        renderPassengersList();

    } catch (error) {
        console.error("Failed to load passengers:", error);
        displayPassengerListError(error.message || "Could not fetch passenger data.");
    }

    sortByNameButton.addEventListener('click', () => {
        currentSortCriteria = 'name';
        renderPassengersList();
    });

    sortByRouteButton.addEventListener('click', () => {
        currentSortCriteria = 'route';
        renderPassengersList();
    });
}