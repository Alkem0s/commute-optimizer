// Add these modal functions
function showModal() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('successModal');
    modal.style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('successModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Modified form submit handler
document.getElementById('passengerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
// Get form values
const passengerData = {
    dahili_gosterim_adi: document.getElementById('dahili_gosterim_adi').value,
    gider_yeri: document.getElementById('gider_yeri').value,
    gider_yeri_tanim: document.getElementById('gider_yeri_tanim').value,
    servis_kullanimi: document.getElementById('servis_kullanimi').value,
    servis_no: document.getElementById('servis_no').value,
    servise_binis_saati: document.getElementById('servise_binis_saati').value,
    servise_inis_saati: document.getElementById('servise_inis_saati').value,
    servis_sira: document.getElementById('servis_sira').value,
    servis_adresi: document.getElementById('servis_adresi').value,
    ikametgah_adresine_uzaklik: document.getElementById('ikametgah_adresine_uzaklik').value
};

try {
    // Use the exposed firebaseAPI from preload.js
    const result = await window.firebaseAPI.addData('YOLCULAR', {
        "Dahili Gösterim Adı": passengerData.dahili_gosterim_adi,
        "GİDER YERİ": passengerData.gider_yeri,
        "GİDER YERİ TANIM": passengerData.gider_yeri_tanim,
        "Servis Kullanımı": passengerData.servis_kullanimi,
        "Servis No": passengerData.servis_no,
        "Servise Biniş Saati": passengerData.servise_binis_saati,
        "Servise İniş Saati": passengerData.servise_inis_saati,
        "SERVİS SIRA": passengerData.servis_sira,
        "Servis Adresi": passengerData.servis_adresi,
        "ikametgah adresine uzaklık": passengerData.ikametgah_adresine_uzaklik
    });


        if (result.success) {
            showModal(); // Changed from showMessage to modal
            document.getElementById('passengerForm').reset();
        } else {
            showMessage(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
    }
});

// Keep existing error message function
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = text;
    messageDiv.style.color = type === 'success' ? 'green' : 'red';
    setTimeout(() => messageDiv.textContent = '', 3000);
}