// app.js
import { initializeFirebase } from './firebase.js'; // Assuming firebase.js is a sibling module
import {
    setMap, setGeocoder, setInfoWindow, getMap,
    getSpecialMarkers, addSpecialMarker, removeSpecialMarker, setSpecialMarkers,
    getSpecialRoutePolylines, setSpecialRoutePolylineAtIndex, clearSpecialMarkers,
    getSelectedRouteIndex, getRouteMarkers, getSpecialMarkerMode, setSpecialMarkerMode,
    addRouteMarkerArray, addRouteDataItem, getRouteData, getGeocoder,
    setSelectedRouteIndex, updateRouteDataStationsCount, getMaxWalkDuration, resetAppState
} from './app-state.js';
import {
    calculateRoute, findClosestMarkerInAllRoutes,
    createRoutesListContainer, updateRoutesList, calculateRouteForIndex,
    showMarkerInfoWindow, getDatabaseMarkers, removeMarker, updateMarkerLabels,
    updatePlacesListForRoute, selectRoute, geocodeCache,
    getDistanceBetweenCoords, calculateRouteDistanceMarkers, calculateRouteDistanceCoords,
    updateMarkerAddressCache, debouncedUpdatePlacesListForRoute
} from './app-utils.js';
import { optimizeRoute } from './optimizer.js'; 
import { getAllVehicles } from './api.js';

// DOM element references and their handlers for cleanup
let calculateRouteButton = null;
let toggleSpecialMarkerButton = null;
let runPythonOptimizerButton = null;
let mapClickListener = null;
let isAppInitialized = false;

// Bound function references for cleanup
let handleCalculateRoute = null;
let handleToggleSpecialMarker = null;
let handleRunPythonOptimizer = null;
let handleMapClick = null;

/**
 * Public API: Initialize the entire application
 * This should be called when the page loads or when the app component is mounted
 * @public
 */
export async function initApp() {
    console.log("🚀 initApp called...");
    
    if (isAppInitialized) {
        console.warn("App already initialized, skipping...");
        return;
    }

    try {
        // Initialize the map first
        await initMap();
        
        // Initialize markers after map is ready
        await initMarkers();
        
        // Process any pending passengers from local storage
        await processPendingPassengers();

        isAppInitialized = true;
        console.log("✅ initApp initialization complete");
    } catch (error) {
        console.error("❌ Error during app initialization:", error);
        throw error;
    }
}

/**
 * Public API: Cleanup the entire application
 * This should be called when navigating away from the page or unmounting the app component
 * @public
 */
export function cleanupApp() {
    console.log("🧹 cleanupApp called...");

    // Remove event listeners
    if (calculateRouteButton && handleCalculateRoute) {
        calculateRouteButton.removeEventListener('click', handleCalculateRoute);
        calculateRouteButton = null;
        handleCalculateRoute = null;
    }

    if (toggleSpecialMarkerButton && handleToggleSpecialMarker) {
        toggleSpecialMarkerButton.removeEventListener('click', handleToggleSpecialMarker);
        toggleSpecialMarkerButton = null;
        handleToggleSpecialMarker = null;
    }

    if (runPythonOptimizerButton && handleRunPythonOptimizer) {
        runPythonOptimizerButton.removeEventListener('click', handleRunPythonOptimizer);
        runPythonOptimizerButton = null;
        handleRunPythonOptimizer = null;
    }

    // Remove map click listener
    if (mapClickListener && getMap()) {
        google.maps.event.removeListener(mapClickListener);
        mapClickListener = null;
    }

    // Clear all markers from the map
    clearAllMarkers();

    // Clear route information panels from DOM
    clearRouteInfoPanels();

    // Reset application state
    resetAppState();

    // Clear global window references
    if (window.removeMapMarker) {
        delete window.removeMapMarker;
    }
    if (window.getSpecialMarkers) {
        delete window.getSpecialMarkers;
    }
    if (window.getRouteMarkers) {
        delete window.getRouteMarkers;
    }

    // Reset initialization flag
    isAppInitialized = false;

    console.log("✅ cleanupApp complete");
}

/**
 * Clears all route information panels from the DOM
 * @private
 */
function clearRouteInfoPanels() {
    // Remove all route info divs
    const routeInfos = document.querySelectorAll('.route-info');
    routeInfos.forEach(div => div.remove());

    // Remove routes list container
    const routesListContainer = document.getElementById('routes-list-container');
    if (routesListContainer) {
        routesListContainer.remove();
    }

    // Remove special markers panel
    const specialMarkersPanel = document.getElementById('special-markers-panel');
    if (specialMarkersPanel) {
        specialMarkersPanel.remove();
    }

    // Clear the result container
    const resultContainer = document.getElementById('result');
    if (resultContainer) {
        resultContainer.innerHTML = '';
    }
}

/**
 * Initializes the Google Map and sets up event listeners.
 * This is the primary entry point for setting up the map.
 * @private
 */
async function initMap() {
    console.log("initMap called: Google Maps API is ready."); // Add a console log to confirm
    setGeocoder(new google.maps.Geocoder());
    setInfoWindow(new google.maps.InfoWindow());

    const mapInstance = new google.maps.Map(document.getElementById('map'), {
        gestureHandling: 'greedy',
        center: { lat: 0, lng: 0 },
        zoom: 2
    });
    setMap(mapInstance);

    // Enable geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            getMap().setCenter(pos);
            getMap().setZoom(12);
        });
    }

    // Store bound function reference for cleanup
    handleMapClick = (e) => {
        if (getSpecialMarkerMode()) {
            // If special marker mode is active, add a special marker
            addSpecialMarkerToMap(e.latLng);
        } else {
            // Otherwise, add a regular marker to the selected route
            const selectedRouteIndex = getSelectedRouteIndex();
            if (selectedRouteIndex >= 0) { // Only add if a DB route is selected
                addMarkerToMap(e.latLng);
            } else {
                displayMessage('"Mevcut Rotalar" listesinden bir rota seçerek işaretçi ekleyin veya "Yolcu Modu"na geçerek yolcu adresleri ekleyin.');
            }
        }
    };

    // Map click listener now conditionally adds markers based on specialMarkerMode
    mapClickListener = getMap().addListener('click', handleMapClick);

    // Get DOM elements and attach event listeners
    calculateRouteButton = document.getElementById('calculate-route');
    if (calculateRouteButton) {
        handleCalculateRoute = async () => {
            const selectedRouteIndex = getSelectedRouteIndex();
            const routeMarkers = getRouteMarkers();

            if (selectedRouteIndex === -1) {
                displayMessage('Lütfen hesaplamak için bir rota seçin!');
                return;
            }

            // Calculate a database route
            if (!routeMarkers[selectedRouteIndex] || routeMarkers[selectedRouteIndex].length < 2) {
                displayMessage('Lütfen seçili rotaya en az iki işaretçi ekleyin!');
                return;
            }
            await calculateRouteForIndex(selectedRouteIndex);

            // After calculating the DB route, re-evaluate all special marker routes
            await updateAllSpecialMarkerRoutes();
            await updatePlacesListForRoute(); // Update the marker lists in the info panels
        };
        calculateRouteButton.addEventListener('click', handleCalculateRoute);
    }

    // The button to toggle special marker mode
    toggleSpecialMarkerButton = document.getElementById('toggleSpecialMarker');
    if (toggleSpecialMarkerButton) {
        handleToggleSpecialMarker = toggleSpecialMarkerPlacementMode;
        toggleSpecialMarkerButton.addEventListener('click', handleToggleSpecialMarker);
    }

    runPythonOptimizerButton = document.getElementById('runPythonOptimizer');
    if (runPythonOptimizerButton) {
        handleRunPythonOptimizer = async () => {
            document.getElementById('result').innerText = "Optimizer is running...";
            try {
                let locationMarkers = getSpecialMarkers();
                // Convert markers to the format expected by the optimizer
                const locations = locationMarkers.map(marker => ({
                    lat: marker.getPosition().lat(),
                    lng: marker.getPosition().lng()
                }));
                // Ensure we have at least one location
                if (locations.length === 0) {
                    throw new Error('No locations found for optimization.');
                }
                // Ensure we have vehicles available
                const vehicles = getAllVehicles();
                if (vehicles.length === 0) {
                    throw new Error('No vehicles found for optimization.');
                }
                
                // Call optimizeRoute from optimizer.js
                const optimizedStops = await optimizeRoute(locations, vehicles, getMaxWalkDuration());
                // Pass the output to the handler function
                handleOptimizerResult(optimizedStops);
            } catch (error) {
                console.error('Error during optimization:', error);
                document.getElementById('result').innerText = `Error: ${error.message}`;
            }
        };
        runPythonOptimizerButton.addEventListener('click', handleRunPythonOptimizer);
    }

    // Expose necessary functions globally for HTML event handlers if needed
    window.removeMapMarker = removeMapMarker;
    window.getSpecialMarkers = getSpecialMarkers;
    window.getRouteMarkers = getRouteMarkers;
}

/**
 * Initializes markers from a database or a fallback set.
 * This is called after the map is initialized to populate it with routes.
 * @private
 */
async function initMarkers() {
    console.log("initMarkers called."); // Add a console log to confirm
    await initializeFirebase();
    let routes = await getDatabaseMarkers();
    await drawInitialRoutes(routes); // Ensure drawInitialRoutes is awaited

    // After all initial routes and markers are drawn and processed, update all special marker routes
    await updateAllSpecialMarkerRoutes();
}

/**
 * Clear all markers from the map and reset state
 * @private
 */
function clearAllMarkers() {
    // Clear special markers
    clearSpecialMarkers();

    // Clear route markers
    const routeMarkers = getRouteMarkers();
    routeMarkers.forEach(routeMarkerArray => {
        if (routeMarkerArray) {
            routeMarkerArray.forEach(marker => {
                if (marker && marker.setMap) {
                    marker.setMap(null);
                }
            });
        }
    });

    // Clear route polylines if they exist in the state
    const specialRoutePolylines = getSpecialRoutePolylines();
    specialRoutePolylines.forEach(polyline => {
        if (polyline && polyline.setMap) {
            polyline.setMap(null);
        }
    });
}

/**
 * Public API: Draws special marker routes for an array of locations.
 * This will clear any existing special markers and draw new ones.
 * @param {Array<Object>} locations - An array of objects, each with 'lat' and 'lng' properties.
 * @public
 */
export async function drawSpecialMarkerRoutes(locations) {
    clearSpecialMarkers(); // Clear existing special markers
    for (const loc of locations) {
        const position = new google.maps.LatLng(loc.lat, loc.lng);
        await addSpecialMarkerToMap(position);
    }
}

// Dummy function to handle the optimizer result (you will implement this later)
function handleOptimizerResult() {
    console.log("Python Optimizer will run and result will be handled here!");
    // You can add some temporary UI feedback here if needed
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
        resultDiv.innerText = "Optimizer is running...";
    }
}

async function processPendingPassengers() {
    console.log("Checking for pending passengers in local storage...");
    const pendingPassengersJson = localStorage.getItem('pendingPassengers');
    if (pendingPassengersJson) {
        try {
            const pendingPassengers = JSON.parse(pendingPassengersJson);
            if (pendingPassengers && pendingPassengers.length > 0) {
                // Clear existing special markers if new passengers are being added from storage
                await addPassengersToMap(pendingPassengers, true);
            }
            // Clear the local storage item after processing to prevent re-adding on subsequent loads
            localStorage.removeItem('pendingPassengers');
            console.log("Pending passengers processed and cleared from local storage.");
        } catch (error) {
            console.error("Error parsing pending passengers from local storage:", error);
            displayMessage("Kaydedilmiş yolcular yüklenirken hata oluştu. Detaylar için konsolu kontrol edin.");
            localStorage.removeItem('pendingPassengers'); // Clear invalid data
        }
    } else {
        console.log("No pending passengers found in local storage.");
    }
}

/**
 * Public API: Adds passengers as special markers on the map.
 * This method geocodes passenger addresses and creates special markers for them.
 * @param {Array<Object>} passengers - An array of passenger objects with address information.
 * @param {boolean} [clearExisting=true] - Whether to clear existing special markers before adding new ones.
 * @returns {Promise<Object>} - Returns an object with success/failure counts and any errors.
 * @public
 */
export async function addPassengersToMap(passengers, clearExisting = true) {
    const geocoder = getGeocoder();
    const map = getMap();
    const results = { successful: 0, failed: 0, errors: [] };

    if (!geocoder) {
        const error = 'Geocoder not initialized';
        console.error(error);
        results.errors.push(error);
        return results;
    }

    if (clearExisting) {
        clearSpecialMarkers();
    }

    const geocodingPromises = passengers.map(passenger => {
        return new Promise(async (resolve) => {
            const address = passenger.data?.ADDRESS;
            if (!address) {
                const error = `No address found for passenger: ${passenger.id}`;
                console.warn(error);
                results.errors.push(error);
                results.failed++;
                resolve(null); // Resolve with null to indicate failure for this passenger
                return;
            }

            // Check cache first for forward geocoding
            const cachedGeocode = geocodeCache.get(address);
            if (cachedGeocode) {
                console.log(`Using cached geocode for address: ${address}`);
                resolve({ passenger, geocodeResult: cachedGeocode });
                return;
            }

            try {
                // Geocode the address
                const geocodeResult = await new Promise((geoResolve, geoReject) => {
                    geocoder.geocode({ address: address }, (results, status) => {
                        if (status === 'OK' && results && results.length > 0) {
                            // Store in cache
                            geocodeCache.set(address, results[0]);
                            geoResolve(results[0]);
                        } else {
                            geoReject(new Error(`Geocoding failed for address "${address}": ${status}`));
                        }
                    });
                });
                resolve({ passenger, geocodeResult });
            } catch (error) {
                const errorMsg = `Failed to geocode address for passenger ${passenger.id}: ${error.message}`;
                console.error(errorMsg);
                results.errors.push(errorMsg);
                results.failed++;
                resolve(null);
            }
        });
    });

    const geocodedPassengers = await Promise.all(geocodingPromises);

    const markerPromises = geocodedPassengers.map(async (item) => {
        if (!item) return null; // Skip failed geocodes

        const { passenger, geocodeResult } = item;
        try {
            const position = geocodeResult.geometry.location;
            const specialMarkers = getSpecialMarkers(); // Get the current array for accurate index

            // Create special marker with passenger information
            const passengerMarker = new google.maps.Marker({
                position: position,
                map: map,
                title: `${passenger.id.replace(/_/g, ' ')} - ${passenger.data.ROUTE || 'No Route'}`,
                icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', // Green dot for passenger marker
                draggable: true,
            });

            // Store passenger data in the marker for info window
            passengerMarker.passengerData = passenger;
            // Store the initial geocoded address directly on the marker
            passengerMarker.cachedAddress = geocodeResult.formatted_address; 
            addSpecialMarker(passengerMarker); // Add to state

            const specialMarkerIndex = specialMarkers.length - 1; // Index after adding this marker

            // Add click listener for info window with passenger details, using showMarkerInfoWindow
            passengerMarker.addListener('click', () => {
                showMarkerInfoWindow(passengerMarker, -1, specialMarkerIndex, true);
            });

            // Add drag listener to recalculate route, debounced update
            passengerMarker.addListener('dragend', async () => {
                // Invalidate/update cache for this marker's new position
                await updateMarkerAddressCache(passengerMarker.getPosition(), passengerMarker);
                await updateSpecialMarkerRoute(passengerMarker, specialMarkerIndex);
                debouncedUpdatePlacesListForRoute(); // Debounced call
            });

            results.successful++;
            return updateSpecialMarkerRoute(passengerMarker, specialMarkerIndex); // Return the promise for route calculation
        } catch (error) {
            const errorMsg = `Failed to add passenger marker or calculate route for ${passenger.id}: ${error.message}`;
            console.error(errorMsg);
            results.errors.push(errorMsg);
            results.failed++;
            return null;
        }
    });

    // Wait for all markers to be added and their initial routes calculated
    await Promise.all(markerPromises);

    debouncedUpdatePlacesListForRoute(); // Debounced call after all passengers are added

    return results;
}

/**
 * Public API: Adds a marker to the currently selected route on the map.
 * This function is now primarily for adding regular route markers.
 * To add special markers, use `addSpecialMarkerToMap` or `drawSpecialMarkerRoutes`.
 * @param {google.maps.LatLng} position - The geographic coordinates for the marker.
 * @public
 */
export async function addMarkerToMap(position) {
    console.log(position.lat(), position.lng());
    const map = getMap();
    const selectedRouteIndex = getSelectedRouteIndex();
    const routeMarkers = getRouteMarkers();

    // Add marker to the currently selected DB route
    if (selectedRouteIndex === -1) {
        displayMessage('"Mevcut Rotalar" listesinden bir rota seçerek işaretçi ekleyin.');
        return;
    }

    let targetMarkersArray = routeMarkers[selectedRouteIndex];
    if (!targetMarkersArray) {
        routeMarkers[selectedRouteIndex] = [];
        targetMarkersArray = routeMarkers[selectedRouteIndex];
    }

    const marker = new google.maps.Marker({
        position: position,
        map: map,
        draggable: true,
        label: (targetMarkersArray.length + 1).toString(), // Label based on current route's markers
    });

    targetMarkersArray.push(marker); // Add to specific route markers

    const index = targetMarkersArray.length - 1; // Get the index of the newly added marker

    // Add left-click listener for info window
    marker.addListener('click', async () => {
        // When a marker is clicked, update its cached address if needed
        await updateMarkerAddressCache(marker.getPosition(), marker);
        showMarkerInfoWindow(marker, selectedRouteIndex, index);
    });

    marker.addListener('dragend', async () => {
        // Invalidate/update cache for this marker's new position
        await updateMarkerAddressCache(marker.getPosition(), marker);
        await calculateRouteForIndex(selectedRouteIndex);

        // Recalculate all special marker routes after a regular route marker is dragged
        await updateAllSpecialMarkerRoutes();
        debouncedUpdatePlacesListForRoute(); // Debounced call
    });

    // Recalculate the selected route if there are enough markers
    if (targetMarkersArray.length > 1) {
        await calculateRouteForIndex(selectedRouteIndex);
    }
    updateRoutesList(); // Update count in routes list
    debouncedUpdatePlacesListForRoute(); // Debounced call
}

/**
 * Public API: Adds a single special marker to the map and calculates its route.
 * @param {google.maps.LatLng} position - The geographic coordinates for the special marker.
 * @public
 */
export async function addSpecialMarkerToMap(position) {
    const map = getMap();
    const specialMarkers = getSpecialMarkers();

    const newSpecialMarker = new google.maps.Marker({
        position: position,
        map: map,
        title: `Special Marker ${specialMarkers.length + 1}`,
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', // Green dot for special marker
        draggable: true,
    });

    addSpecialMarker(newSpecialMarker); // Add to state
    const specialMarkerIndex = specialMarkers.length - 1; // Get the index of the newly added marker

    // Add left-click listener for info window
    newSpecialMarker.addListener('click', async () => {
        // When a marker is clicked, update its cached address if needed
        await updateMarkerAddressCache(newSpecialMarker.getPosition(), newSpecialMarker);
        showMarkerInfoWindow(newSpecialMarker, -1, specialMarkerIndex, true); // -1 for special marker routeIdx
    });

    // When the special marker is placed or moved, recalculate the closest marker
    newSpecialMarker.addListener('dragend', async () => {
        // Invalidate/update cache for this marker's new position
        await updateMarkerAddressCache(newSpecialMarker.getPosition(), newSpecialMarker);
        await updateSpecialMarkerRoute(newSpecialMarker, specialMarkerIndex);
        debouncedUpdatePlacesListForRoute(); // Debounced call
    });

    // Calculate initial route for the new special marker
    await updateSpecialMarkerRoute(newSpecialMarker, specialMarkerIndex);
    debouncedUpdatePlacesListForRoute(); // Debounced call
}

/**
 * Updates the route for a single special marker to the closest station across all routes.
 * @param {google.maps.Marker} specialMarker - The special marker to update.
 * @param {number} specialMarkerIndex - The index of the special marker in the specialMarkers array.
 * @private
 */
async function updateSpecialMarkerRoute(specialMarker, specialMarkerIndex) {
    const routeMarkers = getRouteMarkers(); // DB route markers (array of arrays)
    const specialRoutePolylines = getSpecialRoutePolylines();

    // Find the closest station across ALL available DB routes
    const closestTargetMarker = findClosestMarkerInAllRoutes(specialMarker, routeMarkers);

    if (closestTargetMarker) {
        await calculateRoute([specialMarker, closestTargetMarker], true, '#00FF00', specialMarkerIndex); // Green color for special route
    } else {
        // If no target markers, remove the special route if it was previously drawn
        if (specialRoutePolylines[specialMarkerIndex]) {
            specialRoutePolylines[specialMarkerIndex].setMap(null);
            setSpecialRoutePolylineAtIndex(specialMarkerIndex, null); // Clear reference
        }
    }
}

/**
 * Recalculates and redraws routes for all existing special markers.
 * This function is called when DB routes are updated, or on initial load.
 * @private
 */
async function updateAllSpecialMarkerRoutes() {
    const specialMarkers = getSpecialMarkers();
    // Create an array of promises, one for each updateSpecialMarkerRoute call
    const updatePromises = specialMarkers.map((marker, i) =>
        updateSpecialMarkerRoute(marker, i)
    );
    // Wait for all promises to resolve concurrently
    await Promise.all(updatePromises);
}

/**
 * Public API: Removes a marker from the map.
 * @param {google.maps.Marker} marker - The marker object to remove.
 * @param {number} routeIdx - The index of the route the marker belongs to (-1 for special marker, 0+ for DB routes).
 * @param {number} markerIndex - The index of the marker within its route array (for DB route) or specialMarkers array (for special marker).
 * @returns {boolean} - True if the marker was successfully removed, false otherwise.
 * @public
 */
export function removeMapMarker(marker, routeIdx, markerIndex) {
    if (routeIdx === -1) { // Special marker
        // Find the current index of the marker, as markerIndex from click might be stale
        const actualMarkerIndex = getSpecialMarkers().indexOf(marker);
        if (actualMarkerIndex !== -1) {
            const removed = removeSpecialMarker(actualMarkerIndex);
            if (removed) {
                debouncedUpdatePlacesListForRoute(); // Debounced call after removal
            }
            return removed;
        }
        return false; // Marker not found in special markers array
    }
    const removed = removeMarker(marker, routeIdx); // removeMarker in app-utils takes marker and routeIdx only
    if (removed) {
        debouncedUpdatePlacesListForRoute(); // Debounced call after removal
        updateAllSpecialMarkerRoutes(); // Recalculate special routes if a regular marker was removed
    }
    return removed;
}

/**
 * Public API: Calculates the route distance between two Google Maps Marker objects.
 * @param {google.maps.Marker} marker1 - The first marker.
 * @param {google.maps.Marker} marker2 - The second marker.
 * @param {string} [travelMode='DRIVE'] - The travel mode (e.g., 'DRIVE', 'WALK', 'BICYCLE').
 * @returns {Promise<number>} - A promise that resolves with the distance in meters.
 * @throws {Error} If markers are invalid or API key is missing.
 * @public
 */
export async function getDistanceBetweenMarkers(marker1, marker2, travelMode = 'DRIVE') {
    return calculateRouteDistanceMarkers(marker1, marker2, travelMode);
}

/**
 * Public API: Calculates the route distance between two sets of coordinates.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lng1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lng2 - Longitude of the second point.
 * @param {string} [travelMode='DRIVE'] - The travel mode (e.g., 'DRIVE', 'WALK', 'BICYCLE').
 * @returns {Promise<number>} - A promise that resolves with the distance in meters.
 * @throws {Error} If coordinates are invalid or API key is missing.
 * @public
 */
export async function getDistanceBetweenCoordinates(lat1, lng1, lat2, lng2, travelMode = 'DRIVE') {
    return calculateRouteDistanceCoords(lat1, lng1, lat2, lng2, travelMode);
}

/**
 * Public API: Calculates and displays a route between an array of Google Maps Marker objects.
 * This function also updates the UI to show route information.
 * @param {Array<google.maps.Marker>} markers - An array of marker objects to form the route.
 * @param {boolean} [isSpecialRoute=false] - True if this is for the special marker's route.
 * @param {string} [routeColor='#4285F4'] - The color of the polyline.
 * @param {number} [routeIndex=-1] - The index of the route if it's a DB route (0+), or the index within specialMarkers array if isSpecialRoute is true.
 * @public
 */
export function calculateMapRoute(markers, isSpecialRoute = false, routeColor = '#4285F4', routeIndex = -1) {
    return calculateRoute(markers, isSpecialRoute, routeColor, routeIndex);
}

/**
 * Public API: Selects a route to make it active for adding markers and display its info.
 * @param {number} index - The index of the route to select (0+ for DB routes).
 * @public
 */
export function selectMapRoute(index) {
    selectRoute(index); // Call the utility function for route selection logic
}

/**
 * Displays a message to the user in a user-friendly way.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - Optional type of message ('info', 'success', 'error', etc.)
 */
function displayMessage(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Attempt to use a custom message container if it exists
    let container = document.getElementById('message-container');
    if (!container) {
        // Create container if it doesn't exist
        container = document.createElement('div');
        container.id = 'message-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '1000';
        container.style.maxWidth = '300px';
        document.body.appendChild(container);
    }

    const messageBox = document.createElement('div');
    messageBox.innerText = message;
    messageBox.style.marginBottom = '10px';
    messageBox.style.padding = '10px';
    messageBox.style.borderRadius = '5px';
    messageBox.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    messageBox.style.backgroundColor = {
        info: '#d9edf7',
        success: '#dff0d8',
        error: '#f2dede',
        warning: '#fcf8e3'
    }[type] || '#d9edf7';
    messageBox.style.color = '#333';

    container.appendChild(messageBox);

    // Auto-remove message after a few seconds
    setTimeout(() => {
        container.removeChild(messageBox);
        if (container.children.length === 0) {
            document.body.removeChild(container);
        }
    }, 4000);
}

/**
 * Public API: Toggles the special marker placement mode.
 * In special marker mode, clicks on the map place or move a single 'special' marker.
 * @public
 */
export function toggleSpecialMarkerPlacementMode() {
    const specialMarkerMode = getSpecialMarkerMode();
    setSpecialMarkerMode(!specialMarkerMode);
    if (getSpecialMarkerMode()) {
        displayMessage("Yolcu Modu Aktif. Haritaya tıklayarak yolcu adresleri ekleyebilirsiniz.");
    } else {
        displayMessage("Rota İstasyonu Modu Aktif. Haritaya tıklayarak seçili rotaya istasyon ekleyebilirsiniz.");
    }
}

/**
 * Draws initial routes from the database or fallback data.
 * @param {Array<Object>} routes - An array of route data, each containing an array of marker coordinates.
 * @private
 */
async function drawInitialRoutes(routes) {
    const map = getMap();
    const routeMarkers = getRouteMarkers();

    // For multiple routes (DB routes)
    for (const [routeIndex, route] of routes.entries()) {
        // Create a new array to store this route's markers
        const currentRouteMarkers = [];
        addRouteMarkerArray(currentRouteMarkers); // Add the new array to the state

        // Store route data for later use
        addRouteDataItem({
            id: route.id,
            name: route.name,
            stationsCount: route.markers.length
        });

        // Create markers for this route
        for (const markerData of route.markers) { // Use for...of for async operations
            const latLng = new google.maps.LatLng(markerData.lat, markerData.lng);
            const marker = new google.maps.Marker({
                position: latLng,
                map: map,
                draggable: true, // Database routes are now draggable for temporary changes
                label: (currentRouteMarkers.length + 1).toString(),
            });

            // Store the initial geocoded address directly on the marker
            // Perform reverse geocoding once when the marker is created
            await updateMarkerAddressCache(latLng, marker);

            currentRouteMarkers.push(marker);

            // Add listener for left-click to show info window
            marker.addListener('click', () => {
                showMarkerInfoWindow(marker, routeIndex, currentRouteMarkers.indexOf(marker));
            });

            // Add dragend listener for recalculation, debounced update
            marker.addListener('dragend', async () => {
                // Invalidate/update cache for this marker's new position
                await updateMarkerAddressCache(marker.getPosition(), marker);
                await calculateRouteForIndex(routeIndex);
                await updateAllSpecialMarkerRoutes(); // Recalculate all special marker routes
                debouncedUpdatePlacesListForRoute(); // Debounced call
            });
        }

        // Calculate and draw the route if there are enough markers
        if (currentRouteMarkers.length > 1) {
            await calculateRouteForIndex(routeIndex);
        }
    }

    // Create the routes list container if it doesn't exist
    createRoutesListContainer();

    // After all initial routes and markers are drawn and processed, update the places list
    debouncedUpdatePlacesListForRoute(); // Debounced call
}