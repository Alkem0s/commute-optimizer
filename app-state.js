// app-state.js

let map = null;
let routeMarkers = []; // Array to store arrays of markers for each route (DB Routes)
let routePolylines = []; // Array to store polylines for each route
let routeData = []; // Array to store route data for each route

let specialMarkers = []; // Array to store multiple special marker instances
let specialRoutePolylines = []; // Array to store polylines for each special marker's route
let specialMarkerMode = false; // Flag to toggle special marker mode for map clicks

let geocoder = null;
let infoWindow = null;
let selectedRouteIndex = -1; // -1 means no route is selected, 0+ means a DB route is selected

let maxWalkDuration = 10; // Maximum walk duration for the route in minutes, used in route calculations

// Getter functions
export const getMap = () => map;
export const getRouteMarkers = () => routeMarkers;
export const getRoutePolylines = () => routePolylines;
export const getRouteData = () => routeData;

export const getSpecialMarkers = () => specialMarkers;
export const getSpecialRoutePolylines = () => specialRoutePolylines;
export const getSpecialMarkerMode = () => specialMarkerMode; // New getter for the mode

export const getGeocoder = () => geocoder;
export const getInfoWindow = () => infoWindow;
export const getSelectedRouteIndex = () => selectedRouteIndex;

export const getMaxWalkDuration = () => maxWalkDuration; // Getter for max walk duration

// Setter functions
export const setMap = (newMap) => { map = newMap; };
export const setRouteMarkers = (newRouteMarkers) => { routeMarkers = newRouteMarkers; };
export const setRoutePolylines = (newRoutePolylines) => { routePolylines = newRoutePolylines; };
export const setRouteData = (newRouteData) => { routeData = newRouteData; };

export const setSpecialMarkers = (newSpecialMarkers) => { specialMarkers = newSpecialMarkers; };
export const setSpecialRoutePolylines = (newSpecialRoutePolylines) => { specialRoutePolylines = newSpecialRoutePolylines; };
export const setSpecialMarkerMode = (mode) => { specialMarkerMode = mode; }; // New setter for the mode

export const setGeocoder = (newGeocoder) => { geocoder = newGeocoder; };
export const setInfoWindow = (newInfoWindow) => { infoWindow = newInfoWindow; };
export const setSelectedRouteIndex = (index) => { selectedRouteIndex = index; };

export const setMaxWalkDuration = (duration) => {
    if (typeof duration === 'number' && duration >= 0) {
        maxWalkDuration = duration;
    } else {
        console.error('Invalid max walk duration:', duration);
    }
}

/**
 * Resets all application state to initial values
 * @public
 */
export function resetAppState() {
    // Clear all markers
    routeMarkers.length = 0;
    specialMarkers.length = 0;
    specialRoutePolylines.length = 0;
    routePolylines.length = 0;
    routeData.length = 0;
    
    // Reset other state
    selectedRouteIndex = -1;
    specialMarkerMode = false;
    
    // Clear map references
    map = null;
    geocoder = null;
    infoWindow = null;
}

// Functions to modify arrays
export const addMarkerToRoute = (routeIndex, marker) => {
    if (!routeMarkers[routeIndex]) {
        routeMarkers[routeIndex] = [];
    }
    routeMarkers[routeIndex].push(marker);
};
export const removeMarkerFromRoute = (routeIndex, index) => {
    if (routeMarkers[routeIndex]) {
        routeMarkers[routeIndex].splice(index, 1);
    }
};
export const addRouteMarkerArray = (markerArray) => { routeMarkers.push(markerArray); };
export const addRouteDataItem = (dataItem) => { routeData.push(dataItem); };
export const updateRouteDataStationsCount = (routeIndex, count) => {
    if (routeData[routeIndex]) {
        routeData[routeIndex].stationsCount = count;
    }
};
export const setRoutePolylineAtIndex = (index, polyline) => { routePolylines[index] = polyline; };

/**
 * Adds a special marker to the specialMarkers array.
 * @param {google.maps.Marker} marker - The special marker to add.
 */
export const addSpecialMarker = (marker) => {
    specialMarkers.push(marker);
};

/**
 * Removes a special marker from the specialMarkers array by its index.
 * @param {number} index - The index of the special marker to remove.
 * @returns {boolean} - True if the marker was removed, false otherwise.
 */
export const removeSpecialMarker = (index) => {
    if (index >= 0 && index < specialMarkers.length) {
        const marker = specialMarkers[index];
        if (marker) {
            marker.setMap(null); // Remove from map
        }
        specialMarkers.splice(index, 1);

        // Remove the corresponding polyline if it exists
        if (specialRoutePolylines[index]) {
            specialRoutePolylines[index].setMap(null);
            specialRoutePolylines.splice(index, 1);
        }
        return true;
    }
    return false;
};

/**
 * Sets the polyline for a specific special marker.
 * @param {number} index - The index of the special marker.
 * @param {google.maps.Polyline} polyline - The polyline for the special marker's route.
 */
export const setSpecialRoutePolylineAtIndex = (index, polyline) => {
    specialRoutePolylines[index] = polyline;
};

/**
 * Clears all special markers and their polylines from the map and state.
 */
export const clearSpecialMarkers = () => {
    specialMarkers.forEach(marker => marker.setMap(null));
    specialRoutePolylines.forEach(polyline => {
        if (polyline) {
            polyline.setMap(null);
        }
    });
    specialMarkers = [];
    specialRoutePolylines = [];
};