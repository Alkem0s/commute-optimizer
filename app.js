let map;
let markers = [];
let geocoder;
let currentRoutePolyline;
let infoWindow;

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

    document.getElementById('calculate-route').addEventListener('click', calculateOptimalRoute);
}

function addMarker(location) {
    const marker = new google.maps.Marker({
        position: location,
        map: map,
        draggable: true,
        label: (markers.length + 1).toString()
    });

    const index = markers.push(marker) - 1;

    marker.addListener('dragend', () => {
        updatePlacesList(marker.getPosition(), index);
        if (currentRoutePolyline) {
            currentRoutePolyline.setMap(null);
            currentRoutePolyline = null;
        }
    });

    updatePlacesList(location, index);
}

function updatePlacesList(location, index) {
    geocoder.geocode({ location }, (results, status) => {
        const placesList = document.getElementById('places-list');
        const address = status === 'OK' && results[0] 
            ? results[0].formatted_address 
            : 'Address not found';

        let placeItem = placesList.children[index];
        if (!placeItem) {
            placeItem = document.createElement('div');
            placeItem.className = 'place-item';
            placesList.appendChild(placeItem);
        }

        placeItem.innerHTML = `
            <strong>Marker ${index + 1}</strong><br>
            Lat: ${location.lat().toFixed(6)}<br>
            Lng: ${location.lng().toFixed(6)}<br>
            ${address}
        `;
    });
}

async function calculateOptimalRoute() {
    if (markers.length < 2) {
        alert('Please add at least two markers');
        return;
    }

    try {
        // Clear existing polyline if present
        if (currentRoutePolyline) {
            currentRoutePolyline.setMap(null);
            currentRoutePolyline = null;
        }

        // Extract API key from the Google Maps script tag
        const scriptTag = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
        const scriptSrc = scriptTag ? scriptTag.src : '';
        const keyMatch = scriptSrc.match(/[?&]key=([^&]*)/);
        const apiKey = keyMatch ? keyMatch[1] : '';

        if (!apiKey) {
            throw new Error('Google Maps API key not found');
        }

        console.log("Using API key: " + apiKey.substring(0, 4) + "...");

        // Create intermediates (waypoints) for the Routes API
        const intermediates = markers.slice(1, -1).map(marker => {
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
                        latitude: markers[0].getPosition().lat(),
                        longitude: markers[0].getPosition().lng()
                    }
                }
            },
            destination: {
                location: {
                    latLng: {
                        latitude: markers[markers.length - 1].getPosition().lat(),
                        longitude: markers[markers.length - 1].getPosition().lng()
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

        console.log("Request body:", JSON.stringify(requestBody, null, 2));

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
        console.log("API Response:", responseText);
        
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
            
            // Output results
            document.getElementById('result').innerHTML = `
                Total distance: ${(totalDistance / 1000).toFixed(2)} km<br>
                Total duration: ${Math.floor(totalDuration / 60)} minutes ${totalDuration % 60} seconds<br>
                ${waypointOrder.length > 0 ? `Optimized waypoint order: ${waypointOrder.join(', ')}` : 'Direct route calculated.'}
            `;
            
            // Draw the route on the map using a Polyline
            if (route.polyline && route.polyline.encodedPolyline) {
                const decodedPath = decodePolyline(route.polyline.encodedPolyline);
                
                currentRoutePolyline = new google.maps.Polyline({
                    path: decodedPath,
                    geodesic: true,
                    strokeColor: '#4285F4',
                    strokeOpacity: 1.0,
                    strokeWeight: 4,
                    map: map
                });
                
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
        fallbackDrawPolyline();
    }
}

// Fallback function to draw a simple route if all else fails
function fallbackDrawPolyline() {
    if (currentRoutePolyline) {
        currentRoutePolyline.setMap(null);
    }
    
    // Create a path between all markers in order
    const path = markers.map(marker => marker.getPosition());
    
    // Draw a simple polyline
    currentRoutePolyline = new google.maps.Polyline({
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

window.initMap = initMap;