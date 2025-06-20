import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

// Cache for the xlsx library
let xlsxLib = null;

// Define column mapping
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

// State variables
let allPassengersData = [];
let filteredPassengersData = [];
let currentSortCriteria = 'name';
let selectedPassengers = new Set();
let isFirebaseInitialized = false;

// DOM element references and handlers for cleanup
let refreshListButton = null;
let exportExcelButton = null;
let filterInput = null;
let searchButton = null;
let sortByNameButton = null;
let sortByRouteButton = null;
let selectAllButton = null;
let clearSelectionButton = null;
let sendToMapButton = null;
let tableViewButton = null;
let selectAllCheckbox = null;
let handleFilterInput = null;

// Modal elements
let editPassengerModal = null;
let closeEditModalBtn = null;
let editPassengerForm = null;
let savePassengerBtn = null;
let cancelEditBtn = null;
let editPassengerIdInput = null;
let editRouteInput = null;
let editAddressInput = null;
let editDestinationDescriptionInput = null;
let editDestinationPlaceInput = null;
let editDistanceToAddressInput = null;
let editServiceUsageInput = null;
let editStopAddressInput = null;

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

// Add this function to generate Excel file
async function exportToExcel() {
  try {
    // Load library if needed
    if (!xlsxLib) {
      xlsxLib = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');
    }

    // Create headers in Turkish
    const headers = Object.keys(EXCEL_COLUMN_MAPPING);
    
    // Prepare data array
    const data = [headers];
    
    // Add passenger data
    allPassengersData.forEach(passenger => {
      const row = [];
      
      // Map each column based on our mapping
      Object.values(EXCEL_COLUMN_MAPPING).forEach(key => {
        let value = '';
        
        if (key === 'id') {
          value = passenger.id;
        } else {
          value = passenger.data[key] || '';
        }
        
        row.push(value);
      });
      
      data.push(row);
    });

    // Create worksheet
    const ws = xlsxLib.utils.aoa_to_sheet(data);
    
    // Create workbook
    const wb = xlsxLib.utils.book_new();
    xlsxLib.utils.book_append_sheet(wb, ws, "Yolcular");
    
    // Generate and download file
    xlsxLib.writeFile(wb, "yolcular.xlsx");
    
  } catch (error) {
    console.error('Excel export error:', error);
    alert('Excel dışa aktarımı sırasında bir hata oluştu: ' + error.message);
  }
}

function displayPassengerListError(message) {
  const loadingIndicator = document.getElementById('loading-indicator');
  const tableContainer = document.getElementById('passengers-table-container');
  const noPassengersMessage = document.getElementById('no-passengers-message');
  const errorMessageContainer = document.getElementById('error-message');
  const errorTextElement = document.getElementById('error-text');

  if (loadingIndicator) loadingIndicator.style.display = 'none';
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
  
  // Update visual selection in table view
  updateSelectionVisuals();
}

function updateSelectionVisuals() {
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
    selectAllCheckbox.checked = selectedPassengers.size === filteredPassengersData.length && filteredPassengersData.length > 0;
    selectAllCheckbox.indeterminate = selectedPassengers.size > 0 && selectedPassengers.size < filteredPassengersData.length;
  }
}

function selectAllPassengers() {
  filteredPassengersData.forEach(passenger => {
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

function filterPassengers() {
  const filterValue = filterInput ? filterInput.value.toLowerCase() : '';
  if (filterValue) {
    filteredPassengersData = allPassengersData.filter(p => 
      (p.id && p.id.toLowerCase().includes(filterValue)) ||
      (p.data.ROUTE && p.data.ROUTE.toLowerCase().includes(filterValue)) ||
      (p.data.ADDRESS && p.data.ADDRESS.toLowerCase().includes(filterValue)) ||
      (p.data.DESTINATION_DESCRIPTION && p.data.DESTINATION_DESCRIPTION.toLowerCase().includes(filterValue)) ||
      (p.data.DESTINATION_PLACE && p.data.DESTINATION_PLACE.toLowerCase().includes(filterValue)) ||
      (p.data.STOP_ADDRESS && p.data.STOP_ADDRESS.toLowerCase().includes(filterValue))
    );
  } else {
    filteredPassengersData = [...allPassengersData];
  }
  renderPassengersList();
}

function sortPassengers() {
  switch (currentSortCriteria) {
    case 'name':
      filteredPassengersData.sort((a, b) => a.id.localeCompare(b.id));
      break;
    case 'route':
      filteredPassengersData.sort((a, b) => {
        const routeA = a.data.ROUTE || ''; 
        const routeB = b.data.ROUTE || '';
        return routeA.localeCompare(routeB);
      });
      break;
  }
}

function renderPassengersTable() {
  const tableBody = document.getElementById('passengers-table-body');
  if (!tableBody) return;
  
  tableBody.innerHTML = '';

  sortPassengers();

  filteredPassengersData.forEach(passenger => {
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
      <td class="text-center">
          <button class="btn-action btn-edit" data-passenger-id="${passenger.id}">Düzenle</button>
          <button class="btn-action btn-delete" data-passenger-id="${passenger.id}">Sil</button>
      </td>
    `;
    
    // Add event listener for checkbox
    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      togglePassengerSelection(passenger.id, e.target.checked);
    });

    // Add event listeners for edit and delete buttons
    const editButton = row.querySelector('.btn-edit');
    editButton.addEventListener('click', () => openEditModal(passenger.id));

    const deleteButton = row.querySelector('.btn-delete');
    deleteButton.addEventListener('click', () => deletePassenger(passenger.id));
    
    tableBody.appendChild(row);
  });
}

function renderPassengersList() {
  const noPassengersMessage = document.getElementById('no-passengers-message');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessageContainer = document.getElementById('error-message');
  const tableContainer = document.getElementById('passengers-table-container');

  if (!tableContainer || !loadingIndicator || !errorMessageContainer || !noPassengersMessage) {
    console.error("One or more passenger list display elements are missing.");
    return;
  }

  if (filteredPassengersData.length === 0) {
    noPassengersMessage.style.display = 'block';
    loadingIndicator.style.display = 'none';
    errorMessageContainer.classList.add('hidden');
    tableContainer.style.display = 'none';
    return;
  }
  
  noPassengersMessage.style.display = 'none';
  errorMessageContainer.classList.add('hidden');

  // Render the table view
  renderPassengersTable();
  
  // Always show the table view
  tableContainer.style.display = 'block';
  
  loadingIndicator.style.display = 'none';
  updateSelectionVisuals();
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
    
    if (confirm(`Seçili ${selectedPassengerData.length} yolcu var. Bunları eklemek için harita sayfasına gitmek ister misiniz?`)) {
      // Use the global loadPage function defined in index.html
      if (window.appRouter) {
        window.appRouter.loadPage('map');
      } else {
        console.error("window.appRouter.loadPage is not defined. Cannot navigate to map page.");
        alert("Error: Cannot navigate to map page. Missing navigation function.");
      }
    }
  } catch (error) {
    console.error('Error storing passenger data:', error);
    alert('An error occurred while preparing to send passengers to the map.');
  }
}

async function fetchAndRenderPassengers() {
  const loadingIndicator = document.getElementById('loading-indicator');
  const tableContainer = document.getElementById('passengers-table-container');
  const errorMessageContainer = document.getElementById('error-message');
  const noPassengersMessage = document.getElementById('no-passengers-message');

  if (!tableContainer || !loadingIndicator || !errorMessageContainer || !noPassengersMessage) {
    console.error("Essential elements for passenger list page are missing. Cannot initialize.");
    if(loadingIndicator) loadingIndicator.style.display = 'none';
    return;
  }
  
  loadingIndicator.style.display = 'block';
  errorMessageContainer.classList.add('hidden');
  noPassengersMessage.style.display = 'none';
  tableContainer.style.display = 'none'; // Hide table initially

  try {
    await ensureFirebaseInitialized();
    const passengersObject = await api.getAllPassengers();
    
    allPassengersData = Object.entries(passengersObject).map(([id, data]) => ({
      id: id,
      data: data 
    }));
    
    // Apply current filter to the new data
    filterPassengers();
    renderPassengersList();

  } catch (error) {
    console.error("Failed to load passengers:", error);
    displayPassengerListError(error.message || "Could not fetch passenger data.");
  }
}

// Function to open the edit modal and populate it with passenger data
async function openEditModal(passengerId) {
  const passenger = allPassengersData.find(p => p.id === passengerId);
  if (!passenger) {
    alert('Passenger not found!');
    return;
  }

  editPassengerIdInput.value = passenger.id.replace(/_/g, ' ');
  editRouteInput.value = passenger.data.ROUTE || '';
  editAddressInput.value = passenger.data.ADDRESS || '';
  editDestinationDescriptionInput.value = passenger.data.DESTINATION_DESCRIPTION || '';
  editDestinationPlaceInput.value = passenger.data.DESTINATION_PLACE || '';
  editDistanceToAddressInput.value = passenger.data.DISTANCE_TO_ADDRESS || '';
  editServiceUsageInput.value = passenger.data.SERVICE_USAGE || '';
  editStopAddressInput.value = passenger.data.STOP_ADDRESS || '';

  editPassengerModal.classList.remove('hidden');
}

// Function to close the edit modal
function closeEditModal() {
  editPassengerModal.classList.add('hidden');
  editPassengerForm.reset();
}

// Function to handle saving passenger edits
async function savePassenger(event) {
  event.preventDefault();

  const passengerId = editPassengerIdInput.value.toLowerCase().replace(/ /g, '_'); // Convert back to ID format
  const updatedPassengerData = {
    ROUTE: editRouteInput.value,
    ADDRESS: editAddressInput.value,
    DESTINATION_DESCRIPTION: editDestinationDescriptionInput.value,
    DESTINATION_PLACE: editDestinationPlaceInput.value,
    DISTANCE_TO_ADDRESS: editDistanceToAddressInput.value,
    SERVICE_USAGE: editServiceUsageInput.value,
    STOP_ADDRESS: editStopAddressInput.value
  };

  try {
    await api.setPassenger(passengerId, updatedPassengerData);
    alert('Passenger updated successfully!');
    closeEditModal();
    await fetchAndRenderPassengers(); // Refresh the list
  } catch (error) {
    console.error('Error saving passenger:', error);
    alert('Error saving passenger: ' + error.message);
  }
}

// Function to handle deleting a passenger
async function deletePassenger(passengerId) {
  if (confirm(`Are you sure you want to delete passenger "${passengerId.replace(/_/g, ' ')}"?`)) {
    try {
      await api.deletePassenger(passengerId);
      alert('Passenger deleted successfully!');
      await fetchAndRenderPassengers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting passenger:', error);
      alert('Error deleting passenger: ' + error.message);
    }
  }
}


export async function initPassengersList() {
  console.log("🚀 initPassengersList called...");

  // Get DOM elements
  refreshListButton = document.getElementById('refreshListButton'); // This button does not exist in the HTML, commenting out.
  exportExcelButton = document.getElementById('exportExcelBtn');
  filterInput = document.getElementById('filterInput');
  searchButton = document.getElementById('searchButton'); // This button does not exist in the HTML, commenting out.
  sortByNameButton = document.getElementById('sortByNameBtn');
  sortByRouteButton = document.getElementById('sortByRouteBtn');
  selectAllButton = document.getElementById('selectAllBtn');
  clearSelectionButton = document.getElementById('clearSelectionBtn');
  sendToMapButton = document.getElementById('sendToMapBtn');
  tableViewButton = document.getElementById('tableViewBtn'); // This button does not exist in the HTML, commenting out.
  selectAllCheckbox = document.getElementById('selectAllCheckbox');

  // Modal elements
  editPassengerModal = document.getElementById('editPassengerModal');
  closeEditModalBtn = document.getElementById('closeEditModalBtn');
  editPassengerForm = document.getElementById('editPassengerForm');
  savePassengerBtn = document.getElementById('savePassengerBtn');
  cancelEditBtn = document.getElementById('cancelEditBtn');
  editPassengerIdInput = document.getElementById('editPassengerId');
  editRouteInput = document.getElementById('editRoute');
  editAddressInput = document.getElementById('editAddress');
  editDestinationDescriptionInput = document.getElementById('editDestinationDescription');
  editDestinationPlaceInput = document.getElementById('editDestinationPlace');
  editDistanceToAddressInput = document.getElementById('editDistanceToAddress');
  editServiceUsageInput = document.getElementById('editServiceUsage');
  editStopAddressInput = document.getElementById('editStopAddress');


  // Attach event listeners
  // if (refreshListButton) {
  //   refreshListButton.addEventListener('click', fetchAndRenderPassengers);
  // }
  if (exportExcelButton) {
    exportExcelButton.addEventListener('click', exportToExcel);
  }

  if (filterInput) {
    handleFilterInput = () => filterPassengers();
    filterInput.addEventListener('input', handleFilterInput);
  }
  // if (searchButton) {
  //   searchButton.addEventListener('click', () => filterPassengers());
  // }

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

  if (selectAllButton) {
    selectAllButton.addEventListener('click', selectAllPassengers);
  }
  if (clearSelectionButton) {
    clearSelectionButton.addEventListener('click', clearAllSelections);
  }
  if (sendToMapButton) {
    sendToMapButton.addEventListener('click', sendSelectedPassengersToMap);
  }

  // Ensure table view is always active and doesn't need a click
  // if (tableViewButton) {
  //   tableViewButton.classList.add('active');
  //   // No need for a click listener on tableViewButton as it's the only view
  // }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectAllPassengers();
      } else {
        clearAllSelections();
      }
    });
  }

  // Modal event listeners
  if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', closeEditModal);
  }
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', closeEditModal);
  }
  if (editPassengerForm) {
    editPassengerForm.addEventListener('submit', savePassenger);
  }

  // Initial fetch and render
  await fetchAndRenderPassengers();
  console.log("✅ initPassengersList initialization complete");
}

export function cleanupPassengersList() {
  console.log("🧹 cleanupPassengersList called...");

  // Remove event listeners
  // if (refreshListButton) {
  //   refreshListButton.removeEventListener('click', fetchAndRenderPassengers);
  //   refreshListButton = null;
  // }
  if (exportExcelButton) {
    exportExcelButton.removeEventListener('click', exportToExcel);
    exportExcelButton = null;
  }
  if (filterInput && handleFilterInput) {
    filterInput.removeEventListener('input', handleFilterInput);
    filterInput = null;
    handleFilterInput = null;
  }
  // if (searchButton) {
  //   searchButton.removeEventListener('click', () => filterPassengers());
  //   searchButton = null;
  // }
  if (sortByNameButton) {
    sortByNameButton.removeEventListener('click', () => {
      currentSortCriteria = 'name';
      renderPassengersList();
    });
    sortByNameButton = null;
  }
  if (sortByRouteButton) {
    sortByRouteButton.removeEventListener('click', () => {
      currentSortCriteria = 'route';
      renderPassengersList();
    });
    sortByRouteButton = null;
  }
  if (selectAllButton) {
    selectAllButton.removeEventListener('click', selectAllPassengers);
    selectAllButton = null;
  }
  if (clearSelectionButton) {
    clearSelectionButton.removeEventListener('click', clearAllSelections);
    clearSelectionButton = null;
  }
  if (sendToMapButton) {
    sendToMapButton.removeEventListener('click', sendSelectedPassengersToMap);
    sendToMapButton = null;
  }
  // if (tableViewButton) {
  //   // No need to remove listener as it wasn't added
  //   tableViewButton = null;
  // }
  if (selectAllCheckbox) {
    selectAllCheckbox.removeEventListener('change', (e) => {
      if (e.target.checked) {
        selectAllPassengers();
      } else {
        clearAllSelections();
      }
    });
    selectAllCheckbox = null;
  }

  // Modal event listeners cleanup
  if (closeEditModalBtn) {
    closeEditModalBtn.removeEventListener('click', closeEditModal);
    closeEditModalBtn = null;
  }
  if (cancelEditBtn) {
    cancelEditBtn.removeEventListener('click', closeEditModal);
    cancelEditBtn = null;
  }
  if (editPassengerForm) {
    editPassengerForm.removeEventListener('submit', savePassenger);
    editPassengerForm = null;
    savePassengerBtn = null; // Also clear these since they are part of the form
    editPassengerIdInput = null;
    editRouteInput = null;
    editAddressInput = null;
    editDestinationDescriptionInput = null;
    editDestinationPlaceInput = null;
    editDistanceToAddressInput = null;
    editServiceUsageInput = null;
    editStopAddressInput = null;
  }
  editPassengerModal = null; // Clear modal reference

  // Clear data and reset state
  allPassengersData = [];
  filteredPassengersData = [];
  selectedPassengers.clear();
  isFirebaseInitialized = false;
  xlsxLib = null;

  // Clear content containers
  const tableBody = document.getElementById('passengers-table-body');
  if (tableBody) tableBody.innerHTML = '';

  console.log("✅ cleanupPassengersList complete");
}