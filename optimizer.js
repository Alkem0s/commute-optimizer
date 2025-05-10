const distanceCache = new Map();
const pendingPromises = new Map();

/**
 * Optimizes vehicle routes using your existing distance calculation API
 * @param {Array<Location>} locations - Passenger locations
 * @param {Array<Vehicle>} vehicles - Vehicles with capacity
 * @param {number} walkingDistance - Max walking radius in meters
 * @returns {Promise<Array<Location>>} Optimized stops
 */
async function optimizeRoute(locations, vehicles, walkingDistance) {
    // Validate input
    if (!locations.every(l => 'lat' in l && 'lng' in l)) {
        throw new Error('Invalid location format');
    }

    // Reset caches for fresh calculations
    distanceCache.clear();
    pendingPromises.clear();

    // Cluster passengers using actual route distances
    const clusters = await clusterPassengers(locations, walkingDistance);
    const clusterCenters = calculateClusterCenters(clusters);
    
    // Build distance matrix using your API
    const distanceMatrix = await buildDistanceMatrix(clusterCenters);

    // Prepare input for OR-Tools
    const input = {
        clusters: {
            centers: clusterCenters,
            members: clusters,
        },
        passengers: locations,
        vehicleCapacities: vehicles.map(v => v.capacity),
        walkingRadius: walkingDistance,
        distanceMatrix: distanceMatrix
    };

    return executePythonOptimizer(input);
}

function generateCacheKey(a, b, mode) {
    return `${a.lat.toFixed(6)}:${a.lng.toFixed(6)}|${
        b.lat.toFixed(6)}:${b.lng.toFixed(6)}|${mode}`;
}

// Enhanced caching layer with concurrency control
async function cachedRouteDistance(a, b, mode) {
    const key = generateCacheKey(a, b, mode);
    const reverseKey = generateCacheKey(b, a, mode);

    // Check existing cache
    if (distanceCache.has(key)) return distanceCache.get(key);
    
    // Check pending promises
    if (pendingPromises.has(key)) {
        return pendingPromises.get(key);
    }

    // Create new request promise
    const promise = (async () => {
        try {
            const distance = await calculateRouteDistanceCoords(
                a.lat, a.lng, b.lat, b.lng, mode
            );
            
            // Cache both directions if symmetrical
            if (mode === 'WALKING') {
                distanceCache.set(key, distance);
                distanceCache.set(reverseKey, distance);
            } else {
                distanceCache.set(key, distance);
            }
            
            return distance;
        } finally {
            pendingPromises.delete(key);
        }
    })();

    // Store pending promise
    pendingPromises.set(key, promise);
    
    return promise;
}


// Modified helper functions using cached distances
async function clusterPassengers(locations, radius) {
    const clusters = [];
    const visited = new Set();
    
    for (const [i, loc] of locations.entries()) {
        if (visited.has(i)) continue;
        
        const cluster = [loc];
        visited.add(i);
        
        // Parallelize distance checks for performance
        const distancePromises = [];
        const candidates = [];
        
        // Find potential cluster members
        for (let j = i + 1; j < locations.length; j++) {
            if (visited.has(j)) continue;
            candidates.push(j);
            distancePromises.push(
                cachedRouteDistance(loc, locations[j], 'WALKING')
            );
        }

        // Process all distances at once
        const distances = await Promise.all(distancePromises);
        
        // Add qualifying members to cluster
        distances.forEach((distance, idx) => {
            if (distance <= radius) {
                const j = candidates[idx];
                cluster.push(locations[j]);
                visited.add(j);
            }
        });
        
        clusters.push(cluster);
    }
    
    return clusters;
}

function calculateClusterCenters(clusters) {
    return clusters.map(cluster => {
        const avgLat = cluster.reduce((sum, l) => sum + l.lat, 0) / cluster.length;
        const avgLng = cluster.reduce((sum, l) => sum + l.lng, 0) / cluster.length;
        return { lat: avgLat, lng: avgLng };
    });
}

async function buildDistanceMatrix(centers) {
    const matrix = [];
    const requests = [];
    
    // Pre-generate all requests
    for (const source of centers) {
        const rowRequests = centers.map(target => 
            cachedRouteDistance(source, target, 'DRIVE')
        );
        requests.push(Promise.all(rowRequests));
    }
    
    // Execute all rows in parallel
    const results = await Promise.all(requests);
    results.forEach(row => matrix.push(row));
    
    return matrix;
}

/**
 * Executes the compiled OR-Tools optimizer executable
 * @param {Object} input - Input data for optimization
 * @returns {Promise<Object>} Optimized routes
 */
async function executePythonOptimizer(input) {
  return window.optimizer.runOptimizer(input);
}