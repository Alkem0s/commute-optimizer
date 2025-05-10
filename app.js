import { getAllRoutes } from './api.js';
import { initializeFirebase } from './firebase.js';

let map;
let markers = []; // Array to store route markers for manual markers
let routeMarkers = []; // Array to store arrays of markers for each route
let routePolylines = []; // Array to store polylines for each route
let includedMarkers = [];
let specialMarker = null; // Special marker instance
let specialMarkerMode = false; // Flag to toggle special marker mode
let mainRoutePolyline = null;
let closestRoutePolyline = null;
let geocoder;
let infoWindow;

let test_markers = [
    { lat: 38.46595521912682, lng: 27.351150512695312 },
    { lat: 38.45119988839858, lng: 27.24231719970703 },
    { lat: 38.444967505761575, lng: 27.203536406792217 },
    { lat: 38.466475687372274 , lng: 27.186370269096905 },
    { lat: 38.46524998199707 , lng: 27.206427099470964 },
    { lat: 38.471163708279626, lng: 27.11990976548659 },
    { lat: 38.46847571099811, lng: 27.164541723494402 }
];

// Initialize map
export function initMap() {
    geocoder = new google.maps.Geocoder();
    infoWindow = new google.maps.InfoWindow();

    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 0, lng: 0 },
        zoom: 2
    });

    // Enable geolocation
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            map.setCenter(pos);
            map.setZoom(12);
        });
    }

    map.addListener('click', (e) => {
        addMarker(e.latLng);
    });

    document.getElementById('calculate-route').addEventListener('click', () => {
        if (specialMarkerMode) {
            if (!specialMarker) {
                alert('Please add a special marker first!');
                return;
            }
            calculateRoute([specialMarker, findClosestMarker()], true);
            updatePlacesList(specialMarker.getPosition(), 0, true);
        } else {
            if (markers.length < 2) {
                alert('Please add at least two regular markers!');
                return;
            }

            calculateRoute(markers, false);
            if (specialMarker) {
                let closestMarker = findClosestMarker();
                if (closestMarker) {
                    calculateRoute([specialMarker, findClosestMarker()], true);
                    updatePlacesList(specialMarker.getPosition(), 0, true);
                }
            }
        }
    });
    document.getElementById('toggleSpecialMarker').addEventListener('click', toggleSpecialMarkerMode);
}

async function initMarkers() {
    await initializeFirebase();
    let routes = await getDatabaseMarkers();
    drawInitialRoutes(routes);
}

function drawInitialRoutes(routes) {
    // For manual markers (backward compatibility)
    if (Array.isArray(routes) && routes.length > 0 && !routes[0].markers) {
        routes.forEach(marker => {
            const latLng = new google.maps.LatLng(marker.lat, marker.lng);
            addMarker(latLng);
        });
        if (markers.length > 1) {
            calculateRoute(markers, false);
        }
        return;
    }

    // For multiple routes
    routes.forEach((route, routeIndex) => {
        // Create a new array to store this route's markers
        const currentRouteMarkers = [];
        routeMarkers.push(currentRouteMarkers);
        
        // Create markers for this route
        route.markers.forEach(markerData => {
            const latLng = new google.maps.LatLng(markerData.lat, markerData.lng);
            const marker = new google.maps.Marker({
                position: latLng,
                map: map,
                draggable: false, // Database routes are not draggable
                label: (currentRouteMarkers.length + 1).toString(),
            });
            
            currentRouteMarkers.push(marker);
            
            // Add listener for info window
            marker.addListener('click', () => {
                infoWindow.setContent(`<div>
                    <strong>Route ${routeIndex + 1}, Marker ${currentRouteMarkers.length}</strong><br>
                    Lat: ${latLng.lat().toFixed(6)}<br>
                    Lng: ${latLng.lng().toFixed(6)}
                </div>`);
                infoWindow.open(map, marker);
            });
        });
        
        // Calculate and draw the route if there are enough markers
        if (currentRouteMarkers.length > 1) {
            calculateRouteForIndex(routeIndex);
        }
    });
}

// Calculate and draw a route for a specific route index
function calculateRouteForIndex(routeIndex) {
    if (routeIndex < 0 || routeIndex >= routeMarkers.length) return;
    
    const currentRouteMarkers = routeMarkers[routeIndex];
    if (currentRouteMarkers.length < 2) return;
    
    // Use a custom color for each route based on index
    const routeColors = [
        '#4285F4', // Blue
        '#DB4437', // Red
        '#F4B400', // Yellow
        '#0F9D58', // Green
        '#9C27B0', // Purple
        '#FF9800', // Orange
        '#795548', // Brown
        '#607D8B', // Gray
        '#2196F3', // Light Blue
        '#E91E63'  // Pink
    ];
    
    const routeColor = routeColors[routeIndex % routeColors.length];
    
    // Calculate the route with a specific color
    calculateRoute(currentRouteMarkers, false, routeColor, routeIndex);
}

async function getDatabaseMarkers() {
    try {
        let allRoutes = await getAllRoutes();
        let routesArray = [];

        // Check if allRoutes is an object
        if (typeof allRoutes === 'object' && allRoutes !== null && !Array.isArray(allRoutes)) {
            // Convert object to array of routes
            for (const routeId in allRoutes) {
                const route = allRoutes[routeId];
                if (route && Array.isArray(route.STOPS)) {
                    const markers = route.STOPS.map(stop => ({
                        lat: stop.LAT,
                        lng: stop.LONG,
                    }));
                    
                    routesArray.push({
                        id: routeId,
                        name: route.NAME || `Route ${routeId}`,
                        markers: markers
                    });
                }
            }
        } else if (Array.isArray(allRoutes)) {
            // Handle if allRoutes is already an array
            for (let i = 0; i < allRoutes.length; i++) {
                const route = allRoutes[i];
                if (route && Array.isArray(route.STOPS)) {
                    const markers = route.STOPS.map(stop => ({
                        lat: stop.LAT,
                        lng: stop.LONG,
                    }));
                    
                    routesArray.push({
                        id: i.toString(),
                        name: route.NAME || `Route ${i}`,
                        markers: markers
                    });
                }
            }
        }

        // If no valid routes found, try test_markers as a fallback
        if (routesArray.length === 0) {
            console.warn("No valid routes found in database, using test markers");
            routesArray.push({
                id: "test",
                name: "Test Route",
                markers: test_markers
            });
        }

        return routesArray;
    } catch (error) {
        console.error("Error transforming stops into markers:", error);
        // Return test markers as fallback
        return [{
            id: "test",
            name: "Test Route",
            markers: test_markers
        }];
    }
}

function addMarker(position) {
    console.log(position.lat(), position.lng());
    console.log(position.lat(), position.lng());
    if (specialMarkerMode) {
        let closestMarker = null;
        if (specialMarker) {
            specialMarker.setPosition(position); // Move special marker if it already exists
            closestMarker = findClosestMarker();
        } else {
            // Create a special marker if it doesn't exist yet
            specialMarker = new google.maps.Marker({
                position: position,
                map: map,
                title: 'Special Marker',
                icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png', // Different color for special marker
                draggable: true,
            });

            // When the special marker is placed or moved, recalculate the closest marker
            specialMarker.addListener('dragend', () => {
                if (includedMarkers.includes(specialMarker)) {
                    closestMarker = findClosestMarker();
                    if (closestMarker) {
                        calculateRoute([specialMarker, closestMarker], true);
                        updatePlacesList(position, 0, true);
                    }
                }
            });
        }
    } else {
        // Regular marker logic for the route
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            draggable: true,
            label: (markers.length + 1).toString(),
        });

        const index = markers.push(marker) - 1;

        marker.addListener('dragend', () => {
            updatePlacesList(marker.getPosition(), index);
            if (markers.length > 1 && includedMarkers.includes(marker)) {
                calculateRoute(markers, false);
            }
            if (specialMarker && includedMarkers.includes(marker)) {
                let closestMarker = findClosestMarker();
                if (closestMarker) {
                    calculateRoute([specialMarker, closestMarker], true);
                    updatePlacesList(position, 0, true);
                }
            }
        });

        updatePlacesList(position, index, false);
    }
}

// Function to calculate the distance between two coordinates
function getDistanceBetweenCoords(lat1, lng1, lat2, lng2) {
    const point1 = new google.maps.LatLng(lat1, lng1);
    const point2 = new google.maps.LatLng(lat2, lng2);
    
    return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
}

// Function to calculate the distance between two markers using the Routes API
async function calculateRouteDistanceMarkers(marker1, marker2, travelMode = 'DRIVE') {
    if (!marker1 || !marker2) {
        throw new Error('Two markers are required');
    }

    // Extract API key from the Google Maps script tag
    const scriptTag = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    const scriptSrc = scriptTag?.src || '';
    const apiKey = scriptSrc.match(/[?&]key=([^&]*)/)?.[1];

    if (!apiKey) {
        throw new Error('Google Maps API key not found');
    }

    // Create the API request payload
    const requestBody = {
        origin: {
            location: {
                latLng: {
                    latitude: marker1.getPosition().lat(),
                    longitude: marker1.getPosition().lng()
                }
            }
        },
        destination: {
            location: {
                latLng: {
                    latitude: marker2.getPosition().lat(),
                    longitude: marker2.getPosition().lng()
                }
            }
        },
        travelMode: travelMode,
        routingPreference: "TRAFFIC_AWARE",
        units: "METRIC"
    };

    // Make the API request
    const response = await fetch(
        `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-FieldMask': 'routes.distanceMeters'
            },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error?.message || 'Failed to calculate route');
    }

    const data = await response.json();
    return data.routes?.[0]?.distanceMeters || 0;
}

// Function to calculate the distance between two coordinates using the Routes API
async function calculateRouteDistanceCoords(lat1, lng1, lat2, lng2, travelMode = 'DRIVE') {
    if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
        throw new Error('Coordinates for both origin and destination are required');
    }

    // Extract API key from the Google Maps script tag
    const scriptTag = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    const scriptSrc = scriptTag?.src || '';
    const apiKey = scriptSrc.match(/[?&]key=([^&]*)/)?.[1];

    if (!apiKey) {
        throw new Error('Google Maps API key not found');
    }

    const requestBody = {
        origin: {
            location: {
                latLng: {
                    latitude: lat1,
                    longitude: lng1
                }
            }
        },
        destination: {
            location: {
                latLng: {
                    latitude: lat2,
                    longitude: lng2
                }
            }
        },
        travelMode: travelMode,
        routingPreference: "TRAFFIC_AWARE",
        units: "METRIC"
    };

    const response = await fetch(
        `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-FieldMask': 'routes.distanceMeters'
            },
            body: JSON.stringify(requestBody)
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error?.message || 'Failed to calculate route');
    }

    const data = await response.json();
    return data.routes?.[0]?.distanceMeters || 0;
}


// Function to find the closest regular route marker to the special marker
function findClosestMarker() {
    if (!specialMarker || markers.length < 1) return null;

    let closestMarker = null;
    let closestDistance = Infinity;

    markers.forEach(marker => {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(specialMarker.getPosition(), marker.getPosition());
        if (distance < closestDistance) {
            closestDistance = distance;
            closestMarker = marker;
        }
    });

    return closestMarker;
}


// Toggle special marker mode
function toggleSpecialMarkerMode() {
    specialMarkerMode = !specialMarkerMode;
    if (specialMarkerMode) {
        alert("Special Marker Mode Enabled. Click to place or move the special marker.");
    } else {
        alert("Regular Marker Mode Enabled. Click to place route markers.");
    }
}

// Calculate and update places list
function updatePlacesList(location, index, isSpecialMarker = false) {
    geocoder.geocode({ location }, (results, status) => {
        const placesList = document.getElementById('places-list');
        const address = status === 'OK' && results[0] 
            ? results[0].formatted_address 
            : 'Address not found';

        // If it's a special marker, use a different identifier
        const markerLabel = isSpecialMarker ? 'Special Marker' : `Marker ${index + 1}`;

        let placeItem;

        if (isSpecialMarker) {
            // Check if a place item for the special marker already exists
            placeItem = document.querySelector('.special-marker-item');
            if (!placeItem) {
                // If no special marker item, create a new one
                placeItem = document.createElement('div');
                placeItem.className = 'place-item special-marker-item';
                placesList.appendChild(placeItem);
            }
        } else {
            // For regular markers, use the provided index
            placeItem = placesList.children[index];
            if (!placeItem) {
                placeItem = document.createElement('div');
                placeItem.className = 'place-item';
                placesList.appendChild(placeItem);
            }
        }

        // Update the HTML content for the place item
        placeItem.innerHTML = `
            <strong>${markerLabel}</strong><br>
            Lat: ${location.lat().toFixed(6)}<br>
            Lng: ${location.lng().toFixed(6)}<br>
            ${address}
        `;
    });
}

async function calculateRoute(routeMarkers, isSpecialRoute = false, routeColor = '#4285F4', routeIndex = -1) {
    if (routeMarkers.length < 2) {
        alert('Please add at least two markers');
        return;
    }

    try {
        // If this is a special route calculation, clear the existing closestRoutePolyline
        if (isSpecialRoute && closestRoutePolyline) {
            closestRoutePolyline.setMap(null);
            closestRoutePolyline = null;
        }

        // If this is a specific route index, clear its existing polyline
        if (routeIndex >= 0 && routePolylines[routeIndex]) {
            routePolylines[routeIndex].setMap(null);
            routePolylines[routeIndex] = null;
        }
        // Clear the mainRoutePolyline for manual markers
        else if (!isSpecialRoute && mainRoutePolyline && routeIndex < 0) {
            mainRoutePolyline.setMap(null);
            mainRoutePolyline = null;
        }

        // Extract API key from the Google Maps script tag
        const scriptTag = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        const scriptSrc = scriptTag ? scriptTag.src : '';
        const keyMatch = scriptSrc.match(/[?&]key=([^&]*)/);
        const apiKey = keyMatch ? keyMatch[1] : '';

        if (!apiKey) {
            throw new Error('Google Maps API key not found');
        }

        // Create intermediates (waypoints) for the Routes API
        const intermediates = routeMarkers.slice(1, -1).map(marker => {
            return {
                location: {
                    latLng: {
                        latitude: marker.getPosition().lat(),
                        longitude: marker.getPosition().lng()
                    }
                }
            };
        });
        
        // Record each routeMarker to includedMarkers if it's the manual route
        if (routeIndex < 0) {
            includedMarkers = [...routeMarkers];
            console.log(includedMarkers);
        }

        // Format the request body according to the Routes API v2 documentation
        const requestBody = {
            origin: {
                location: {
                    latLng: {
                        latitude: routeMarkers[0].getPosition().lat(),
                        longitude: routeMarkers[0].getPosition().lng()
                    }
                }
            },
            destination: {
                location: {
                    latLng: {
                        latitude: routeMarkers[routeMarkers.length - 1].getPosition().lat(),
                        longitude: routeMarkers[routeMarkers.length - 1].getPosition().lng()
                    }
                }
            },
            intermediates: intermediates,
            travelMode: "DRIVE",
            optimizeWaypointOrder: true,
            routingPreference: "TRAFFIC_AWARE",
            computeAlternativeRoutes: false,
            languageCode: "en-US",
            units: "METRIC"
        };

        // Make API request with corrected field mask
        const response = await fetch(
            `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.optimized_intermediate_waypoint_index'
                },
                body: JSON.stringify(requestBody)
            }
        );

        const responseText = await response.text();
        
        if (!response.ok) {
            let errorMessage = "Routes API error";
            try {
                const errorData = JSON.parse(responseText);
                errorMessage += `: ${errorData.error?.message || response.statusText}`;
            } catch (e) {
                errorMessage += `: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const routeData = JSON.parse(responseText);
        
        if (routeData.routes && routeData.routes.length > 0) {
            const route = routeData.routes[0];
            
            // Extract route information
            const totalDistance = parseInt(route.distanceMeters || 0);
            const totalDuration = parseInt(route.duration?.replace('s', '') || 0);
            
            // Use the correct field name for optimized waypoint indices
            const waypointOrder = route.optimized_intermediate_waypoint_index || [];
            
            // Append results for each route to the result section
            const resultContainer = document.getElementById('result');
            
            // Determine route label based on type
            let routeLabel;
            if (isSpecialRoute) {
                routeLabel = 'Special Route';
            } else if (routeIndex >= 0) {
                routeLabel = `Route ${routeIndex + 1}`;
            } else {
                routeLabel = 'Main Route';
            }

            // Generate a unique class for this route
            const routeClass = isSpecialRoute ? 'special-route' : 
                               (routeIndex >= 0 ? `db-route-${routeIndex}` : 'main-route');

            // Check if the route already exists (using a unique ID or class)
            let routeDiv = document.querySelector(`.route-info.${routeClass}`);

            if (!routeDiv) {
                // Create a new route div if it doesn't exist
                routeDiv = document.createElement('div');
                routeDiv.className = `route-info ${routeClass}`;
                resultContainer.appendChild(routeDiv);
            }

            // Update the route info
            routeDiv.innerHTML = `
                <strong>${routeLabel}</strong><br>
                Total distance: ${(totalDistance / 1000).toFixed(2)} km<br>
                Total duration: ${Math.floor(totalDuration / 60)} minutes ${totalDuration % 60} seconds<br>
                ${waypointOrder.length > 0 ? `Optimized waypoint order: ${waypointOrder.join(', ')}` : 'Direct route calculated.'}
            `;

            // Draw the route on the map using a Polyline
            if (route.polyline && route.polyline.encodedPolyline) {
                const decodedPath = decodePolyline(route.polyline.encodedPolyline);
                
                // Create polyline based on route type
                let polyline = new google.maps.Polyline({
                    path: decodedPath,
                    geodesic: true,
                    strokeColor: routeColor,
                    strokeOpacity: 1.0,
                    strokeWeight: 4,
                    map: map
                });

                // Store the polyline based on route type
                if (isSpecialRoute) {
                    closestRoutePolyline = polyline;
                } else if (routeIndex >= 0) {
                    routePolylines[routeIndex] = polyline;
                } else {
                    mainRoutePolyline = polyline;
                }

                // Adjust map bounds to show the entire route
                const bounds = new google.maps.LatLngBounds();
                decodedPath.forEach(point => bounds.extend(point));
                map.fitBounds(bounds);
            }
        } else {
            throw new Error('No routes found');
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        alert('Could not calculate route: ' + error.message);
        
        // Fall back to a simpler approach as a last resort
        if (routeIndex >= 0) {
            fallbackDrawPolyline(routeMarkers, routeColor, routeIndex);
        } else {
            fallbackDrawPolyline(routeMarkers, routeColor);
        }
    }
}


// Fallback function to draw a simple route if all else fails
function fallbackDrawPolyline(routeMarkers, routeColor = '#FF0000', routeIndex = -1) {
    // Clear appropriate polyline
    if (routeIndex >= 0 && routePolylines[routeIndex]) {
        routePolylines[routeIndex].setMap(null);
    } else if (mainRoutePolyline && routeIndex < 0) {
        mainRoutePolyline.setMap(null);
    }
    
    // Create a path between all markers in order
    const path = routeMarkers.map(marker => marker.getPosition());
    
    // Draw a simple polyline
    const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: routeColor,
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: map
    });
    
    // Store the polyline appropriately
    if (routeIndex >= 0) {
        routePolylines[routeIndex] = polyline;
    } else {
        mainRoutePolyline = polyline;
    }
    
    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
    
    // Calculate straight-line distances
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
        totalDistance += google.maps.geometry.spherical.computeDistanceBetween(path[i], path[i+1]);
    }
    
    // Determine route label
    const routeLabel = routeIndex >= 0 ? `Route ${routeIndex + 1}` : 'Main Route';
    const routeClass = routeIndex >= 0 ? `db-route-${routeIndex}` : 'main-route';
    
    // Add or update result information
    const resultContainer = document.getElementById('result');
    let routeDiv = document.querySelector(`.route-info.${routeClass}`);
    
    if (!routeDiv) {
        routeDiv = document.createElement('div');
        routeDiv.className = `route-info ${routeClass}`;
        resultContainer.appendChild(routeDiv);
    }
    
    routeDiv.innerHTML = `
        <strong>${routeLabel} (FALLBACK MODE)</strong><br>
        <p>Total distance: ${(totalDistance / 1000).toFixed(2)} km</p>
        <p>Note: This is an approximation; optimization not available in fallback mode.</p>
    `;
}

// Helper function to decode polyline
function decodePolyline(encodedPolyline) {
    const points = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encodedPolyline.length) {
        let b, shift = 0, result = 0;
        
        do {
            b = encodedPolyline.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;
        
        shift = 0;
        result = 0;
        
        do {
            b = encodedPolyline.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;
        
        points.push(new google.maps.LatLng(lat / 1e5, lng / 1e5));
    }
    
    return points;
}

initMarkers();