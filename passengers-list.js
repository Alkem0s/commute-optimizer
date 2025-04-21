document.addEventListener('DOMContentLoaded', async () => {
    await loadPassengers();
    setupSearch();
});

async function loadPassengers() {
    try {
        const result = await window.firebaseAPI.getData('YOLCULAR');
        
        if (result.success) {
            populateTable(result.data);
        } else {
            showError('Error loading passengers: ' + result.error);
        }
    } catch (error) {
        showError(error.message);
    }
}

function populateTable(passengers) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    passengers.forEach(passenger => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${passenger['Dahili Gösterim Adı']}</td>
            <td>${passenger['GİDER YERİ']}</td>
            <td>${passenger['GİDER YERİ TANIM']}</td>
            <td>${passenger['Servis Kullanımı']}</td>
            <td>${passenger['Servis No']}</td>
            <td>${passenger['Servise Biniş Saati']}</td>
            <td>${passenger['Servise İniş Saati']}</td>
            <td>${passenger['SERVİS SIRA']}</td>
            <td>${passenger['Servis Adresi']}</td>
            <td>${passenger['ikametgah adresine uzaklık']}</td>
            <td>
                <button class="edit-btn" onclick="openEditModal('${passenger.id}')">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', function() {
        const filter = this.value.toLowerCase();
        const rows = document.querySelectorAll('#tableBody tr');
        
        rows.forEach(row => {
            const cells = row.getElementsByTagName('td');
            let match = false;
            
            for (let cell of cells) {
                if (cell.textContent.toLowerCase().includes(filter)) {
                    match = true;
                    break;
                }
            }
            
            row.style.display = match ? '' : 'none';
        });
    });
}

function openEditModal(documentId) {
    const passenger = getPassengerById(documentId);
    if (!passenger) return;

    // Populate form fields
    document.getElementById('editDocumentId').value = documentId;
    document.getElementById('editDahiliGosterimAdi').value = passenger['Dahili Gösterim Adı'];
    // Populate all other fields similarly
    
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const documentId = document.getElementById('editDocumentId').value;
    const updatedData = {
        "Dahili Gösterim Adı": document.getElementById('editDahiliGosterimAdi').value,
        // Collect all other field values
    };

    try {
        // Use modifyYolcularData function from your queries.js
        const result = await window.firebaseAPI.modifyData(documentId, updatedData);
        
        if (result.success) {
            closeEditModal();
            await loadPassengers();
        } else {
            showError('Update failed: ' + result.error);
        }
    } catch (error) {
        showError(error.message);
    }
});

function showError(message) {
    alert('Error: ' + message); // Replace with better error display
}

// Helper function to find passenger by ID
function getPassengerById(documentId) {
    const rows = document.querySelectorAll('#tableBody tr');
    for (let row of rows) {
        if (row.querySelector('button').onclick.toString().includes(documentId)) {
            const cells = row.getElementsByTagName('td');
            return {
                id: documentId,
                'Dahili Gösterim Adı': cells[0].textContent,
                // Map all other fields
            };
        }
    }
    return null;
}