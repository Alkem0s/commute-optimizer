// add-passenger.js
import { setPassenger } from './api.js';

document.getElementById('passengerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Extract form values
    const passengerId = document.getElementById('dahili_gosterim_adi').value.trim();
    const routeId = document.getElementById('gider_yeri').value.trim(); // Destination Code = ROUTE in sample
    const address = document.getElementById('servis_adresi').value.trim(); // Service Address = STOP_ADDRESS in sample

    try {
        // Save passenger using API (structure: [routeId, address])
        await setPassenger(passengerId.toLowerCase(), [routeId, address]);
        
        // Show success modal
        document.getElementById('successModal').style.display = 'block';
        
        // Reset form
        document.getElementById('passengerForm').reset();
    } catch (error) {
        document.getElementById('message').textContent = "Error adding passenger: " + error.message;
    }
});

// Close modal function
window.closeModal = () => {
    document.getElementById('successModal').style.display = 'none';
};