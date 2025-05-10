import { initializeFirebase } from './firebase.js';
import { getAllPassengers, setPassenger, assignVehicleToRoute } from './api.js';

// Initialize Firebase first
await initializeFirebase();

// Now you can use the APIs
const passengers = await getAllPassengers();
console.log(passengers);