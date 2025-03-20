window.onload = () => {
    // Check if Google Maps is defined
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error('Google Maps API failed to load');
        return;
    }

    console.log('Google Maps API loaded successfully');

    // Initialize the map
    initMap();

    // Request global data from the main process
    window.electron.requestGlobalData();
};

// Initialize Google Map
function initMap() {
    // Log that we're trying to initialize the map
    console.log('Initializing map...');

    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -34.397, lng: 150.644 }, // Default location
        zoom: 8,
    });

    if (!map) {
        console.error('Failed to initialize map');
        return;
    }

    console.log('Map initialized successfully');

    // Add a click event to log map coordinates
    map.addListener('click', (e) => {
        console.log('Map clicked at: ', e.latLng.lat(), e.latLng.lng());
    });

    // Add marker button click event
    document.getElementById('addMarker').addEventListener('click', () => {
        addMarker({ lat: -34.397, lng: 150.644 });
    });
}

// Add a marker at a specific location
function addMarker(position) {
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: 'Hello World!',
    });

    marker.addListener('click', () => {
        alert('Marker clicked!');
    });
}

// Listen for the global data sent from the main process
window.electron.onReceiveGlobalData((event, data) => {
    console.log('Received global data:', data);
});
import { db } from "./firebase.js";
import { collection, getDocs, addDoc } from "firebase/firestore";

// Fetch data from Firestore
async function fetchData() {
    const querySnapshot = await getDocs(collection(db, "test"));
    querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
    });
}

// Add data to Firestore
async function addData() {
    await addDoc(collection(db, "test"), {
        name: "Sample Data",
        createdAt: new Date()
    });
}

fetchData();
addData();
