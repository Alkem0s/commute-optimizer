#!/usr/bin/env python3
"""
Linear bus route optimization script.
Designed for non-overlapping linear bus routes.
"""

import sys
import json
import numpy as np
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans

def create_data_model(input_json):
    """Prepare data for the OR-Tools solver."""
    data = {}
    # Extract data from input JSON
    centers = input_json['clusters']['centers']
    clusters = input_json['clusters']['members']
    
    # Distance matrix (pre-calculated in JavaScript)
    data['distance_matrix'] = input_json['distanceMatrix']
    
    # Vehicle data
    data['num_vehicles'] = len(input_json['vehicleCapacities'])
    data['vehicle_capacities'] = input_json['vehicleCapacities']
    
    # Prepare demand (number of passengers per cluster)
    data['demands'] = [len(cluster) for cluster in clusters]
    
    # Set depot as the first location for simplicity
    # This can be adjusted as needed
    data['depot'] = 0
    
    return data

def divide_route_linearly(cluster_centers, num_vehicles):
    """
    Divide the stops into linear segments for each vehicle.
    This ensures non-overlapping routes.
    """
    # Extract coordinates for clustering
    coords = np.array([[c['lat'], c['lng']] for c in cluster_centers])
    
    # Special case: if we have only one vehicle
    if num_vehicles == 1:
        return {0: list(range(len(cluster_centers)))}
        
    # Use KMeans to divide the points into spatial segments
    kmeans = KMeans(n_clusters=num_vehicles, random_state=42)
    cluster_labels = kmeans.fit_predict(coords)
    
    # Create vehicle assignments
    vehicle_assignments = {}
    for i in range(num_vehicles):
        vehicle_assignments[i] = [j for j, label in enumerate(cluster_labels) if label == i]
    
    # Check if any vehicle has no stops and redistribute if needed
    for vehicle_id in range(num_vehicles):
        if vehicle_id not in vehicle_assignments or len(vehicle_assignments[vehicle_id]) == 0:
            # Find vehicle with most stops
            max_vehicle = max(vehicle_assignments.items(), key=lambda x: len(x[1]) if x[1] else 0)
            if max_vehicle[1]:  # If there are any stops to redistribute
                # Take half of the stops from the vehicle with most
                num_to_take = len(max_vehicle[1]) // 2
                if num_to_take > 0:
                    vehicle_assignments[vehicle_id] = max_vehicle[1][:num_to_take]
                    vehicle_assignments[max_vehicle[0]] = max_vehicle[1][num_to_take:]
    
    return vehicle_assignments

def optimize_linear_routes(data, input_json):
    """
    Optimize routes ensuring linear paths for each vehicle.
    Returns routes that don't overlap between vehicles.
    """
    cluster_centers = input_json['clusters']['centers']
    clusters = input_json['clusters']['members']
    distance_matrix = data['distance_matrix']
    
    # Divide stops among vehicles linearly
    vehicle_assignments = divide_route_linearly(cluster_centers, data['num_vehicles'])
    
    routes = []
    total_distance = 0
    
    # For each vehicle, optimize its assigned stops
    for vehicle_id, assigned_stops in vehicle_assignments.items():
        if not assigned_stops:
            continue
            
        # Include depot if it's not already in the assigned stops
        if 0 not in assigned_stops:
            assigned_stops = [0] + assigned_stops
            
        # Create a sub-matrix for this vehicle's stops
        sub_matrix = [[distance_matrix[i][j] for j in assigned_stops] for i in assigned_stops]
        
        # Create a mini routing problem for just this vehicle
        manager = pywrapcp.RoutingIndexManager(len(assigned_stops), 1, 0)  # 1 vehicle, depot at first position
        routing = pywrapcp.RoutingModel(manager)
        
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return int(sub_matrix[from_node][to_node])
            
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Add demand constraints if needed
        sub_demands = [data['demands'][stop] for stop in assigned_stops]
        
        def demand_callback(from_index):
            from_node = manager.IndexToNode(from_index)
            return sub_demands[from_node]
            
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,  # null capacity slack
            [data['vehicle_capacities'][vehicle_id]],  # vehicle capacity
            True,  # start cumul to zero
            'Capacity'
        )
        
        # Set search parameters
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        
        # Solve the problem
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            # Extract the route
            vehicle_route = []
            route_distance = 0
            index = routing.Start(0)  # Only one vehicle in this sub-problem
            
            while not routing.IsEnd(index):
                # Convert from sub-problem index to original index
                original_index = assigned_stops[manager.IndexToNode(index)]
                
                # Skip depot for all but the first vehicle
                if original_index != 0 or len(vehicle_route) == 0:
                    vehicle_route.append({
                        "center": cluster_centers[original_index],
                        "passengers": clusters[original_index],
                        "passenger_count": len(clusters[original_index])
                    })
                
                previous_index = index
                index = solution.Value(routing.NextVar(index))
                
                if not routing.IsEnd(index):
                    route_distance += routing.GetArcCostForVehicle(previous_index, index, 0)
            
            if len(vehicle_route) > 1:  # Only add routes with multiple stops
                routes.append({
                    "stops": vehicle_route,
                    "distance": route_distance
                })
                total_distance += route_distance
    
    # Sort routes geographically if desired
    # (This would ensure routes are ordered in a logical manner)
    
    return {
        "routes": routes,
        "total_distance": total_distance,
        "number_of_vehicles_used": len(routes)
    }

def generate_test_data():
    """Generate sample data for testing the optimizer."""
    # Sample passenger locations in rough linear pattern with some variation
    # Creating a clearer linear pattern from south to north
    passenger_locations = [
        {"lat": 37.75, "lng": -122.42},  # Starting point (south)
        {"lat": 37.755, "lng": -122.415},
        {"lat": 37.76, "lng": -122.418},
        {"lat": 37.765, "lng": -122.41},
        {"lat": 37.77, "lng": -122.42},
        {"lat": 37.775, "lng": -122.417},
        {"lat": 37.78, "lng": -122.415},
        {"lat": 37.785, "lng": -122.419},
        {"lat": 37.79, "lng": -122.414},
        {"lat": 37.795, "lng": -122.418},
        {"lat": 37.80, "lng": -122.416},
        {"lat": 37.805, "lng": -122.42},
        {"lat": 37.81, "lng": -122.417},
        {"lat": 37.815, "lng": -122.415},
        {"lat": 37.82, "lng": -122.42},  # Ending point (north)
    ]
    
    # Create clusters (simplified for testing)
    # In real app, this would use proper clustering algorithm
    clusters = [
        [passenger_locations[0], passenger_locations[1]],
        [passenger_locations[2], passenger_locations[3]],
        [passenger_locations[4], passenger_locations[5]],
        [passenger_locations[6], passenger_locations[7]],
        [passenger_locations[8], passenger_locations[9]],
        [passenger_locations[10], passenger_locations[11]],
        [passenger_locations[12], passenger_locations[13], passenger_locations[14]]
    ]
    
    # Calculate cluster centers
    centers = []
    for cluster in clusters:
        center_lat = sum(p["lat"] for p in cluster) / len(cluster)
        center_lng = sum(p["lng"] for p in cluster) / len(cluster)
        centers.append({"lat": center_lat, "lng": center_lng})
    
    # Make first center the depot (starting point)
    # This could be a bus depot location in reality
    depot = {"lat": centers[0]["lat"] - 0.02, "lng": centers[0]["lng"]}
    centers = [depot] + centers
    clusters = [[]] + clusters  # Empty cluster for depot
    
    # Create a distance matrix with INTEGER distances (very important for OR-Tools)
    distance_matrix = []
    for center1 in centers:
        row = []
        for center2 in centers:
            # Simple distance calculation in meters (in real app, from Google Maps)
            distance = int(((center1["lat"] - center2["lat"])**2 + 
                           (center1["lng"] - center2["lng"])**2) * 111319 * 111319)
            row.append(distance)
        distance_matrix.append(row)
    
    # Return test input in expected format
    return {
        "clusters": {
            "centers": centers,
            "members": clusters,
        },
        "passengers": passenger_locations,
        "vehicleCapacities": [10, 10],  # Two vehicles with sufficient capacity
        "walkingRadius": 800,  # 800 meters walking radius
        "distanceMatrix": distance_matrix
    }

def visualize_routes(test_input, result):
    """Visualize the routes on a map for better understanding."""
    try:
        centers = test_input['clusters']['centers']
        
        # Create plot
        plt.figure(figsize=(10, 8))
        
        # Plot all centers
        lats = [c['lat'] for c in centers]
        lngs = [c['lng'] for c in centers]
        plt.scatter(lngs, lats, c='gray', alpha=0.5, s=50)
        
        # Plot depot
        plt.scatter([centers[0]['lng']], [centers[0]['lat']], c='black', s=100, marker='s', label='Depot')
        
        # Plot routes with different colors
        colors = ['blue', 'red', 'green', 'purple', 'orange']
        
        for i, route in enumerate(result['routes']):
            route_lats = [stop['center']['lat'] for stop in route['stops']]
            route_lngs = [stop['center']['lng'] for stop in route['stops']]
            
            # Add depot to start if not already there
            if centers[0]['lat'] != route_lats[0] or centers[0]['lng'] != route_lngs[0]:
                route_lats.insert(0, centers[0]['lat'])
                route_lngs.insert(0, centers[0]['lng'])
            
            color = colors[i % len(colors)]
            plt.plot(route_lngs, route_lats, 'o-', c=color, linewidth=2, label=f'Route {i+1}')
            
            # Add passenger count labels
            for j, stop in enumerate(route['stops']):
                if j > 0:  # Skip depot
                    plt.annotate(f"{stop['passenger_count']}", 
                                (route_lngs[j], route_lats[j]),
                                textcoords="offset points",
                                xytext=(0,10), 
                                ha='center')
        
        plt.legend()
        plt.title('Optimized Bus Routes')
        plt.xlabel('Longitude')
        plt.ylabel('Latitude')
        plt.grid(True)
        
        # Save to file
        plt.savefig('optimized_routes.png')
        print("Route visualization saved to 'optimized_routes.png'")
        plt.close()
        
    except Exception as e:
        print(f"Visualization error: {e}")

def run_test_case():
    """Run a test case to show the optimizer in action."""
    print("Running test case for route optimizer...")
    
    # Generate test data
    test_input = generate_test_data()
    
    # Print test input summary
    print(f"Test data: {len(test_input['passengers'])} passengers in {len(test_input['clusters']['centers'])-1} clusters")
    print(f"Vehicles: {len(test_input['vehicleCapacities'])} vehicles with capacities {test_input['vehicleCapacities']}")
    
    # Validate distance matrix
    print("Validating distance matrix...")
    for i, row in enumerate(test_input['distanceMatrix']):
        for j, value in enumerate(row):
            if not isinstance(value, int):
                print(f"WARNING: Non-integer value {value} at position [{i}][{j}] in distance matrix")
                test_input['distanceMatrix'][i][j] = int(value)
    
    # Prepare data model
    data = create_data_model(test_input)
    
    print("Optimizing routes...")
    # Use optimized linear routes function
    result = optimize_linear_routes(data, test_input)
    
    # Print results in a readable format
    print("\nOptimized Routes:")
    for i, route in enumerate(result['routes']):
        print(f"\nVehicle {i+1}:")
        print(f"  Distance: {route['distance']}")
        print("  Stops:")
        for stop in route['stops']:
            center = stop['center']
            passengers = stop['passenger_count']
            print(f"  - Location: ({center['lat']:.4f}, {center['lng']:.4f}), Passengers: {passengers}")
    
    print(f"\nTotal distance: {result['total_distance']}")
    print(f"Vehicles used: {result['number_of_vehicles_used']} out of {len(test_input['vehicleCapacities'])}")
    
    # Try to visualize the routes
    try:
        visualize_routes(test_input, result)
    except ImportError:
        print("Matplotlib or scikit-learn not available for visualization")
    
    return result

TEST = True  # Set to True for testing, False for production

def main():
    """Main function to process input and return optimized routes."""
    # Check if this is being run directly (for testing) or via stdin (from JavaScript)
    if TEST:
        run_test_case()
        return
        
    # If no arguments, assume being called from JavaScript
    try:
        # Try to read from stdin with a timeout
        import select
        if select.select([sys.stdin], [], [], 0.1)[0]:
            # Data available on stdin
            input_data = sys.stdin.read()
            input_json = json.loads(input_data)
            
            # Prepare data model
            data = create_data_model(input_json)
            
            # Solve with linear optimization
            result = optimize_linear_routes(data, input_json)
            
            # Send result back to JavaScript
            print(json.dumps(result))
        else:
            # No data on stdin, run test case
            print("No input detected on stdin, running test case...")
            run_test_case()
            
    except Exception as e:
        # Handle errors gracefully
        import traceback
        error_result = {
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()