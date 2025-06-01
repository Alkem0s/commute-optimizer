import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let allPassengersData = [];
let currentSortCriteria = 'name'; // Default sort: 'name' or 'route'

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

async function initializePassengerListPageLogic() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const listContainer = document.getElementById('passengers-list-container');
    const errorMessageContainer = document.getElementById('error-message');
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const sortByNameButton = document.getElementById('sortByNameBtn');
    const sortByRouteButton = document.getElementById('sortByRouteBtn');

    if (!listContainer || !loadingIndicator || !errorMessageContainer || !noPassengersMessage || !sortByNameButton || !sortByRouteButton) {
        console.error("Essential elements for passenger list page are missing. Cannot initialize.");
        if(loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }
    
    loadingIndicator.style.display = 'block';
    errorMessageContainer.classList.add('hidden');
    noPassengersMessage.style.display = 'none';
    listContainer.innerHTML = '';

    try {
        await ensureFirebaseInitialized();
        const passengersObject = await api.getAllPassengers();
        
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

// Directly execute the setup logic when the script is parsed
(async () => {
  await initializePassengerListPageLogic();
})();