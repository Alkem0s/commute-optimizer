// api_test.js
import { initializeFirebase } from './firebase.js';
import * as api from './api.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase when the page loads
    initializeFirebase().catch(error => {
        console.error("Failed to initialize Firebase:", error);
        alert("Firebase initialization failed. Check the console for details.");
    });

    const methodSelect = document.getElementById('api-method');
    const resultDiv = document.getElementById('result');
    const apiForm = document.querySelector('.api-test-form');

    // Show/hide appropriate form fields based on selected method
    methodSelect.addEventListener('change', function() {
        // Hide all form fields first
        const allFields = document.querySelectorAll('.form-fields');
        allFields.forEach(field => field.style.display = 'none');

        // Show the fields for the selected method
        const selectedMethod = methodSelect.value;
        if (selectedMethod) {
            const fieldsToShow = document.getElementById(`${selectedMethod}-fields`);
            if (fieldsToShow) {
                fieldsToShow.style.display = 'block';
            }
        }
    });

    // Handle form submission
    apiForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent form submission
        
        const selectedMethod = methodSelect.value;
        if (!selectedMethod) {
            alert('Lütfen bir API metodu seçin.');
            return;
        }

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = 'İşlem yapılıyor...';

        try {
            let result;
            switch (selectedMethod) {
                // Passenger operations
                case 'getAllPassengers':
                    result = await api.getAllPassengers();
                    break;
                case 'getPassenger':
                    const passengerId = document.getElementById('getPassenger-id').value;
                    if (!passengerId) {
                        throw new Error('Yolcu ID boş olamaz');
                    }
                    result = await api.getPassenger(passengerId);
                    break;
                case 'setPassenger':
                    const newPassengerId = document.getElementById('setPassenger-id').value;
                    const routeId = document.getElementById('setPassenger-routeId').value;
                    const address = document.getElementById('setPassenger-address').value;
                    if (!newPassengerId) {
                        throw new Error('Yolcu ID boş olamaz');
                    }
                    result = await api.setPassenger(newPassengerId, [routeId, address]);
                    break;
                case 'deletePassenger':
                    const delPassengerId = document.getElementById('deletePassenger-id').value;
                    if (!delPassengerId) {
                        throw new Error('Silinecek yolcu ID boş olamaz');
                    }
                    result = await api.deletePassenger(delPassengerId);
                    break;
                case 'searchPassengers':
                    const searchTerm = document.getElementById('searchPassengers-term').value;
                    if (!searchTerm) {
                        throw new Error('Arama terimi boş olamaz');
                    }
                    result = await api.searchPassengers(searchTerm);
                    break;

                // Route operations
                case 'getAllRoutes':
                    result = await api.getAllRoutes();
                    break;
                case 'getRoute':
                    const getRouteId = document.getElementById('getRoute-id').value;
                    if (!getRouteId) {
                        throw new Error('Rota ID boş olamaz');
                    }
                    result = await api.getRoute(getRouteId);
                    break;
                case 'setRoute':
                    const newRouteId = document.getElementById('setRoute-id').value;
                    const vehicleId = document.getElementById('setRoute-vehicleId').value;
                    const lat = document.getElementById('setRoute-lat').value;
                    const long = document.getElementById('setRoute-long').value;
                    const passengerIdsInput = document.getElementById('setRoute-passengerIds').value;
                    
                    if (!newRouteId) {
                        throw new Error('Rota ID boş olamaz');
                    }
                    
                    const stops = [];
                    if (lat && long) {
                        stops.push({ LAT: lat, LONG: long });
                    }
                    
                    const passengerIds = [];
                    if (passengerIdsInput) {
                        passengerIdsInput.split(',').forEach(id => {
                            passengerIds.push(id.trim());
                        });
                    }
                    
                    const routeData = {
                        STOPS: stops,
                        VEHICLE_ID: vehicleId.toUpperCase(),
                        PASSENGER_IDS: passengerIds
                    };
                    result = await api.setRoute(newRouteId, routeData);
                    break;
                case 'deleteRoute':
                    const delRouteId = document.getElementById('deleteRoute-id').value;
                    if (!delRouteId) {
                        throw new Error('Silinecek rota ID boş olamaz');
                    }
                    result = await api.deleteRoute(delRouteId);
                    break;
                case 'addPassengerToRoute':
                    const routeForPassenger = document.getElementById('addPassengerToRoute-routeId').value;
                    const passengerForRoute = document.getElementById('addPassengerToRoute-passengerId').value;
                    if (!routeForPassenger || !passengerForRoute) {
                        throw new Error('Rota ID ve Yolcu ID boş olamaz');
                    }
                    result = await api.addPassengerToRoute(routeForPassenger, passengerForRoute);
                    break;
                case 'removePassengerFromRoute':
                    const routeForRemoval = document.getElementById('removePassengerFromRoute-routeId').value;
                    const passengerForRemoval = document.getElementById('removePassengerFromRoute-passengerId').value;
                    if (!routeForRemoval || !passengerForRemoval) {
                        throw new Error('Rota ID ve Yolcu ID boş olamaz');
                    }
                    result = await api.removePassengerFromRoute(routeForRemoval, passengerForRemoval);
                    break;

                // Vehicle operations
                case 'getAllVehicles':
                    result = await api.getAllVehicles();
                    break;
                case 'getVehicle':
                    const getVehicleId = document.getElementById('getVehicle-id').value;
                    if (!getVehicleId) {
                        throw new Error('Araç ID boş olamaz');
                    }
                    result = await api.getVehicle(getVehicleId);
                    break;
                case 'setVehicle':
                    const newVehicleId = document.getElementById('setVehicle-id').value;
                    const plate = document.getElementById('setVehicle-plate').value;
                    const capacity = document.getElementById('setVehicle-capacity').value;
                    
                    if (!newVehicleId) {
                        throw new Error('Araç ID boş olamaz');
                    }
                    
                    const vehicleData = {
                        PLATE: plate,
                        CAPACITY: capacity,
                        ASSIGNED_SEAT_COUNT: "0"
                    };
                    result = await api.setVehicle(newVehicleId, vehicleData);
                    break;
                case 'deleteVehicle':
                    const delVehicleId = document.getElementById('deleteVehicle-id').value;
                    if (!delVehicleId) {
                        throw new Error('Silinecek araç ID boş olamaz');
                    }
                    result = await api.deleteVehicle(delVehicleId);
                    break;
                case 'assignVehicleToRoute':
                    const routeForVehicle = document.getElementById('assignVehicleToRoute-routeId').value;
                    const vehicleForRoute = document.getElementById('assignVehicleToRoute-vehicleId').value;
                    if (!routeForVehicle || !vehicleForRoute) {
                        throw new Error('Rota ID ve Araç ID boş olamaz');
                    }
                    result = await api.assignVehicleToRoute(routeForVehicle, vehicleForRoute);
                    break;
                default:
                    throw new Error('Geçersiz API metodu');
            }

            // Format and display the result
            resultDiv.innerHTML = `<strong>Sonuç:</strong><br><pre>${formatResult(result)}</pre>`;
        } catch (error) {
            console.error("API error:", error);
            resultDiv.innerHTML = `<strong>Hata:</strong><br>${error.message}`;
        }
    });
});

// Helper function to format the result
function formatResult(result) {
    if (result === undefined) {
        return "İşlem başarılı (sonuç dönmüyor)";
    }
    
    if (typeof result === 'boolean') {
        return result ? "İşlem başarılı" : "İşlem başarısız";
    }
    
    if (result === null) {
        return "Sonuç bulunamadı";
    }
    
    if (typeof result === 'object') {
        return JSON.stringify(result, null, 2);
    }
    
    return result.toString();
}