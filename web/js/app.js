// web/js/app.js

import { api } from './api.js';
import { setProjectData, getProjectData } from './store.js';
import { showLoadingModal } from './ui.js';
import { initializeDashboardView } from './views/dashboard.js';
import { initializeSequencesView } from './views/sequences.js';
import { initializePlansView } from './views/plans.js';
import { initializeMonitoringView, cleanupMonitoringView } from './views/monitoring.js';
import { initializePlanVisualizerView } from './views/plan-visualizer.js';

/**
 * Carga el contenido de una vista (HTML) en el área principal y luego
 * llama a la función de inicialización de JavaScript correspondiente.
 * @param {string} viewName - El nombre de la vista a cargar (ej: 'dashboard').
 * @param {boolean} forceReload - Si debe forzar la recarga de la vista.
 */
async function loadView(viewName, forceReload = false) {
    const mainContent = document.getElementById('main-content-area');
    
    // Limpia la vista de monitoreo anterior si se cambia de vista
    if (mainContent.dataset.currentView === 'monitoring' && viewName !== 'monitoring') {
        await cleanupMonitoringView();
    }

    if (mainContent.dataset.currentView === viewName && !forceReload) return;

    try {
        const response = await fetch(`/web/html/views/${viewName}.html`);
        if (!response.ok) throw new Error(`Error al cargar HTML de la vista: ${response.status}`);
        
        mainContent.innerHTML = await response.text();
        mainContent.dataset.currentView = viewName;

        // Activa el enlace de navegación correcto
        document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById(`nav-${viewName}`).classList.add('active');

        // Llama a la función de inicialización específica de la vista
        switch (viewName) {
            case 'dashboard':
                initializeDashboardView();
                break;
            case 'sequences':
                initializeSequencesView();
                break;
            case 'plans':
                initializePlansView();
                break;
            case 'monitoring':
                initializeMonitoringView();
                break;
            case 'plan-visualizer':
                initializePlanVisualizerView();
                break;
        }
    } catch (error) {
        console.error(`Error al cargar la vista ${viewName}:`, error);
        mainContent.innerHTML = `<div class="main-header"><h2>Error</h2></div><p>No se pudo cargar la sección solicitada.</p>`;
    }
}

/**
 * Flujo de trabajo para capturar datos del controlador.
 */
function runCaptureFlow() {
    showLoadingModal(true);
    api.performFullCapture();

    const poller = setInterval(async () => {
        try {
            const resultJson = await api.checkCaptureResult();
            if (resultJson) {
                clearInterval(poller);
                const resultData = JSON.parse(resultJson);
                setProjectData(resultData);
                await loadView('dashboard', true);
                showLoadingModal(false);
            }
        } catch (e) {
            console.error("Error en el poller de captura:", e);
            clearInterval(poller);
            showLoadingModal(false);
            alert("Ocurrió un error al verificar el resultado de la captura.");
        }
    }, 200);
}

/**
 * Flujo de trabajo para cargar datos desde un archivo de proyecto.
 */
async function runLoadFileFlow() {
    try {
        const data = await api.getProjectDataFromMemory();
        setProjectData(data);
        await loadView('dashboard', true);
    } catch (e) {
        console.error("Error al cargar datos del archivo:", e);
    }
}

/**
 * Flujo de trabajo para un proyecto nuevo.
 */
async function runNewProjectFlow() {
    const status = await api.getConnectionStatus();
    setProjectData({ is_connected: status.is_connected });
    await loadView('dashboard', true);
}


// --- PUNTO DE ENTRADA PRINCIPAL ---

// Asignar funciones a los botones globales que son accesibles desde el objeto window
// porque los 'onclick' en el HTML los buscan ahí.
window.loadView = loadView;
window.goBackToWelcome = api.goToWelcome;
window.handleSaveGlobal = async () => {
    try {
        const result = await api.saveProjectFile();
        alert(result.message);
    } catch (e) {
        console.error("Error al guardar:", e);
        alert("Ocurrió un error al guardar el proyecto.");
    }
};
window.handleAppDisconnect = api.confirmAndDisconnect;


// Evento que se dispara cuando la API de Python está lista.
window.addEventListener('pywebviewready', async () => {
    console.log("EVENTO: pywebviewready -> La API y el DOM están listos.");
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    // Cargar siempre el dashboard primero para tener una base
    await loadView('dashboard');

    // Ejecutar el flujo correspondiente basado en la acción de la URL
    switch (action) {
        case 'capture':
            runCaptureFlow();
            break;
        case 'load':
            runLoadFileFlow();
            break;
        case 'new':
            runNewProjectFlow();
            break;
    }
});