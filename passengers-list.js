import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

let isFirebaseInitialized = false;
let allPassengersData = [];
let currentSortCriteria = 'name'; // Default sort: 'name' or 'route'
let selectedPassengers = new Set(); // Track selected passenger IDs
let currentView = 'card'; // 'card' or 'table'

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
    const tableContainer = document.getElementById('passengers-table-container');
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const errorMessageContainer = document.getElementById('error-message');
    const errorTextElement = document.getElementById('error-text');

    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (listContainer) listContainer.innerHTML = '';
    if (tableContainer) tableContainer.style.display = 'none';
    if (noPassengersMessage) noPassengersMessage.style.display = 'none';
    
    if (errorMessageContainer && errorTextElement) {
        errorTextElement.textContent = `Error: ${message}. Please check the console for more details.`;
        errorMessageContainer.classList.remove('hidden');
    } else {
        console.error("Error display elements not found for passenger list:", message);
    }
}

function updateSelectionCounter() {
    const counter = document.getElementById('selectionCounter');
    const sendToMapBtn = document.getElementById('sendToMapBtn');
    
    if (counter) {
        if (selectedPassengers.size > 0) {
            counter.textContent = `${selectedPassengers.size} selected`;
            counter.classList.remove('hidden');
        } else {
            counter.classList.add('hidden');
        }
    }
    
    if (sendToMapBtn) {
        sendToMapBtn.disabled = selectedPassengers.size === 0;
    }
}

function togglePassengerSelection(passengerId, isSelected) {
    if (isSelected) {
        selectedPassengers.add(passengerId);
    } else {
        selectedPassengers.delete(passengerId);
    }
    updateSelectionCounter();
    
    // Update visual selection in both views
    updateSelectionVisuals();
}

function updateSelectionVisuals() {
    // Update card view selections
    const cardCheckboxes = document.querySelectorAll('.passenger-card input[type="checkbox"]');
    cardCheckboxes.forEach(checkbox => {
        const passengerId = checkbox.dataset.passengerId;
        checkbox.checked = selectedPassengers.has(passengerId);
        
        const card = checkbox.closest('.passenger-card');
        if (selectedPassengers.has(passengerId)) {
            card.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
        } else {
            card.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
        }
    });
    
    // Update table view selections
    const tableCheckboxes = document.querySelectorAll('#passengers-table-body input[type="checkbox"]');
    tableCheckboxes.forEach(checkbox => {
        const passengerId = checkbox.dataset.passengerId;
        checkbox.checked = selectedPassengers.has(passengerId);
        
        const row = checkbox.closest('tr');
        if (selectedPassengers.has(passengerId)) {
            row.classList.add('selected');
        } else {
            row.classList.remove('selected');
        }
    });
    
    // Update select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = selectedPassengers.size === allPassengersData.length && allPassengersData.length > 0;
        selectAllCheckbox.indeterminate = selectedPassengers.size > 0 && selectedPassengers.size < allPassengersData.length;
    }
}

function selectAllPassengers() {
    selectedPassengers.clear();
    allPassengersData.forEach(passenger => {
        selectedPassengers.add(passenger.id);
    });
    updateSelectionCounter();
    updateSelectionVisuals();
}

function clearAllSelections() {
    selectedPassengers.clear();
    updateSelectionCounter();
    updateSelectionVisuals();
}

function switchView(newView) {
    currentView = newView;
    const cardContainer = document.getElementById('passengers-list-container');
    const tableContainer = document.getElementById('passengers-table-container');
    const cardViewBtn = document.getElementById('cardViewBtn');
    const tableViewBtn = document.getElementById('tableViewBtn');
    
    if (newView === 'card') {
        cardContainer.style.display = 'grid';
        tableContainer.style.display = 'none';
        cardViewBtn.classList.add('active');
        tableViewBtn.classList.remove('active');
    } else {
        cardContainer.style.display = 'none';
        tableContainer.style.display = 'block';
        tableViewBtn.classList.add('active');
        cardViewBtn.classList.remove('active');
    }
}

function renderPassengersCards() {
    const listContainer = document.getElementById('passengers-list-container');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

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
        card.className = 'passenger-card relative';
        
        const isSelected = selectedPassengers.has(passenger.id);
        if (isSelected) {
            card.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
        }
        
        card.innerHTML = `
            <div class="absolute top-3 right-3">
                <input type="checkbox" 
                       class="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                       data-passenger-id="${passenger.id}"
                       ${isSelected ? 'checked' : ''}>
            </div>
            <h3 class="text-xl font-semibold text-indigo-700 mb-2 capitalize pr-8">${passenger.id.replace(/_/g, ' ')}</h3>
            <p class="text-sm text-gray-600 mb-1"><strong>Route:</strong> ${passenger.data.ROUTE || 'N/A'}</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Address:</strong> ${passenger.data.ADDRESS || 'N/A'}</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Destination:</strong> ${passenger.data.DESTINATION_PLACE || 'N/A'}</p>
            <p class="text-sm text-gray-600"><strong>Stop Address:</strong> ${passenger.data.STOP_ADDRESS || 'N/A'}</p>
        `;
        
        // Add event listener for checkbox
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            togglePassengerSelection(passenger.id, e.target.checked);
        });
        
        listContainer.appendChild(card);
    });
}

function renderPassengersTable() {
    const tableBody = document.getElementById('passengers-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';

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
        const row = document.createElement('tr');
        const isSelected = selectedPassengers.has(passenger.id);
        
        if (isSelected) {
            row.classList.add('selected');
        }
        
        row.innerHTML = `
            <td class="text-center">
                <input type="checkbox" 
                       class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" 
                       data-passenger-id="${passenger.id}"
                       ${isSelected ? 'checked' : ''}>
            </td>
            <td class="font-medium text-gray-900 capitalize">${passenger.id.replace(/_/g, ' ')}</td>
            <td class="text-gray-700">${passenger.data.ROUTE || 'N/A'}</td>
            <td class="text-gray-700">${passenger.data.ADDRESS || 'N/A'}</td>
            <td class="text-gray-700">${passenger.data.DESTINATION_PLACE || 'N/A'}</td>
            <td class="text-gray-700">${passenger.data.STOP_ADDRESS || 'N/A'}</td>
        `;
        
        // Add event listener for checkbox
        const checkbox = row.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            togglePassengerSelection(passenger.id, e.target.checked);
        });
        
        tableBody.appendChild(row);
    });
}

function renderPassengersList() {
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessageContainer = document.getElementById('error-message');

    if (!noPassengersMessage || !loadingIndicator || !errorMessageContainer) {
        console.error("One or more passenger list display elements are missing.");
        return;
    }

    if (allPassengersData.length === 0) {
        noPassengersMessage.style.display = 'block';
        loadingIndicator.style.display = 'none';
        errorMessageContainer.classList.add('hidden');
        document.getElementById('passengers-list-container').style.display = 'none';
        document.getElementById('passengers-table-container').style.display = 'none';
        return;
    }
    
    noPassengersMessage.style.display = 'none';
    errorMessageContainer.classList.add('hidden');

    // Render both views
    renderPassengersCards();
    renderPassengersTable();
    
    // Show the appropriate view
    switchView(currentView);
    
    loadingIndicator.style.display = 'none';
}

// Function to send selected passengers to map
async function sendSelectedPassengersToMap() {
    const selectedPassengerData = allPassengersData.filter(passenger => 
        selectedPassengers.has(passenger.id)
    );
    
    if (selectedPassengerData.length === 0) {
        alert('Please select at least one passenger to send to the map.');
        return;
    }
    
    console.log('Sending passengers to map:', selectedPassengerData);
    
    // Store in localStorage and redirect using the common loadPage function
    try {
        const passengerData = JSON.stringify(selectedPassengerData);
        localStorage.setItem('pendingPassengers', passengerData);
        
        if (confirm(`Selected ${selectedPassengerData.length} passengers. Would you like to go to the map page to add them?`)) {
            // Use the global loadPage function defined in index.html
            if (window.loadPage) {
                window.loadPage('map.html');
            } else {
                console.error("window.loadPage is not defined. Cannot navigate to map page.");
                alert("Error: Cannot navigate to map page. Missing navigation function.");
            }
        }
    } catch (error) {
        console.error('Error storing passenger data:', error);
        alert('An error occurred while preparing to send passengers to the map.');
    }
}

async function initializePassengerListPageLogic() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const listContainer = document.getElementById('passengers-list-container');
    const tableContainer = document.getElementById('passengers-table-container');
    const errorMessageContainer = document.getElementById('error-message');
    const noPassengersMessage = document.getElementById('no-passengers-message');
    const sortByNameButton = document.getElementById('sortByNameBtn');
    const sortByRouteButton = document.getElementById('sortByRouteBtn');
    const selectAllButton = document.getElementById('selectAllBtn');
    const clearSelectionButton = document.getElementById('clearSelectionBtn');
    const sendToMapButton = document.getElementById('sendToMapBtn');
    const cardViewButton = document.getElementById('cardViewBtn');
    const tableViewButton = document.getElementById('tableViewBtn');
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');

    if (!listContainer || !tableContainer || !loadingIndicator || !errorMessageContainer || !noPassengersMessage) {
        console.error("Essential elements for passenger list page are missing. Cannot initialize.");
        if(loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }
    
    loadingIndicator.style.display = 'block';
    errorMessageContainer.classList.add('hidden');
    noPassengersMessage.style.display = 'none';
    listContainer.innerHTML = '';
    tableContainer.style.display = 'none';

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

    // Event listeners for sorting
    if (sortByNameButton) {
        sortByNameButton.addEventListener('click', () => {
            currentSortCriteria = 'name';
            renderPassengersList();
        });
    }

    if (sortByRouteButton) {
        sortByRouteButton.addEventListener('click', () => {
            currentSortCriteria = 'route';
            renderPassengersList();
        });
    }

    // Event listeners for selection
    if (selectAllButton) {
        selectAllButton.addEventListener('click', selectAllPassengers);
    }

    if (clearSelectionButton) {
        clearSelectionButton.addEventListener('click', clearAllSelections);
    }

    if (sendToMapButton) {
        sendToMapButton.addEventListener('click', sendSelectedPassengersToMap);
    }

    // Event listeners for view switching
    if (cardViewButton) {
        cardViewButton.addEventListener('click', () => switchView('card'));
    }

    if (tableViewButton) {
        tableViewButton.addEventListener('click', () => switchView('table'));
    }

    // Event listener for select all checkbox in table
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectAllPassengers();
            } else {
                clearAllSelections();
            }
        });
    }
}

// Directly execute the setup logic when the script is parsed
(async () => {
  await initializePassengerListPageLogic();
})();