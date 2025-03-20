let map;
let markers = []; // Array to store route markers
let specialMarker = null; // Special marker instance
let specialMarkerMode = false; // Flag to toggle special marker mode
let mainRoutePolyline = null;
let closestRoutePolyline = null;
let geocoder;
let infoWindow;

// Initialize map
function initMap() {
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
        if (markers.length < 2) {
            alert('Please add at least two regular markers!');
            return;
        }
    
        calculateOptimalRoute(markers, false);
        if (specialMarker) {
            let closestMarker = findClosestMarker();
            if (closestMarker) {
                calculateOptimalRoute([specialMarker, closestMarker], true);
                updatePlacesList(specialMarker.getPosition(), 0, true);
            }
        }
    });
    document.getElementById('toggleSpecialMarker').addEventListener('click', toggleSpecialMarkerMode);
}

function addMarker(position) {
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
                closestMarker = findClosestMarker();
                if (closestMarker) {
                    calculateOptimalRoute([specialMarker, closestMarker], true);
                }
                updatePlacesList(position, 0, true);
            });
            closestMarker = findClosestMarker(); // Call to find closest marker immediately when the special marker is placed
        }
        if (closestMarker) {
            calculateOptimalRoute([specialMarker, closestMarker], true);
        }

        updatePlacesList(position, 0, true);

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
            if (markers.length > 1) {
                calculateOptimalRoute(markers, false);
            }
            if (specialMarker) {
                let closestMarker = findClosestMarker();
                if (closestMarker) {
                    calculateOptimalRoute([specialMarker, closestMarker], true);
                    updatePlacesList(position, 0, true);
                }
            }
        });

        updatePlacesList(position, index, false);
    }
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

async function calculateOptimalRoute(routeMarkers, isSpecialRoute = false) {
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

        // Clear the mainRoutePolyline if needed
        if (!isSpecialRoute && mainRoutePolyline) {
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
            const routeLabel = isSpecialRoute ? 'Special Route' : 'Main Route';

            // Check if the route already exists (using a unique ID or class)
            let routeDiv = document.querySelector(`.route-info.${isSpecialRoute ? 'special-route' : 'main-route'}`);

            if (!routeDiv) {
                // Create a new route div if it doesn't exist
                routeDiv = document.createElement('div');
                routeDiv.className = `route-info ${isSpecialRoute ? 'special-route' : 'main-route'}`;
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
                
                // If it's a special route, draw it with a different color (e.g., red)
                if (isSpecialRoute) {
                    closestRoutePolyline = new google.maps.Polyline({
                        path: decodedPath,
                        geodesic: true,
                        strokeColor: '#FF0000',  // Red color for the special route
                        strokeOpacity: 1.0,
                        strokeWeight: 4,
                        map: map
                    });

                    // Adjust map bounds to show the entire route
                    const bounds = new google.maps.LatLngBounds();
                    decodedPath.forEach(point => bounds.extend(point));
                    map.fitBounds(bounds);
                } else {
                    // For the main route, use the default color
                    mainRoutePolyline = new google.maps.Polyline({
                        path: decodedPath,
                        geodesic: true,
                        strokeColor: '#4285F4', // Blue color for the main route
                        strokeOpacity: 1.0,
                        strokeWeight: 4,
                        map: map
                    });

                    // Adjust map bounds to show the entire route
                    const bounds = new google.maps.LatLngBounds();
                    decodedPath.forEach(point => bounds.extend(point));
                    map.fitBounds(bounds);
                }
            }
        } else {
            throw new Error('No routes found');
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        alert('Could not calculate route: ' + error.message);
        
        // Fall back to a simpler approach as a last resort
        fallbackDrawPolyline();
    }
}


// Fallback function to draw a simple route if all else fails
function fallbackDrawPolyline(routeMarkers) {
    if (mainRoutePolyline) {
        mainRoutePolyline.setMap(null);
    }
    
    // Create a path between all markers in order
    const path = routeMarkers.map(marker => marker.getPosition());
    
    // Draw a simple polyline
    mainRoutePolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: map
    });
    
    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    map.fitBounds(bounds);
    
    // Calculate straight-line distances
    let totalDistance = 0;
    for (let i = 0; i < path.length - 1; i++) {
        totalDistance += google.maps.geometry.spherical.computeDistanceBetween(path[i], path[i+1]);
    }
    
    document.getElementById('result').innerHTML = `
        <p><strong>FALLBACK MODE: Using straight-line distance</strong></p>
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

document.getElementById("addDataBtn").addEventListener("click", async () => {
    // Example of collection name and data to add
    const collectionName = "exampleCollection"; // Replace with your actual collection name
    const data = { name: "John Doe", age: 30 }; // Replace with the actual data you want to add
    
    const result = await window.firebaseAPI.addData(collectionName, data);
    if (result.success) {
        alert("Document added with ID: " + result.id);
    } else {
        alert("Error: " + result.error);
    }
});

window.initMap = initMap;