// Initialize Map
const map = L.map('map').setView([0, 0], 2);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Global Variables
let myMarker = null;
let watchId = null;
let isOnline = false;

// Custom Icons to differentiate Customer and Vendor
const customerIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    iconSize: [25, 41], iconAnchor: [12, 41]
});

const vendorIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    iconSize: [25, 41], iconAnchor: [12, 41]
});

// Setup Display Name
const currentUser = localStorage.getItem('currentUser') || 'Guest';
if(document.getElementById('userNameDisplay')) {
    document.getElementById('userNameDisplay').innerText = `Hello, ${currentUser}`;
}

// ---------------------------------------------------------
// VENDOR LOGIC
// ---------------------------------------------------------
if (document.getElementById('vendor-panel')) {
    // Generate a unique ID for this specific vendor session
    const vendorId = 'vendor_' + Math.random().toString(36).substr(2, 9);
    
    if(currentUser !== 'Guest') document.getElementById('vendorName').value = currentUser;

    function toggleOnlineStatus() {
        const btn = document.getElementById('toggleBtn');
        const statusText = document.getElementById('statusText');

        if (!isOnline) {
            // GOING ONLINE
            if (navigator.geolocation) {
                watchId = navigator.geolocation.watchPosition(updateVendorLocation, handleLocationError, { enableHighAccuracy: true });
                isOnline = true;
                btn.innerText = "Go Offline";
                btn.classList.add('btn-danger');
                statusText.innerText = "Online & Broadcasting";
                statusText.style.color = "green";
            } else {
                alert("Geolocation is not supported by this browser.");
            }
        } else {
            // GOING OFFLINE
            navigator.geolocation.clearWatch(watchId);
            isOnline = false;
            btn.innerText = "Go Online & Share Location";
            btn.classList.remove('btn-danger');
            statusText.innerText = "Offline";
            statusText.style.color = "red";
            
            removeVendorFromDatabase();
        }
    }

    function updateVendorLocation(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Add a slight random offset so multiple vendors on the same computer don't overlap perfectly
        const offsetLat = lat + (Math.random() - 0.5) * 0.005;
        const offsetLng = lng + (Math.random() - 0.5) * 0.005;

        const name = document.getElementById('vendorName').value || 'Anonymous Vendor';
        const items = document.getElementById('vendorItems').value || 'Various items';

        // Update own map
        updateMyMarker(offsetLat, offsetLng, vendorIcon, "You are here!");
        map.setView([offsetLat, offsetLng], 14);

        // Push to "Backend" array (Simulated via localStorage)
        let activeVendors = JSON.parse(localStorage.getItem('allVendors')) || {};
        activeVendors[vendorId] = { 
            lat: offsetLat, 
            lng: offsetLng, 
            name: name, 
            items: items, 
            timestamp: Date.now() 
        };
        localStorage.setItem('allVendors', JSON.stringify(activeVendors));
    }

    function removeVendorFromDatabase() {
        let activeVendors = JSON.parse(localStorage.getItem('allVendors')) || {};
        delete activeVendors[vendorId];
        localStorage.setItem('allVendors', JSON.stringify(activeVendors));
    }

    // Ensure vendor is removed if they close the tab unexpectedly
    window.addEventListener('beforeunload', removeVendorFromDatabase);
}

// ---------------------------------------------------------
// CUSTOMER LOGIC
// ---------------------------------------------------------
if (document.getElementById('customer-panel')) {
    let activeVendorMarkers = {}; // Keeps track of all vendor markers on the map

    // Find customer's own location
    map.locate({ setView: true, maxZoom: 13 });
    map.on('locationfound', function(e) {
        updateMyMarker(e.latlng.lat, e.latlng.lng, customerIcon, "Your Location");
    });

    // Poll the "Backend" every 2 seconds to get ALL Vendor locations
    setInterval(() => {
        const rawData = localStorage.getItem('allVendors');
        const vendors = rawData ? JSON.parse(rawData) : {};
        const resultsPanel = document.getElementById('vendor-results');
        
        let panelHTML = '<h3>Live Vendors</h3>';
        let activeCount = 0;
        const now = Date.now();

        // Loop through all vendors in the database
        for (const id in vendors) {
            const data = vendors[id];

            // If a vendor hasn't updated in 15 seconds, consider them offline/stale
            if (now - data.timestamp > 15000) continue; 
            
            activeCount++;

            // Update or Create Marker on Map
            if (!activeVendorMarkers[id]) {
                activeVendorMarkers[id] = L.marker([data.lat, data.lng], {icon: vendorIcon}).addTo(map);
            } else {
                activeVendorMarkers[id].setLatLng([data.lat, data.lng]);
            }
            activeVendorMarkers[id].bindPopup(`<b>${data.name}</b><br>Selling: ${data.items}`);

            // Add to Side Panel UI
            panelHTML += `
                <div style="background: #e9ecef; padding: 10px; border-radius: 5px; margin-bottom: 10px; border-left: 4px solid #d9534f;">
                    <strong>${data.name}</strong><br>
                    <small>${data.items}</small>
                </div>
            `;
        }

        // Cleanup markers for vendors who went offline
        for (const id in activeVendorMarkers) {
            if (!vendors[id] || (now - vendors[id].timestamp > 15000)) {
                map.removeLayer(activeVendorMarkers[id]);
                delete activeVendorMarkers[id];
            }
        }

        if (activeCount === 0) {
            panelHTML += '<p>No vendors currently online nearby.</p>';
        }

        resultsPanel.innerHTML = panelHTML;

    }, 2000);
}

// ---------------------------------------------------------
// SHARED UTILITIES
// ---------------------------------------------------------
function updateMyMarker(lat, lng, iconType, popupText) {
    if (myMarker) {
        myMarker.setLatLng([lat, lng]);
    } else {
        myMarker = L.marker([lat, lng], {icon: iconType}).addTo(map);
        myMarker.bindPopup(popupText).openPopup();
    }
}

function handleLocationError(e) {
    console.warn("Location error: ", e.message);
}