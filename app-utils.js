// app-utils.js
import {
    getMap, getGeocoder, getInfoWindow, getRouteMarkers,
    getSpecialMarkers, getSpecialRoutePolylines,
    getSelectedRouteIndex, getRoutePolylines, getRouteData, getSpecialMarkerMode, 
    getMaxWalkDuration,
    setRoutePolylineAtIndex, setSpecialRoutePolylineAtIndex,
    setSelectedRouteIndex, updateRouteDataStationsCount, // setSelectedRouteIndex is here
    removeSpecialMarker
} from './app-state.js';
import { getAllRoutes } from './api.js'; // Assuming api.js is a sibling module

const test_markers = [
    { lat: 38.46595521912682, lng: 27.351150512695312 },
    { lat: 38.45119988839858, lng: 27.24231719970703 },
    { lat: 38.444967505761575, lng: 27.203536406792217 },
    { lat: 38.466475687372274 , lng: 27.186370269096905 },
    { lat: 38.46524998199707 , lng: 27.206427099470964 },
    { lat: 38.471163708279626, lng: 27.11990976548659 },
    { lat: 38.46847571099811, lng: 27.164541723494402 }
];

/**
 * Helper function to remove a marker from a specific route.
 * @param {google.maps.Marker} marker - The marker object to remove.
 * @param {number} routeIdx - The index of the route the marker belongs to (0+ for DB routes).
 * @returns {boolean} - Whether the marker was successfully removed.
 * @private
 */
export function removeMarker(marker, routeIdx) {
    let targetMarkersArray;
    let targetPolyline;
    let routeDivSelector;
    const routeMarkers = getRouteMarkers();
    const routePolylines = getRoutePolylines();
    const routeData = getRouteData();

    if (routeIdx >= 0 && routeIdx < routeMarkers.length) {
        targetMarkersArray = routeMarkers[routeIdx];
        targetPolyline = routePolylines[routeIdx];
        routeDivSelector = `.route-info.db-route-${routeIdx}`;
    } else {
        return false; // Invalid route index
    }

    const index = targetMarkersArray.indexOf(marker);

    if (index === -1) return false; // Marker not found in this route

    // Remove the marker from the map
    marker.setMap(null);

    // Remove from the specific route's markers array
    routeMarkers[routeIdx].splice(index, 1);

    // Update labels for remaining markers in this route
    updateMarkerLabels(targetMarkersArray);

    // Update route data station count
    if (routeData[routeIdx]) {
        updateRouteDataStationsCount(routeIdx, targetMarkersArray.length);
    }

    // Recalculate route if needed
    if (targetMarkersArray.length > 1) {
        calculateRouteForIndex(routeIdx);
    } else { // Not enough markers to draw a route
        if (targetPolyline) {
            targetPolyline.setMap(null);
            setRoutePolylineAtIndex(routeIdx, null);
        }
        // Also remove its info from the result panel
        const routeDiv = document.querySelector(routeDivSelector);
        if (routeDiv) routeDiv.remove();
    }

    // Update routes list
    updateRoutesList();
    // Update places list for the affected route
    updatePlacesListForRoute();

    return true;
}

/**
 * Updates the labels for all markers in a given route after a removal.
 * @param {Array<google.maps.Marker>} markersArray - The array of markers for a specific route.
 * @private
 */
export function updateMarkerLabels(markersArray) {
    markersArray.forEach((marker, i) => {
        marker.setLabel((i + 1).toString());
    });
}

/**
 * Generates HTML content for a marker, including its address.
 * @param {google.maps.LatLng} location - The geographic coordinates of the marker.
 * @param {number} index - The index of the marker in its respective array.
 * @param {boolean} [isSpecialMarker=false] - True if this is a special marker.
 * @param {number} [routeIdx=-1] - The index of the route (0+ for DB routes).
 * @returns {Promise<string>} - A promise that resolves with the HTML string for the marker's info.
 * @private
 */
export async function getMarkerInfoHtml(location, index, isSpecialMarker = false, routeIdx = -1) {
    const geocoder = getGeocoder();
    return new Promise((resolve) => {
        geocoder.geocode({ location }, (results, status) => {
            const address = status === 'OK' && results[0]
                ? results[0].formatted_address
                : 'Address not found';

            let markerLabel;
            if (isSpecialMarker) {
                markerLabel = `Special Marker ${index + 1}`; // Label as "Special Marker 1", "Special Marker 2", etc.
            } else { // It's a DB route marker
                markerLabel = `Marker ${index + 1}`;
            }

            const htmlContent = `
                <div class="marker-item">
                    <strong>${markerLabel}</strong><br>
                    Lat: ${location.lat().toFixed(6)}<br>
                    Lng: ${location.lng().toFixed(6)}<br>
                    Address: ${address}
                </div>
            `;
            resolve(htmlContent);
        });
    });
}


/**
 * Updates the entire places list for all markers on the map within their respective route info divs.
 * This also includes displaying all special markers in a dedicated section.
 * @private
 */
export async function updatePlacesListForRoute() {
    const routeMarkers = getRouteMarkers(); // DB route markers
    const specialMarkers = getSpecialMarkers(); // All special markers

    // Clear all existing marker lists within route info divs
    document.querySelectorAll('.route-info .places-sublist').forEach(list => list.innerHTML = '');

    // Get or create the special markers container
    let specialMarkersPanel = document.getElementById('special-markers-panel');
    if (!specialMarkersPanel) {
        specialMarkersPanel = document.createElement('div');
        specialMarkersPanel.id = 'special-markers-panel';
        specialMarkersPanel.className = 'panel';
        specialMarkersPanel.innerHTML = '<h3>Passenger Addresses</h3><div id="special-markers-list" class="places-sublist"></div>';
        const resultContainer = document.getElementById('result');
        resultContainer.parentNode.insertBefore(specialMarkersPanel, resultContainer);
    }
    const specialMarkersList = document.getElementById('special-markers-list');
    specialMarkersList.innerHTML = ''; // Clear previous special markers

    // Update special marker info if it exists
    if (specialMarkers.length > 0) {
        specialMarkersPanel.style.display = 'block'; // Ensure panel is visible
        for (let i = 0; i < specialMarkers.length; i++) {
            const specialMarker = specialMarkers[i];
            const html = await getMarkerInfoHtml(specialMarker.getPosition(), i, true);
            const markerDiv = document.createElement('div');
            markerDiv.innerHTML = html;

            const removeButton = document.createElement('button');
            removeButton.className = 'marker-remove-btn';
            removeButton.textContent = 'Remove Passenger';
            removeButton.onclick = () => {
                removeSpecialMarker(i); // Call remove from app-state.js
            };
            markerDiv.querySelector('.marker-item').appendChild(removeButton); // Append button to marker item
            specialMarkersList.appendChild(markerDiv);
        }
    } else {
        specialMarkersPanel.style.display = 'none'; // Hide panel if no special markers
    }

    // Update DB route markers
    for (let routeIdx = 0; routeIdx < routeMarkers.length; routeIdx++) {
        const dbRouteDiv = document.querySelector(`.route-info.db-route-${routeIdx}`);
        if (dbRouteDiv) {
            let dbRouteMarkerList = dbRouteDiv.querySelector('.places-sublist');
            if (!dbRouteMarkerList) {
                dbRouteMarkerList = document.createElement('div');
                dbRouteMarkerList.className = 'places-sublist';
                dbRouteDiv.appendChild(dbRouteMarkerList);
            }
            if (routeMarkers[routeIdx] && routeMarkers[routeIdx].length > 0) {
                dbRouteMarkerList.innerHTML = '<h4>Markers:</h4>'; // Add a header for markers
                for (let i = 0; i < routeMarkers[routeIdx].length; i++) {
                    dbRouteMarkerList.innerHTML += await getMarkerInfoHtml(routeMarkers[routeIdx][i].getPosition(), i, false, routeIdx);
                }
            } else {
                dbRouteMarkerList.innerHTML = ''; // Clear if no markers
            }
        }
    }
}


/**
 * Helper function to calculate the straight-line distance between two coordinates.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lng1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lng2 - Longitude of the second point.
 * @returns {number} - The distance in meters.
 * @private
 */
export function getDistanceBetweenCoords(lat1, lng1, lat2, lng2) {
    const point1 = new google.maps.LatLng(lat1, lng1);
    const point2 = new google.maps.LatLng(lat2, lng2);

    return google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
}

/**
 * Helper function to calculate the route distance between two markers using the Routes API.
 * @param {google.maps.Marker} marker1 - The first marker object.
 * @param {google.maps.Marker} marker2 - The second marker object.
 * @param {string} [travelMode='DRIVE'] - The travel mode (e.g., 'DRIVE', 'WALK', 'BICYCLE').
 * @returns {Promise<number>} - A promise that resolves with the distance in meters.
 * @throws {Error} If markers are invalid or API key is missing.
 * @private
 */
export async function calculateRouteDistanceMarkers(marker1, marker2, travelMode = 'DRIVE') {
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

/**
 * Helper function to calculate the route distance between two coordinates using the Routes API.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lng1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lng2 - Longitude of the second point.
 * @param {string} [travelMode='DRIVE'] - The travel mode (e.g., 'DRIVE', 'WALK', 'BICYCLE').
 * @returns {Promise<number>} - A promise that resolves with the distance in meters.
 * @throws {Error} If coordinates are invalid or API key is missing.
 * @private
 */
export async function calculateRouteDistanceCoords(lat1, lng1, lat2, lng2, travelMode = 'DRIVE') {
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


/**
 * Helper function to find the closest regular route marker to a given marker across ALL DB routes.
 * @param {google.maps.Marker} referenceMarker - The marker from which to find the closest.
 * @param {Array<Array<google.maps.Marker>>} dbRoutesMarkers - An array of arrays of markers for all DB routes.
 * @returns {google.maps.Marker|null} - The closest marker or null if none found.
 * @private
 */
export function findClosestMarkerInAllRoutes(referenceMarker, dbRoutesMarkers) {
    if (!referenceMarker) return null;

    let closestMarker = null;
    let closestDistance = Infinity;
    const referencePosition = referenceMarker.getPosition();

    // Check all DB route markers
    dbRoutesMarkers.forEach(routeArray => {
        routeArray.forEach(marker => {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(referencePosition, marker.getPosition());
            if (distance < closestDistance) {
                closestDistance = distance;
                closestMarker = marker;
            }
        });
    });

    return closestMarker;
}


/**
 * Calculates and draws a route on the map using Google's Routes API.
 * @param {Array<google.maps.Marker>} routeMarkers - An array of marker objects defining the route.
 * @param {boolean} [isSpecialRoute=false] - True if this is for a special marker's route.
 * @param {string} [routeColor='#4285F4'] - The color of the polyline.
 * @param {number} [routeIndex=-1] - The index of the route if it's a DB route (0+), or the index within specialMarkers array if isSpecialRoute is true.
 * @private
 */
export async function calculateRoute(routeMarkers, isSpecialRoute = false, routeColor = '#4285F4', routeIndex = -1) {
    const map = getMap();
    const routePolylines = getRoutePolylines();
    const specialRoutePolylines = getSpecialRoutePolylines();
    const routeData = getRouteData();

    if (routeMarkers.length < 2) {
        // Only alert if it's not a special route (which might temporarily have <2 if the special marker is the only one)
        if (!isSpecialRoute) {
            alert('Please add at least two markers to the route to calculate.');
        }

        // Clear existing polyline
        if (routeIndex >= 0 && routePolylines[routeIndex]) { // DB route
            routePolylines[routeIndex].setMap(null);
            setRoutePolylineAtIndex(routeIndex, null);
            const routeDiv = document.querySelector(`.route-info.db-route-${routeIndex}`);
            if (routeDiv) routeDiv.remove();
        } else if (isSpecialRoute && specialRoutePolylines[routeIndex]) { // Clear specific special route polyline
            specialRoutePolylines[routeIndex].setMap(null);
            setSpecialRoutePolylineAtIndex(routeIndex, null);
            // Special route info is part of the overall places list, no separate div to remove
        }
        await updatePlacesListForRoute(); // Ensure marker lists are updated after route removal
        return;
    }

    try {
        // Clear appropriate existing polyline based on route type and index
        if (isSpecialRoute) {
            if (specialRoutePolylines[routeIndex]) {
                specialRoutePolylines[routeIndex].setMap(null);
                setSpecialRoutePolylineAtIndex(routeIndex, null);
            }
        } else if (routeIndex >= 0) {
            if (routePolylines[routeIndex]) {
                routePolylines[routeIndex].setMap(null);
                setRoutePolylineAtIndex(routeIndex, null);
            }
        }

        // Extract API key from the Google Maps script tag
        const scriptTag = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        const scriptSrc = scriptTag ? scriptTag.src : '';
        const keyMatch = scriptSrc.match(/[?&]key=([^&]*)/);
        const apiKey = keyMatch ? keyMatch[1] : '';

        if (!apiKey) {
            throw new Error('Google Maps API key not found');
        }

        // Determine travel mode
        const travelMode = isSpecialRoute ? "WALK" : "DRIVE"; // [Change 1] Travel mode for special routes is WALK

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
            travelMode: travelMode, // Use the determined travel mode
            // Conditionally add routingPreference based on travelMode
            ...(travelMode === "DRIVE" || travelMode === "TWO_WHEELER" ? { routingPreference: "TRAFFIC_AWARE" } : {}), // Conditionally include routingPreference
            optimizeWaypointOrder: true,
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

        const routeDataResponse = JSON.parse(responseText); // Renamed to avoid conflict with global routeData

        if (routeDataResponse.routes && routeDataResponse.routes.length > 0) {
            const route = routeDataResponse.routes[0];

            // Extract route information
            const totalDistance = parseInt(route.distanceMeters || 0);
            const totalDuration = parseInt(route.duration?.replace('s', '') || 0); // Duration in seconds

            // If it's a special route and duration is over 15 minutes, change color to red
            if (isSpecialRoute && totalDuration > (getMaxWalkDuration() * 60)) { // 15 minutes in seconds
                routeColor = '#FF0000'; // Red color
            }

            // Use the correct field name for optimized waypoint indices
            const waypointOrder = route.optimized_intermediate_waypoint_index || [];

            // Append results for each route to the result section
            const resultContainer = document.getElementById('result');

            // Determine route label based on type
            let routeLabel;
            if (isSpecialRoute) {
                routeLabel = `Special Route ${routeIndex + 1}`;
            } else if (routeIndex >= 0) {
                routeLabel = `Route ${routeIndex + 1}`;
            }

            // Generate a unique class for this route
            const routeClass = isSpecialRoute ? 'special-route' : `db-route-${routeIndex}`;

            // Check if the route already exists (using a unique ID or class)
            let routeDiv = document.querySelector(`.route-info.${routeClass}`);

            if (!routeDiv || isSpecialRoute) { // For special routes, we don't create a separate div per route anymore, but update the general special markers panel
                // The special route info is now managed within updatePlacesListForRoute
                // For DB routes, create a new div if it's not an existing one
                if (!isSpecialRoute) {
                    routeDiv = document.createElement('div');
                    routeDiv.className = `route-info ${routeClass}`;
                    resultContainer.appendChild(routeDiv);
                }
            }

            // Update the route info, including a new container for markers
            if (!isSpecialRoute) { // Only update these panels for DB routes
                routeDiv.innerHTML = `
                    <strong>${routeLabel}</strong><br>
                    <p>Total distance: ${(totalDistance / 1000).toFixed(2)} km</p>
                    <p>Total duration: ${Math.floor(totalDuration / 60)} minutes ${totalDuration % 60} seconds</p>
                    <p>Stations count: ${routeMarkers.length}</p>
                    ${waypointOrder.length > 0 ? `<p>Optimized waypoint order: ${waypointOrder.join(', ')}</p>` : '<p>Direct route calculated.</p>'}
                    <div class="places-sublist"></div> `;
            }


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
                    map: map,
                    zIndex: 1
                });

                // Add click handler to the polyline
                google.maps.event.addListener(polyline, 'click', function() {
                    if (isSpecialRoute) {
                        // Don't make special routes selectable via clicking their polylines
                        return;
                    } else if (routeIndex >= 0) {
                        selectRoute(routeIndex);
                    }
                });

                // Store the polyline based on route type
                if (isSpecialRoute) {
                    setSpecialRoutePolylineAtIndex(routeIndex, polyline); // Store in the special polylines array
                } else if (routeIndex >= 0) {
                    setRoutePolylineAtIndex(routeIndex, polyline);

                    // Update route data with calculated info
                    if (routeData[routeIndex]) {
                        routeData[routeIndex].distance = totalDistance;
                        routeData[routeIndex].duration = totalDuration;
                    }
                }

                // Adjust map bounds to show the entire route
                const bounds = new google.maps.LatLngBounds();
                decodedPath.forEach(point => bounds.extend(point));
                map.fitBounds(bounds);

                // Update routes list
                updateRoutesList();

                // IMPORTANT: Update the marker list for this route after it's rendered
                await updatePlacesListForRoute();

            }
        } else {
            throw new Error('No routes found');
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        alert('Could not calculate route: ' + error.message);

        // Fall back to a simpler approach as a last resort
        fallbackDrawPolyline(routeMarkers, routeColor, routeIndex, isSpecialRoute); // Pass isSpecialRoute to fallback
    }
}


/**
 * Fallback function to draw a simple route if Google Routes API fails.
 * @param {Array<google.maps.Marker>} routeMarkers - An array of marker objects.
 * @param {string} [routeColor='#FF0000'] - The color of the polyline.
 * @param {number} [routeIndex=-1] - The index of the route if it's a DB route (0+), or the index within specialMarkers array if isSpecialRoute is true.
 * @param {boolean} [isSpecialRoute=false] - True if this is for a special marker's route.
 * @private
 */
export async function fallbackDrawPolyline(routeMarkers, routeColor = '#FF0000', routeIndex = -1, isSpecialRoute = false) {
    const map = getMap();
    const routePolylines = getRoutePolylines();
    const specialRoutePolylines = getSpecialRoutePolylines();

    // Clear appropriate polyline
    if (isSpecialRoute) {
        if (specialRoutePolylines[routeIndex]) {
            specialRoutePolylines[routeIndex].setMap(null);
        }
    } else if (routeIndex >= 0 && routePolylines[routeIndex]) {
        routePolylines[routeIndex].setMap(null);
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
        map: map,
        zIndex: 1
    });

    // Add click handler to the polyline
    google.maps.event.addListener(polyline, 'click', function() {
        if (isSpecialRoute) {
            // Don't make special routes selectable via clicking their polylines
            return;
        } else if (routeIndex >= 0) {
            selectRoute(routeIndex);
        }
    });

    // Store the polyline appropriately
    if (isSpecialRoute) {
        setSpecialRoutePolylineAtIndex(routeIndex, polyline);
    } else if (routeIndex >= 0) {
        setRoutePolylineAtIndex(routeIndex, polyline);
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
    const routeLabel = isSpecialRoute ? `Special Route ${routeIndex + 1}` : `Route ${routeIndex + 1}`;
    const routeClass = isSpecialRoute ? 'special-route' : `db-route-${routeIndex}`;

    // Add or update result information
    const resultContainer = document.getElementById('result');
    let routeDiv = document.querySelector(`.route-info.${routeClass}`);

    if (!isSpecialRoute) { // Only add/update specific divs for DB routes
        if (!routeDiv) {
            routeDiv = document.createElement('div');
            routeDiv.className = `route-info ${routeClass}`;
            resultContainer.appendChild(routeDiv);
        }

        routeDiv.innerHTML = `
            <strong>${routeLabel} (FALLBACK MODE)</strong><br>
            <p>Total distance: ${(totalDistance / 1000).toFixed(2)} km</p>
            <p>Stations count: ${routeMarkers.length}</p>
            <p>Note: This is an approximation; optimization not available in fallback mode.</p>
            <div class="places-sublist"></div> `;
    }

    // Update routes list
    updateRoutesList();

    // IMPORTANT: Update the marker list for this route after it's rendered
    await updatePlacesListForRoute();
}

/**
 * Helper function to decode polyline.
 * @param {string} encodedPolyline - The encoded polyline string.
 * @returns {Array<google.maps.LatLng>} - An array of LatLng objects.
 * @private
 */
export function decodePolyline(encodedPolyline) {
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

/**
 * Creates the container for the routes list in the UI.
 * @private
 */
export function createRoutesListContainer() {
    let routesListContainer = document.getElementById('routes-list-container');
    if (!routesListContainer) {
        routesListContainer = document.createElement('div');
        routesListContainer.id = 'routes-list-container';
        routesListContainer.className = 'panel';
        routesListContainer.innerHTML = '<h3>Available Routes</h3><div id="routes-list"></div>';

        // Insert the container before the result div
        const resultContainer = document.getElementById('result');
        resultContainer.parentNode.insertBefore(routesListContainer, resultContainer);

        // Populate the routes list
        updateRoutesList();
    }
}

/**
 * Updates the routes list in the UI.
 * @private
 */
export function updateRoutesList() {
    const routesList = document.getElementById('routes-list');
    if (!routesList) return;

    routesList.innerHTML = '';

    const selectedRouteIndex = getSelectedRouteIndex();
    const routeData = getRouteData();

    // Add each database route
    routeData.forEach((route, index) => {
        const routeItem = document.createElement('div');
        routeItem.className = 'route-list-item' + (selectedRouteIndex === index ? ' selected' : '');
        routeItem.innerHTML = `<strong>${route.name}</strong> (${route.stationsCount} stations)`;
        routeItem.addEventListener('click', () => selectRoute(index));
        routesList.appendChild(routeItem);
    });

    // Add CSS to the document if it doesn't exist
    addRoutesListStyles();
}

/**
 * Adds CSS styles for the routes list to the document.
 * @private
 */
export function addRoutesListStyles() {
    if (!document.getElementById('routes-list-styles')) {
        const style = document.createElement('style');
        style.id = 'routes-list-styles';
        style.textContent = `
            #routes-list-container, #special-markers-panel {
                margin-bottom: 20px;
                background-color: #f8f9fa;
                border-radius: 4px;
                padding: 15px;
            }
            #routes-list-container h3, #special-markers-panel h3 {
                margin-top: 0;
                margin-bottom: 10px;
            }
            .route-list-item {
                padding: 10px;
                border-radius: 4px;
                margin-bottom: 5px;
                background-color: #fff;
                border: 1px solid #ddd;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .route-list-item:hover {
                background-color: #f1f1f1;
            }
            .route-list-item.selected {
                background-color: #e3f2fd;
                border-color: #2196F3;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .route-info {
                display: none;
                padding: 15px;
                margin-bottom: 10px;
                background-color: #fff;
                border-radius: 4px;
                border: 1px solid #ddd;
                overflow: auto; /* Enable scrolling if content overflows */
                max-height: 400px; /* Example max height */
            }
            .route-info.active {
                display: block;
                animation: fadeIn 0.3s;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .places-sublist {
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid #eee;
            }
            .places-sublist h4 {
                margin-top: 0;
                margin-bottom: 10px;
                color: #555;
            }
            .marker-item {
                background-color: #f1f8e9; /* Light green background */
                border: 1px solid #c8e6c9; /* Green border */
                border-radius: 4px;
                padding: 8px;
                margin-bottom: 8px;
                font-size: 0.9em;
            }
            #special-markers-list .marker-item {
                background-color: #ffe0b2; /* Light orange for special markers */
                border-color: #ffcc80; /* Orange border */
            }
            .marker-remove-btn {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 8px;
                font-weight: bold;
            }
            .marker-remove-btn:hover {
                background-color: #d32f2f;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Function to select a route and display its information.
 * @param {number} index - The index of the route to select (0+ for DB routes).
 * @private
 */
export async function selectRoute(index) {
    const specialRoutePolylines = getSpecialRoutePolylines();
    const selectedRouteIndex = getSelectedRouteIndex();
    const routePolylines = getRoutePolylines();
    const routeMarkers = getRouteMarkers();

    // Clear all special route polylines when switching routes
    specialRoutePolylines.forEach(polyline => {
        if (polyline) polyline.setMap(null);
    });

    // Unhighlight the previous route
    if (selectedRouteIndex >= 0 && routePolylines[selectedRouteIndex]) {
        routePolylines[selectedRouteIndex].setOptions({
            strokeWeight: 4,
            strokeOpacity: 1.0,
            zIndex: 1
        });
    }

    // Update the selected route index
    setSelectedRouteIndex(index);

    // Highlight the new selected route
    const map = getMap();
    if (index >= 0 && routePolylines[index]) {
        routePolylines[index].setOptions({
            strokeWeight: 6,
            strokeOpacity: 1.0,
            zIndex: 10
        });

        // Zoom to the selected route
        const bounds = new google.maps.LatLngBounds();
        if (routeMarkers[index]) {
            routeMarkers[index].forEach(marker => {
                bounds.extend(marker.getPosition());
            });
            map.fitBounds(bounds);
        }
    }

    // Update the route list UI
    updateRoutesList();

    // Show the selected route info
    await showRouteInfo(index);
    // Update the places list to reflect the current state (including special markers)
    await updatePlacesListForRoute();
}

/**
 * Shows the information for the selected route in the UI.
 * @param {number} index - The index of the route to show info for (0+ for DB routes).
 * @private
 */
export async function showRouteInfo(index) {
    // Hide all route info divs
    const allRouteInfos = document.querySelectorAll('.route-info');
    allRouteInfos.forEach(div => {
        div.classList.remove('active');
    });

    // Show the selected route info
    let routeInfoSelector;
    if (index >= 0) {
        routeInfoSelector = `.route-info.db-route-${index}`;
    } else {
        return; // No valid DB route selected
    }

    const selectedRouteInfo = document.querySelector(routeInfoSelector);
    if (selectedRouteInfo) {
        selectedRouteInfo.classList.add('active');
    }
}

/**
 * Calculates and draws a route for a specific route index.
 * @param {number} routeIndex - The index of the route to calculate.
 * @private
 */
export function calculateRouteForIndex(routeIndex) {
    const routeMarkers = getRouteMarkers();
    if (routeIndex < 0 || routeIndex >= routeMarkers.length) return;

    const currentRouteMarkers = routeMarkers[routeIndex];
    if (currentRouteMarkers.length < 2) return;

    // Use a custom color for each route based on index
    const routeColors = [
        '#4285F4', // Blue
        '#F4B400', // Yellow
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

/**
 * Shows an info window for a marker with the option to remove it.
 * @param {google.maps.Marker} marker - The marker to show info for.
 * @param {number} routeIndex - Route index (-1 for special marker, 0+ for DB routes).
 * @param {number} markerIndex - Marker index within its collection.
 * @param {boolean} isSpecial - Whether this is a special marker.
 * @private
 */
export function showMarkerInfoWindow(marker, routeIndex, markerIndex, isSpecial = false) {
    const infoWindow = getInfoWindow();
    const position = marker.getPosition();
    const geocoder = getGeocoder();

    geocoder.geocode({ location: position }, (results, status) => {
        const address = status === 'OK' && results[0]
            ? results[0].formatted_address
            : 'Address not found';

        // Determine the marker type and label
        let markerTypeLabel;
        if (isSpecial) {
            markerTypeLabel = `Special Marker ${markerIndex + 1}`;
        } else if (routeIndex >= 0) {
            markerTypeLabel = `Route ${routeIndex + 1}, Marker ${markerIndex + 1}`;
        }

        // Create info window content with remove button
        const content = document.createElement('div');
        content.innerHTML = `
            <div>
                <strong>${markerTypeLabel}</strong><br>
                Lat: ${position.lat().toFixed(6)}<br>
                Lng: ${position.lng().toFixed(6)}<br>
                Address: ${address}
            </div>
        `;

        // Add remove button (only if it's a marker within a DB route or special marker)
        if (isSpecial || routeIndex >= 0) {
            const removeButton = document.createElement('button');
            removeButton.className = 'marker-remove-btn';
            removeButton.textContent = 'Remove Marker';
            removeButton.onclick = () => {
                infoWindow.close();
                if (isSpecial) {
                    removeSpecialMarker(markerIndex);
                } else {
                    removeMarker(marker, routeIndex);
                }
            };
            content.appendChild(removeButton);
        }

        // Show the info window
        infoWindow.setContent(content);
        infoWindow.open(getMap(), marker);
    });
}

/**
 * Fetches and transforms database stops into a consistent marker format.
 * @returns {Promise<Array<Object>>} - A promise that resolves with an array of route objects, each containing markers.
 * @private
 */
export async function getDatabaseMarkers() {
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