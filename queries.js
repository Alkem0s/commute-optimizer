//queries.js
import { db } from "./firebase.js";

const COLLECTION = "COMMUTE_OPTIMIZER_COLLECTION";
const PASSENGERS = "PASSENGERS";
const ROUTES = "ROUTES";
const VEHICLES = "VEHICLES";

// ======================= PASSENGER QUERIES =======================

/**
 * Get all passengers
 * @returns {Promise<Array>} Array of passenger objects
 */
export const getAllPassengers = async () => {
  try {
    const passengerCollections = await db
      .collection(COLLECTION)
      .doc(PASSENGERS)
      .listCollections();
    
    const passengers = [];
    
    for (const passengerCol of passengerCollections) {
      const passengerId = passengerCol.id;
      const passengerDoc = await db
        .collection(COLLECTION)
        .doc(PASSENGERS)
        .collection(passengerId)
        .doc(`ID:${passengerId}`)
        .get();
      
      if (passengerDoc.exists) {
        passengers.push({
          id: passengerId,
          ...passengerDoc.data()
        });
      }
    }
    
    return passengers;
  } catch (error) {
    console.error("Error getting passengers:", error);
    throw error;
  }
};

/**
 * Get a passenger by name
 * @param {String} passengerName Name of the passenger
 * @returns {Promise<Object|null>} Passenger data or null if not found
 */
export const getPassengerByName = async (passengerName) => {
  try {
    const passengerDoc = await db
      .collection(COLLECTION)
      .doc(PASSENGERS)
      .collection(passengerName)
      .doc(`ID:${passengerName}`)
      .get();
    
    if (passengerDoc.exists) {
      return {
        id: passengerName,
        ...passengerDoc.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting passenger ${passengerName}:`, error);
    throw error;
  }
};

/**
 * Add a new passenger
 * @param {String} passengerName Name of the passenger
 * @param {String} routeName Name of the route assigned to passenger
 * @returns {Promise<void>}
 */
export const addPassenger = async (passengerName, routeName) => {
  try {
    // First check if passenger already exists
    const passengerDoc = await db
      .collection(COLLECTION)
      .doc(PASSENGERS)
      .collection(passengerName)
      .doc(`ID:${passengerName}`)
      .get();
    
    if (passengerDoc.exists) {
      throw new Error(`Passenger ${passengerName} already exists`);
    }
    
    // Add passenger document
    await db
      .collection(COLLECTION)
      .doc(PASSENGERS)
      .collection(passengerName)
      .doc(`ID:${passengerName}`)
      .set({
        NAME: passengerName,
        ROUTE: routeName
      });
    
    // Update route's PASSENGER_IDS array
    const routeRef = db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(routeName)
      .doc(`ID:${routeName}`);
    
    const routeDoc = await routeRef.get();
    if (routeDoc.exists) {
      const routeData = routeDoc.data();
      const passengers = routeData.PASSENGER_IDS || [];
      
      if (!passengers.includes(passengerName)) {
        await routeRef.update({
          PASSENGER_IDS: [...passengers, passengerName]
        });
      }
    }
  } catch (error) {
    console.error(`Error adding passenger ${passengerName}:`, error);
    throw error;
  }
};

/**
 * Update a passenger
 * @param {String} passengerName Name of the passenger
 * @param {String} newRouteName New route name
 * @returns {Promise<void>}
 */
export const updatePassengerRoute = async (passengerName, newRouteName) => {
  try {
    const passengerRef = db
      .collection(COLLECTION)
      .doc(PASSENGERS)
      .collection(passengerName)
      .doc(`ID:${passengerName}`);
    
    const passengerDoc = await passengerRef.get();
    if (!passengerDoc.exists) {
      throw new Error(`Passenger ${passengerName} not found`);
    }
    
    const oldRouteName = passengerDoc.data().ROUTE;
    
    // Update passenger's route
    await passengerRef.update({
      ROUTE: newRouteName
    });
    
    // Remove passenger from old route's passenger list
    if (oldRouteName) {
      const oldRouteRef = db
        .collection(COLLECTION)
        .doc(ROUTES)
        .collection(oldRouteName)
        .doc(`ID:${oldRouteName}`);
      
      const oldRouteDoc = await oldRouteRef.get();
      if (oldRouteDoc.exists) {
        const oldRouteData = oldRouteDoc.data();
        const oldPassengers = oldRouteData.PASSENGER_IDS || [];
        await oldRouteRef.update({
          PASSENGER_IDS: oldPassengers.filter(p => p !== passengerName)
        });
      }
    }
    
    // Add passenger to new route's passenger list
    const newRouteRef = db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(newRouteName)
      .doc(`ID:${newRouteName}`);
    
    const newRouteDoc = await newRouteRef.get();
    if (newRouteDoc.exists) {
      const newRouteData = newRouteDoc.data();
      const newPassengers = newRouteData.PASSENGER_IDS || [];
      
      if (!newPassengers.includes(passengerName)) {
        await newRouteRef.update({
          PASSENGER_IDS: [...newPassengers, passengerName]
        });
      }
    }
  } catch (error) {
    console.error(`Error updating passenger ${passengerName}:`, error);
    throw error;
  }
};

/**
 * Delete a passenger
 * @param {String} passengerName Name of the passenger
 * @returns {Promise<void>}
 */
export const deletePassenger = async (passengerName) => {
  try {
    const passengerRef = db
      .collection(COLLECTION)
      .doc(PASSENGERS)
      .collection(passengerName)
      .doc(`ID:${passengerName}`);
    
    const passengerDoc = await passengerRef.get();
    if (!passengerDoc.exists) {
      throw new Error(`Passenger ${passengerName} not found`);
    }
    
    const routeName = passengerDoc.data().ROUTE;
    
    // Delete passenger document
    await passengerRef.delete();
    
    // Remove passenger from route's passenger list
    if (routeName) {
      const routeRef = db
        .collection(COLLECTION)
        .doc(ROUTES)
        .collection(routeName)
        .doc(`ID:${routeName}`);
      
      const routeDoc = await routeRef.get();
      if (routeDoc.exists) {
        const routeData = routeDoc.data();
        const passengers = routeData.PASSENGER_IDS || [];
        await routeRef.update({
          PASSENGER_IDS: passengers.filter(p => p !== passengerName)
        });
      }
    }
  } catch (error) {
    console.error(`Error deleting passenger ${passengerName}:`, error);
    throw error;
  }
};

// ======================= ROUTE QUERIES =======================

/**
 * Get all routes
 * @returns {Promise<Array>} Array of route objects
 */
export const getAllRoutes = async () => {
  try {
    const routeCollections = await db
      .collection(COLLECTION)
      .doc(ROUTES)
      .listCollections();
    
    const routes = [];
    
    for (const routeCol of routeCollections) {
      const routeId = routeCol.id;
      const routeDoc = await db
        .collection(COLLECTION)
        .doc(ROUTES)
        .collection(routeId)
        .doc(`ID:${routeId}`)
        .get();
      
      if (routeDoc.exists) {
        routes.push({
          id: routeId,
          ...routeDoc.data()
        });
      }
    }
    
    return routes;
  } catch (error) {
    console.error("Error getting routes:", error);
    throw error;
  }
};

/**
 * Get a route by name
 * @param {String} routeName Name of the route
 * @returns {Promise<Object|null>} Route data or null if not found
 */
export const getRouteByName = async (routeName) => {
  try {
    const routeDoc = await db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(routeName)
      .doc(`ID:${routeName}`)
      .get();
    
    if (routeDoc.exists) {
      return {
        id: routeName,
        ...routeDoc.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting route ${routeName}:`, error);
    throw error;
  }
};

/**
 * Add a new route
 * @param {String} routeName Name of the route
 * @param {String} vehicleId ID of the vehicle assigned to route
 * @param {Array} passengerIds Array of passenger names assigned to route
 * @returns {Promise<void>}
 */
export const addRoute = async (routeName, vehicleId, passengerIds = []) => {
  try {
    // First check if route already exists
    const routeDoc = await db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(routeName)
      .doc(`ID:${routeName}`)
      .get();
    
    if (routeDoc.exists) {
      throw new Error(`Route ${routeName} already exists`);
    }
    
    // Add route document
    await db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(routeName)
      .doc(`ID:${routeName}`)
      .set({
        ROUTE_NAME: routeName,
        VEHICLE_ID: vehicleId,
        PASSENGER_IDS: passengerIds
      });
    
    // Update passengers' route field
    for (const passengerId of passengerIds) {
      const passengerRef = db
        .collection(COLLECTION)
        .doc(PASSENGERS)
        .collection(passengerId)
        .doc(`ID:${passengerId}`);
      
      const passengerDoc = await passengerRef.get();
      if (passengerDoc.exists) {
        await passengerRef.update({
          ROUTE: routeName
        });
      }
    }
  } catch (error) {
    console.error(`Error adding route ${routeName}:`, error);
    throw error;
  }
};

/**
 * Update a route
 * @param {String} routeName Name of the route
 * @param {String} vehicleId New vehicle ID
 * @returns {Promise<void>}
 */
export const updateRouteVehicle = async (routeName, vehicleId) => {
  try {
    const routeRef = db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(routeName)
      .doc(`ID:${routeName}`);
    
    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) {
      throw new Error(`Route ${routeName} not found`);
    }
    
    await routeRef.update({
      VEHICLE_ID: vehicleId
    });
  } catch (error) {
    console.error(`Error updating route ${routeName}:`, error);
    throw error;
  }
};

/**
 * Delete a route
 * @param {String} routeName Name of the route
 * @returns {Promise<void>}
 */
export const deleteRoute = async (routeName) => {
  try {
    const routeRef = db
      .collection(COLLECTION)
      .doc(ROUTES)
      .collection(routeName)
      .doc(`ID:${routeName}`);
    
    const routeDoc = await routeRef.get();
    if (!routeDoc.exists) {
      throw new Error(`Route ${routeName} not found`);
    }
    
    const routeData = routeDoc.data();
    const passengerIds = routeData.PASSENGER_IDS || [];
    
    // Update passengers' route field to null
    for (const passengerId of passengerIds) {
      const passengerRef = db
        .collection(COLLECTION)
        .doc(PASSENGERS)
        .collection(passengerId)
        .doc(`ID:${passengerId}`);
      
      const passengerDoc = await passengerRef.get();
      if (passengerDoc.exists) {
        await passengerRef.update({
          ROUTE: ""
        });
      }
    }
    
    // Delete route document
    await routeRef.delete();
  } catch (error) {
    console.error(`Error deleting route ${routeName}:`, error);
    throw error;
  }
};

// ======================= VEHICLE QUERIES =======================

/**
 * Get all vehicles
 * @returns {Promise<Array>} Array of vehicle objects
 */
export const getAllVehicles = async () => {
  try {
    const vehicleCollections = await db
      .collection(COLLECTION)
      .doc(VEHICLES)
      .listCollections();
    
    const vehicles = [];
    
    for (const vehicleCol of vehicleCollections) {
      const vehicleId = vehicleCol.id;
      const vehicleDoc = await db
        .collection(COLLECTION)
        .doc(VEHICLES)
        .collection(vehicleId)
        .doc(`ID:${vehicleId}`)
        .get();
      
      if (vehicleDoc.exists) {
        vehicles.push({
          id: vehicleId,
          ...vehicleDoc.data()
        });
      }
    }
    
    return vehicles;
  } catch (error) {
    console.error("Error getting vehicles:", error);
    throw error;
  }
};

/**
 * Get a vehicle by ID
 * @param {String} vehicleId ID of the vehicle
 * @returns {Promise<Object|null>} Vehicle data or null if not found
 */
export const getVehicleById = async (vehicleId) => {
  try {
    const vehicleDoc = await db
      .collection(COLLECTION)
      .doc(VEHICLES)
      .collection(vehicleId)
      .doc(`ID:${vehicleId}`)
      .get();
    
    if (vehicleDoc.exists) {
      return {
        id: vehicleId,
        ...vehicleDoc.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Error getting vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Add a new vehicle
 * @param {String} vehicleId ID of the vehicle
 * @param {String} capacity Capacity of the vehicle
 * @param {String} plate License plate of the vehicle
 * @returns {Promise<void>}
 */
export const addVehicle = async (vehicleId, capacity, plate) => {
  try {
    // First check if vehicle already exists
    const vehicleDoc = await db
      .collection(COLLECTION)
      .doc(VEHICLES)
      .collection(vehicleId)
      .doc(`ID:${vehicleId}`)
      .get();
    
    if (vehicleDoc.exists) {
      throw new Error(`Vehicle ${vehicleId} already exists`);
    }
    
    // Add vehicle document
    await db
      .collection(COLLECTION)
      .doc(VEHICLES)
      .collection(vehicleId)
      .doc(`ID:${vehicleId}`)
      .set({
        ASSIGNED_SEAT_COUNT: "0",
        CAPACITY: capacity,
        PLATE: plate
      });
  } catch (error) {
    console.error(`Error adding vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Update a vehicle
 * @param {String} vehicleId ID of the vehicle
 * @param {String} capacity New capacity
 * @param {String} plate New license plate
 * @param {String} assignedSeatCount New assigned seat count
 * @returns {Promise<void>}
 */
export const updateVehicle = async (vehicleId, capacity, plate, assignedSeatCount) => {
  try {
    const vehicleRef = db
      .collection(COLLECTION)
      .doc(VEHICLES)
      .collection(vehicleId)
      .doc(`ID:${vehicleId}`);
    
    const vehicleDoc = await vehicleRef.get();
    if (!vehicleDoc.exists) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }
    
    const updateData = {};
    if (capacity !== undefined) updateData.CAPACITY = capacity;
    if (plate !== undefined) updateData.PLATE = plate;
    if (assignedSeatCount !== undefined) updateData.ASSIGNED_SEAT_COUNT = assignedSeatCount;
    
    await vehicleRef.update(updateData);
  } catch (error) {
    console.error(`Error updating vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Delete a vehicle
 * @param {String} vehicleId ID of the vehicle
 * @returns {Promise<void>}
 */
export const deleteVehicle = async (vehicleId) => {
  try {
    const vehicleRef = db
      .collection(COLLECTION)
      .doc(VEHICLES)
      .collection(vehicleId)
      .doc(`ID:${vehicleId}`);
    
    const vehicleDoc = await vehicleRef.get();
    if (!vehicleDoc.exists) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }
    
    // Check if vehicle is assigned to any route
    const routes = await getAllRoutes();
    const assignedRoutes = routes.filter(route => route.VEHICLE_ID === vehicleId);
    
    if (assignedRoutes.length > 0) {
      throw new Error(`Cannot delete vehicle ${vehicleId} as it is assigned to ${assignedRoutes.length} route(s)`);
    }
    
    // Delete vehicle document
    await vehicleRef.delete();
  } catch (error) {
    console.error(`Error deleting vehicle ${vehicleId}:`, error);
    throw error;
  }
};

// ======================= UTILITY FUNCTIONS =======================

/**
 * Calculate and update assigned seat count for a vehicle
 * @param {String} vehicleId ID of the vehicle
 * @returns {Promise<void>}
 */
export const updateAssignedSeatCount = async (vehicleId) => {
  try {
    // Get all routes assigned to this vehicle
    const routes = await getAllRoutes();
    const assignedRoutes = routes.filter(route => route.VEHICLE_ID === vehicleId);
    
    // Count total passengers assigned to these routes
    let totalPassengers = 0;
    for (const route of assignedRoutes) {
      totalPassengers += (route.PASSENGER_IDS || []).length;
    }
    
    // Update vehicle's assigned seat count
    await updateVehicle(vehicleId, undefined, undefined, String(totalPassengers));
  } catch (error) {
    console.error(`Error updating assigned seat count for vehicle ${vehicleId}:`, error);
    throw error;
  }
};

/**
 * Initialize database with basic structure if it doesn't exist
 * @returns {Promise<void>}
 */
export const initializeDatabase = async () => {
  try {
    const rootDoc = await db.collection(COLLECTION).doc(PASSENGERS).get();
    if (!rootDoc.exists) {
      // Create main documents
      await db.collection(COLLECTION).doc(PASSENGERS).set({});
      await db.collection(COLLECTION).doc(ROUTES).set({});
      await db.collection(COLLECTION).doc(VEHICLES).set({});
      console.log("Database structure initialized");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
};