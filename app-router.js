// app-router.js

// Import all page initialization and cleanup functions
import { initApp, cleanupApp } from './app.js'; // Renamed from map.js for clarity in previous instructions
import { initApiTest, cleanupApiTest } from './api-test.js';
import { initAddPassenger, cleanupAddPassenger } from './add-passenger.js';
import { initPassengersList, cleanupPassengersList } from './passengers-list.js';

// Add other page imports as you create them:
// import { initStatistics, cleanupStatistics } from './statistics.js';
// import { initSettings, cleanupSettings } from './settings.js';
// import { initAbout, cleanupAbout } from './about.js';

let currentPageId = '';
let currentCleanupFunction = null;
let googleMapsScriptLoaded = false;
let googleMapsScriptPromise = null; // To track the loading promise

// Store page-specific init and cleanup functions
const pageModules = {
    'map': { init: initApp, cleanup: cleanupApp || (() => {}) },
    'api-test': { init: initApiTest, cleanup: cleanupApiTest || (() => {}) },
    'add-passenger': { init: initAddPassenger, cleanup: cleanupAddPassenger || (() => {}) },
    'passengers-list': { init: initPassengersList, cleanup: cleanupPassengersList || (() => {}) },
    // Add other pages here. Provide a default no-op cleanup if not implemented yet.
    'statistics': { init: () => console.log('Statistics page initialized'), cleanup: () => {} },
    'settings': { init: () => console.log('Settings page initialized'), cleanup: () => {} },
    'about': { init: () => console.log('About page initialized'), cleanup: () => {} },
};

async function loadPage(pageId) {
    const container = document.getElementById("main-content");
    if (!container) {
        console.error("Main content container not found!");
        return;
    }

    // 1. Run cleanup for the previous page, if any
    if (currentCleanupFunction) {
        currentCleanupFunction();
        console.log(`Cleaned up previous page: ${currentPageId}`);
    }

    // 2. Clear current content
    container.innerHTML = '';

    // 3. Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    currentPageId = pageId; // Update current page ID

    try {
        const url = `${pageId}.html`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        container.innerHTML = html;

        // 4. Load Google Maps script if it's the map page and not already loaded
        // Ensure this happens *before* map's init function is called if map relies on it
        if (pageId === 'map') {
            await loadGoogleMapsScript(); // Wait for the script to load
            googleMapsScriptLoaded = true; // Mark as loaded
        }

        // 5. Call the specific init function for the new page
        const module = pageModules[pageId];
        if (module && typeof module.init === 'function') {
            await module.init(); // Use await for async init functions
            currentCleanupFunction = module.cleanup; // Store cleanup function for next navigation
            console.log(`Initialized page: ${pageId}`);
        } else {
            console.warn(`No initialization function found for page: ${pageId}`);
        }

    } catch (err) {
        console.error("Page load error:", err);
        container.innerHTML = `<p>Error loading page: ${pageId}. Please try again.</p>`;
        currentCleanupFunction = null; // Clear cleanup if page failed to load
    }
}

async function loadGoogleMapsScript() {
    // Return the existing promise if loading is already in progress or completed
    if (googleMapsScriptPromise) {
        return googleMapsScriptPromise;
    }

    // Create a new promise to manage the script loading
    googleMapsScriptPromise = new Promise(async (resolve, reject) => {
        // Check if the script tag already exists from a previous successful load
        if (document.querySelector('script[data-google-maps-api]')) {
            console.log("Google Maps script already present in DOM.");
            googleMapsScriptLoaded = true; // Ensure flag is set
            resolve();
            return;
        }

        try {
            // Assuming window.api.getApiKey() is an Electron IPC call
            const apiKey = await window.api.getApiKey();
            const script = document.createElement("script");
            // `callback=initApp` here refers to the global `window.initApp`
            // which we will ensure calls our module's `initApp`.
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&callback=initApp`;
            script.async = true;
            script.defer = true;
            script.setAttribute('data-google-maps-api', 'true'); // Custom attribute to easily identify

            script.onload = () => {
                console.log("Google Maps script loaded successfully.");
                resolve();
            };
            script.onerror = (e) => {
                console.error("Failed to load Google Maps script:", e);
                reject(e);
            };

            document.head.appendChild(script);

        } catch (err) {
            console.error("Failed to get API key for Google Maps:", err);
            reject(err);
        }
    });

    return googleMapsScriptPromise;
}


function showPageHelp() {
    const helpMessages = {
        'add-passenger': 'Bu sayfada yeni yolcu ekleyebilirsiniz.',
        'map': 'Harita görünümü ve rota planlaması.',
        'api-test': 'API bağlantılarını test edebilirsiniz.',
        'passengers-list': 'Tüm yolcuları görüntüleyebilirsiniz.',
        'statistics': 'İstatistikleri görüntüleyebilirsiniz.',
        'settings': 'Uygulama ayarlarını düzenleyebilirsiniz.',
        'about': 'Uygulama hakkında bilgi alabilirsiniz.'
    };

    const message = helpMessages[currentPageId] || 'Bu sayfa hakkında yardım bilgisi bulunmuyor.';
    alert(message);
}

// Expose the router to the global window object for HTML to call
// This is critical for the Google Maps API `callback=initApp` to work.
window.appRouter = {
    loadPage: loadPage,
    showPageHelp: showPageHelp,
    // Google Maps API will call this global initApp function.
    // We then delegate to our module's initApp.
    initApp: (...args) => {
        if (pageModules['map'] && typeof pageModules['map'].init === 'function') {
            console.log("Google Maps API callback triggered, delegating to map module initApp.");
            pageModules['map'].init(...args);
        } else {
            console.warn("map.js initApp not ready when Google Maps callback fired. This might be a timing issue.");
        }
    }
};

// Load the initial page (e.g., 'map') when the router script loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for a hash or default to 'map'
    const initialPage = window.location.hash.slice(1) || 'home';
    window.appRouter.loadPage(initialPage);
});