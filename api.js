// api.js
import { getDb } from './firebase.js';
import { 
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where 
} from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';

const ROOT_COLLECTION = "COMMUTE_OPTIMIZER_COLLECTION";

// ================ PASSENGER OPERATIONS ================

/**
 * Gets all passengers from the database
 * @returns {Promise<Object>} Object containing all passengers
 */
export async function getAllPassengers() {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "PASSENGERS");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No passengers found!");
      return {};
    }
  } catch (error) {
    console.error("Error getting passengers:", error);
    throw error;
  }
}

/**
 * Gets a specific passenger by ID
 * @param {string} passengerId - ID of the passenger to retrieve
 * @returns {Promise<Array|null>} Passenger data or null if not found
 */
export async function getPassenger(passengerId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "PASSENGERS");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data[passengerId.toLowerCase()] || null;
    } else {
      console.log("No passengers document found!");
      return null;
    }
  } catch (error) {
    console.error("Error getting passenger:", error);
    throw error;
  }
}

/**
 * Adds a new passenger or updates an existing one
 * @param {string} passengerId - ID of the passenger
 * @param {Array} passengerData - Array of passenger data [routeId, address]
 * @returns {Promise<void>}
 */
export async function setPassenger(passengerId, passengerData) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "PASSENGERS");
    const docSnap = await getDoc(docRef);
    
    let data = {};
    if (docSnap.exists()) {
      data = docSnap.data();
    }
    
    // Update or add the passenger data
    data[passengerId.toLowerCase()] = passengerData;
    
    await setDoc(docRef, data);
    console.log(`Passenger ${passengerId} saved successfully!`);
  } catch (error) {
    console.error("Error saving passenger:", error);
    throw error;
  }
}

/**
 * Deletes a passenger from the database
 * @param {string} passengerId - ID of the passenger to delete
 * @returns {Promise<boolean>} True if successful, false if passenger not found
 */
export async function deletePassenger(passengerId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "PASSENGERS");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const lowercaseId = passengerId.toLowerCase();
      
      if (data[lowercaseId]) {
        delete data[lowercaseId];
        await setDoc(docRef, data);
        console.log(`Passenger ${passengerId} deleted successfully!`);
        return true;
      } else {
        console.log(`Passenger ${passengerId} not found!`);
        return false;
      }
    } else {
      console.log("No passengers document found!");
      return false;
    }
  } catch (error) {
    console.error("Error deleting passenger:", error);
    throw error;
  }
}

// ================ ROUTE OPERATIONS ================

/**
 * Gets all routes from the database
 * @returns {Promise<Object>} Object containing all routes
 */
export async function getAllRoutes() {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No routes found!");
      return {};
    }
  } catch (error) {
    console.error("Error getting routes:", error);
    throw error;
  }
}

/**
 * Gets a specific route by ID
 * @param {string} routeId - ID of the route to retrieve
 * @returns {Promise<Object|null>} Route data or null if not found
 */
export async function getRoute(routeId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data[routeId.toUpperCase()] || null;
    } else {
      console.log("No routes document found!");
      return null;
    }
  } catch (error) {
    console.error("Error getting route:", error);
    throw error;
  }
}

/**
 * Creates or updates a route
 * @param {string} routeId - ID of the route
 * @param {Object} routeData - Route data including stops, vehicle_id, and passenger_ids
 * @returns {Promise<void>}
 */
export async function setRoute(routeId, routeData) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    let data = {};
    if (docSnap.exists()) {
      data = docSnap.data();
    }
    
    // Update or add the route data
    data[routeId.toUpperCase()] = routeData;
    
    await setDoc(docRef, data);
    console.log(`Route ${routeId} saved successfully!`);
  } catch (error) {
    console.error("Error saving route:", error);
    throw error;
  }
}

/**
 * Adds a passenger to a route
 * @param {string} routeId - ID of the route
 * @param {string} passengerId - ID of the passenger to add
 * @returns {Promise<boolean>} True if successful, false if route not found
 */
export async function addPassengerToRoute(routeId, passengerId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseRouteId = routeId.toUpperCase();
      
      if (data[uppercaseRouteId]) {
        if (!data[uppercaseRouteId].PASSENGER_IDS) {
          data[uppercaseRouteId].PASSENGER_IDS = [];
        }
        
        // Check if passenger is already in the route
        if (!data[uppercaseRouteId].PASSENGER_IDS.includes(passengerId)) {
          data[uppercaseRouteId].PASSENGER_IDS.push(passengerId);
          await setDoc(docRef, data);
          
          // Update vehicle assigned seat count if needed
          const vehicleId = data[uppercaseRouteId].VEHICLE_ID;
          if (vehicleId) {
            await updateVehiclePassengerCount(vehicleId);
          }
          
          console.log(`Passenger ${passengerId} added to route ${routeId} successfully!`);
        } else {
          console.log(`Passenger ${passengerId} is already in route ${routeId}!`);
        }
        return true;
      } else {
        console.log(`Route ${routeId} not found!`);
        return false;
      }
    } else {
      console.log("No routes document found!");
      return false;
    }
  } catch (error) {
    console.error("Error adding passenger to route:", error);
    throw error;
  }
}

/**
 * Removes a passenger from a route
 * @param {string} routeId - ID of the route
 * @param {string} passengerId - ID of the passenger to remove
 * @returns {Promise<boolean>} True if successful, false if route or passenger not found
 */
export async function removePassengerFromRoute(routeId, passengerId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseRouteId = routeId.toUpperCase();
      
      if (data[uppercaseRouteId] && data[uppercaseRouteId].PASSENGER_IDS) {
        const index = data[uppercaseRouteId].PASSENGER_IDS.indexOf(passengerId);
        
        if (index !== -1) {
          data[uppercaseRouteId].PASSENGER_IDS.splice(index, 1);
          await setDoc(docRef, data);
          
          // Update vehicle assigned seat count if needed
          const vehicleId = data[uppercaseRouteId].VEHICLE_ID;
          if (vehicleId) {
            await updateVehiclePassengerCount(vehicleId);
          }
          
          console.log(`Passenger ${passengerId} removed from route ${routeId} successfully!`);
          return true;
        } else {
          console.log(`Passenger ${passengerId} not found in route ${routeId}!`);
          return false;
        }
      } else {
        console.log(`Route ${routeId} not found or has no passengers!`);
        return false;
      }
    } else {
      console.log("No routes document found!");
      return false;
    }
  } catch (error) {
    console.error("Error removing passenger from route:", error);
    throw error;
  }
}

/**
 * Adds a stop to a route
 * @param {string} routeId - ID of the route
 * @param {Object} stopData - Stop data including LAT and LONG
 * @returns {Promise<boolean>} True if successful, false if route not found
 */
export async function addStopToRoute(routeId, stopData) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseRouteId = routeId.toUpperCase();
      
      if (data[uppercaseRouteId]) {
        if (!data[uppercaseRouteId].STOPS) {
          data[uppercaseRouteId].STOPS = [];
        }
        
        data[uppercaseRouteId].STOPS.push(stopData);
        await setDoc(docRef, data);
        console.log(`Stop added to route ${routeId} successfully!`);
        return true;
      } else {
        console.log(`Route ${routeId} not found!`);
        return false;
      }
    } else {
      console.log("No routes document found!");
      return false;
    }
  } catch (error) {
    console.error("Error adding stop to route:", error);
    throw error;
  }
}

/**
 * Removes a stop from a route by index
 * @param {string} routeId - ID of the route
 * @param {number} stopIndex - Index of the stop to remove
 * @returns {Promise<boolean>} True if successful, false if route or stop not found
 */
export async function removeStopFromRoute(routeId, stopIndex) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseRouteId = routeId.toUpperCase();
      
      if (data[uppercaseRouteId] && data[uppercaseRouteId].STOPS) {
        if (stopIndex >= 0 && stopIndex < data[uppercaseRouteId].STOPS.length) {
          data[uppercaseRouteId].STOPS.splice(stopIndex, 1);
          await setDoc(docRef, data);
          console.log(`Stop removed from route ${routeId} successfully!`);
          return true;
        } else {
          console.log(`Stop index ${stopIndex} out of range for route ${routeId}!`);
          return false;
        }
      } else {
        console.log(`Route ${routeId} not found or has no stops!`);
        return false;
      }
    } else {
      console.log("No routes document found!");
      return false;
    }
  } catch (error) {
    console.error("Error removing stop from route:", error);
    throw error;
  }
}

/**
 * Deletes a route from the database
 * @param {string} routeId - ID of the route to delete
 * @returns {Promise<boolean>} True if successful, false if route not found
 */
export async function deleteRoute(routeId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseRouteId = routeId.toUpperCase();
      
      if (data[uppercaseRouteId]) {
        delete data[uppercaseRouteId];
        await setDoc(docRef, data);
        console.log(`Route ${routeId} deleted successfully!`);
        return true;
      } else {
        console.log(`Route ${routeId} not found!`);
        return false;
      }
    } else {
      console.log("No routes document found!");
      return false;
    }
  } catch (error) {
    console.error("Error deleting route:", error);
    throw error;
  }
}

// ================ VEHICLE OPERATIONS ================

/**
 * Gets all vehicles from the database
 * @returns {Promise<Object>} Object containing all vehicles
 */
export async function getAllVehicles() {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "VEHICLES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      console.log("No vehicles found!");
      return {};
    }
  } catch (error) {
    console.error("Error getting vehicles:", error);
    throw error;
  }
}

/**
 * Gets a specific vehicle by ID
 * @param {string} vehicleId - ID of the vehicle to retrieve
 * @returns {Promise<Object|null>} Vehicle data or null if not found
 */
export async function getVehicle(vehicleId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "VEHICLES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data[vehicleId.toUpperCase()] || null;
    } else {
      console.log("No vehicles document found!");
      return null;
    }
  } catch (error) {
    console.error("Error getting vehicle:", error);
    throw error;
  }
}

/**
 * Creates or updates a vehicle
 * @param {string} vehicleId - ID of the vehicle
 * @param {Object} vehicleData - Vehicle data including plate, capacity, etc.
 * @returns {Promise<void>}
 */
export async function setVehicle(vehicleId, vehicleData) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "VEHICLES");
    const docSnap = await getDoc(docRef);
    
    let data = {};
    if (docSnap.exists()) {
      data = docSnap.data();
    }
    
    // Update or add the vehicle data
    data[vehicleId.toUpperCase()] = vehicleData;
    
    await setDoc(docRef, data);
    console.log(`Vehicle ${vehicleId} saved successfully!`);
  } catch (error) {
    console.error("Error saving vehicle:", error);
    throw error;
  }
}

/**
 * Deletes a vehicle from the database
 * @param {string} vehicleId - ID of the vehicle to delete
 * @returns {Promise<boolean>} True if successful, false if vehicle not found
 */
export async function deleteVehicle(vehicleId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "VEHICLES");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseVehicleId = vehicleId.toUpperCase();
      
      if (data[uppercaseVehicleId]) {
        // Check if vehicle is assigned to any route
        const routesWithVehicle = await getRoutesWithVehicle(vehicleId);
        if (routesWithVehicle.length > 0) {
          console.log(`Cannot delete vehicle ${vehicleId} as it is assigned to routes: ${routesWithVehicle.join(', ')}`);
          return false;
        }
        
        delete data[uppercaseVehicleId];
        await setDoc(docRef, data);
        console.log(`Vehicle ${vehicleId} deleted successfully!`);
        return true;
      } else {
        console.log(`Vehicle ${vehicleId} not found!`);
        return false;
      }
    } else {
      console.log("No vehicles document found!");
      return false;
    }
  } catch (error) {
    console.error("Error deleting vehicle:", error);
    throw error;
  }
}

/**
 * Assigns a vehicle to a route
 * @param {string} routeId - ID of the route
 * @param {string} vehicleId - ID of the vehicle to assign
 * @returns {Promise<boolean>} True if successful, false if route or vehicle not found
 */
export async function assignVehicleToRoute(routeId, vehicleId) {
  try {
    const db = getDb();
    
    // Check if vehicle exists
    const vehicleData = await getVehicle(vehicleId);
    if (!vehicleData) {
      console.log(`Vehicle ${vehicleId} not found!`);
      return false;
    }
    
    // Update route with new vehicle
    const routesRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const routesSnap = await getDoc(routesRef);
    
    if (routesSnap.exists()) {
      const routesData = routesSnap.data();
      const uppercaseRouteId = routeId.toUpperCase();
      
      if (routesData[uppercaseRouteId]) {
        routesData[uppercaseRouteId].VEHICLE_ID = vehicleId.toUpperCase();
        await setDoc(routesRef, routesData);
        
        // Update vehicle's assigned seat count
        await updateVehiclePassengerCount(vehicleId);
        
        console.log(`Vehicle ${vehicleId} assigned to route ${routeId} successfully!`);
        return true;
      } else {
        console.log(`Route ${routeId} not found!`);
        return false;
      }
    } else {
      console.log("No routes document found!");
      return false;
    }
  } catch (error) {
    console.error("Error assigning vehicle to route:", error);
    throw error;
  }
}

/**
 * Gets all routes that have a specific vehicle assigned
 * @param {string} vehicleId - ID of the vehicle
 * @returns {Promise<Array>} Array of route IDs that have the vehicle assigned
 */
export async function getRoutesWithVehicle(vehicleId) {
  try {
    const db = getDb();
    const docRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const docSnap = await getDoc(docRef);
    
    const routesWithVehicle = [];
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const uppercaseVehicleId = vehicleId.toUpperCase();
      
      for (const routeId in data) {
        if (data[routeId].VEHICLE_ID === uppercaseVehicleId) {
          routesWithVehicle.push(routeId);
        }
      }
    }
    
    return routesWithVehicle;
  } catch (error) {
    console.error("Error getting routes with vehicle:", error);
    throw error;
  }
}

/**
 * Updates the assigned seat count for a vehicle based on passengers in routes
 * @param {string} vehicleId - ID of the vehicle
 * @returns {Promise<void>}
 */
export async function updateVehiclePassengerCount(vehicleId) {
  try {
    const db = getDb();
    const uppercaseVehicleId = vehicleId.toUpperCase();
    
    // Get all routes with this vehicle
    const routesWithVehicle = await getRoutesWithVehicle(uppercaseVehicleId);
    
    // Count total passengers
    let totalPassengers = 0;
    const routesRef = doc(db, ROOT_COLLECTION, "ROUTES");
    const routesSnap = await getDoc(routesRef);
    
    if (routesSnap.exists()) {
      const routesData = routesSnap.data();
      
      for (const routeId of routesWithVehicle) {
        if (routesData[routeId] && routesData[routeId].PASSENGER_IDS) {
          totalPassengers += routesData[routeId].PASSENGER_IDS.length;
        }
      }
    }
    
    // Update vehicle's assigned seat count
    const vehiclesRef = doc(db, ROOT_COLLECTION, "VEHICLES");
    const vehiclesSnap = await getDoc(vehiclesRef);
    
    if (vehiclesSnap.exists()) {
      const vehiclesData = vehiclesSnap.data();
      
      if (vehiclesData[uppercaseVehicleId]) {
        vehiclesData[uppercaseVehicleId].ASSIGNED_SEAT_COUNT = totalPassengers.toString();
        await setDoc(vehiclesRef, vehiclesData);
        console.log(`Updated vehicle ${vehicleId} assigned seat count to ${totalPassengers}`);
      }
    }
  } catch (error) {
    console.error("Error updating vehicle passenger count:", error);
    throw error;
  }
}

// ================ UTILITY FUNCTIONS ================

/**
 * Gets all data from the database (all collections)
 * @returns {Promise<Object>} Object containing all data
 */
export async function getAllData() {
  try {
    const passengers = await getAllPassengers();
    const routes = await getAllRoutes();
    const vehicles = await getAllVehicles();
    
    return {
      PASSENGERS: passengers,
      ROUTES: routes,
      VEHICLES: vehicles
    };
  } catch (error) {
    console.error("Error getting all data:", error);
    throw error;
  }
}

/**
 * Checks if a vehicle has enough capacity for all assigned passengers
 * @param {string} vehicleId - ID of the vehicle to check
 * @returns {Promise<boolean>} True if vehicle has enough capacity, false otherwise
 */
export async function checkVehicleCapacity(vehicleId) {
  try {
    const vehicle = await getVehicle(vehicleId);
    
    if (!vehicle) {
      console.log(`Vehicle ${vehicleId} not found!`);
      return false;
    }
    
    const capacity = parseInt(vehicle.CAPACITY);
    const assignedSeats = parseInt(vehicle.ASSIGNED_SEAT_COUNT || '0');
    
    return assignedSeats <= capacity;
  } catch (error) {
    console.error("Error checking vehicle capacity:", error);
    throw error;
  }
}

/**
 * Searches for passengers by partial name
 * @param {string} searchTerm - Partial name to search for
 * @returns {Promise<Object>} Object containing matching passengers
 */
export async function searchPassengers(searchTerm) {
  try {
    const passengers = await getAllPassengers();
    const results = {};
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    for (const passengerId in passengers) {
      if (passengerId.includes(lowerSearchTerm)) {
        results[passengerId] = passengers[passengerId];
      }
    }
    
    return results;
  } catch (error) {
    console.error("Error searching passengers:", error);
    throw error;
  }
}

/**
 * Gets all passengers assigned to a vehicle through routes
 * @param {string} vehicleId - ID of the vehicle
 * @returns {Promise<Array>} Array of passenger IDs
 */
export async function getPassengersInVehicle(vehicleId) {
  try {
    const routesWithVehicle = await getRoutesWithVehicle(vehicleId);
    const passengerIds = new Set();
    
    const routesData = await getAllRoutes();
    
    for (const routeId of routesWithVehicle) {
      if (routesData[routeId] && routesData[routeId].PASSENGER_IDS) {
        for (const passengerId of routesData[routeId].PASSENGER_IDS) {
          passengerIds.add(passengerId);
        }
      }
    }
    
    return Array.from(passengerIds);
  } catch (error) {
    console.error("Error getting passengers in vehicle:", error);
    throw error;
  }
}