let map;
let specialMarkerMode = false;


window.onload = () => {
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        console.error('Google Maps API failed to load');
        return;
    }

    console.log('Google Maps API loaded successfully');

    initMap();

    window.electron.requestGlobalData();
};

function initMap() {
    console.log('Initializing map...');

    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: -34.397, lng: 150.644 },
        zoom: 8,
    });

    if (!map) {
        console.error('Failed to initialize map');
        return;
    }

    console.log('Map initialized successfully');

    map.addListener('click', (e) => {
        console.log('Map clicked at: ', e.latLng.lat(), e.latLng.lng());
    });

    document.getElementById('addMarker').addEventListener('click', () => {
        addMarker({ lat: -34.397, lng: 150.644 });
    });
}

function toggleSpecialMarkerMode() {
    specialMarkerMode = !specialMarkerMode;
    console.log(`Special Marker Mode: ${specialMarkerMode ? 'Enabled' : 'Disabled'}`);
    
    window.electron.sendToggleSpecialMarkerMode(specialMarkerMode);
}

function addMarker(position) {
    if (specialMarkerMode) {
        window.electron.sendAddSpecialMarker(position);
    } else {
        window.electron.sendAddRouteMarker(position);
    }
}

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
