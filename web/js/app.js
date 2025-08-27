// web/js/app.js

import { api } from './api.js';
import { setProjectData, getProjectData } from './store.js';
import { showLoadingModal } from './ui.js';
import { initializeDashboardView } from './views/dashboard.js';
import { initializeSequencesView } from './views/sequences.js';
import { initializePlansView } from './views/plans.js';
import { initializeMonitoringView, cleanupMonitoringView } from './views/monitoring.js';
import { initializePlanVisualizerView } from './views/plan-visualizer.js';
import { initializeConfigView } from './views/config.js';
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
        // Si intentamos cargar la vista 'sequences', redirigimos a 'config'
        const viewToLoad = viewName === 'sequences' ? 'config' : viewName;

        const response = await fetch(`/web/html/views/${viewToLoad}.html`);
        if (!response.ok) throw new Error(`Error al cargar HTML de la vista: ${response.status}`);

        mainContent.innerHTML = await response.text();
        mainContent.dataset.currentView = viewToLoad;

        // Activa el enlace de navegación correcto
        document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById(`nav-${viewName}`).classList.add('active'); // Mantenemos el enlace original activo

        // Llama a la función de inicialización específica de la vista
        switch (viewToLoad) {
            case 'dashboard':
                initializeDashboardView();
                break;
            // ELIMINADO: El caso 'sequences' ya no es necesario
            case 'plans':
                initializePlansView();
                break;
            case 'monitoring':
                initializeMonitoringView();
                break;
            case 'plan-visualizer':
                initializePlanVisualizerView();
                break;
            case 'config':
                initializeConfigView();
                // Si venimos del enlace 'sequences', abrimos la pestaña correcta
                if (viewName === 'sequences') {
                    setTimeout(() => {
                        document.querySelector('.config-tab[data-tab="tab-sequences"]').click();
                    }, 100);
                }
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

/**
 * Actualiza el estado (activado/desactivado) de los botones de la barra lateral
 * según el estado de la conexión.
 */
function updateSidebarButtons(isConnected) {
    const factoryResetBtn = document.getElementById('btn-factory-reset');
    const uploadBtn = document.getElementById('btn-upload'); // ID que le daremos al botón

    if (factoryResetBtn) {
        factoryResetBtn.classList.toggle('sidebar-link-disabled', !isConnected);
    }
    if (uploadBtn) {
        uploadBtn.classList.toggle('sidebar-link-disabled', !isConnected);
    }
}

/**
 * Orquesta el flujo de reseteo de fábrica.
 */
async function handleFactoryReset() {
    const status = await api.getConnectionStatus();
    if (!status.is_connected) return; // Doble chequeo de seguridad

    const modal = document.getElementById('factory-reset-modal');
    const confirmInput = document.getElementById('factory-reset-confirm-input');
    const confirmBtn = document.getElementById('factory-reset-confirm-btn');
    const cancelBtn = document.getElementById('factory-reset-cancel-btn');
    const confirmationText = "BORRAR TODO";

    // Resetear el estado del modal cada vez que se abre
    confirmInput.value = "";
    confirmBtn.disabled = true;
    modal.classList.add('visible');

    const onConfirm = async () => {
        showLoadingModal(true);
        modal.classList.remove('visible');
        const result = await api.factoryReset();

        if (result.status === 'success') {
            alert("Reseteo de fábrica completado. El software se reiniciará con una nueva configuración.");
            // Forzamos una recarga completa de la aplicación en modo "proyecto nuevo"
            runNewProjectFlow();
        } else {
            alert(`Error: ${result.message}`);
        }
        showLoadingModal(false);

        // Limpiar listeners para evitar duplicados
        confirmInput.removeEventListener('input', onInput);
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
    };

    const onCancel = () => {
        modal.classList.remove('visible');
         // Limpiar listeners para evitar duplicados
        confirmInput.removeEventListener('input', onInput);
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
    };

    const onInput = () => {
        confirmBtn.disabled = confirmInput.value !== confirmationText;
    };

    confirmInput.addEventListener('input', onInput);
    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
}

/**
 * Orquesta el flujo para subir la configuración al controlador.
 */
async function handleUpload() {
    if (!confirm("¿Estás seguro de que quieres subir la configuración actual al controlador? Esto sobrescribirá todos los datos existentes en el dispositivo.")) {
        return;
    }

    showLoadingModal(true, "Subiendo configuración, por favor espere...");
    await api.uploadConfiguration(getProjectData());

    // Usamos el mismo sistema de "poller" que la captura para esperar el resultado
    const poller = setInterval(async () => {
        try {
            // Reutilizamos checkCaptureResult porque usa la misma cola (ui_queue)
            const resultJson = await api.checkCaptureResult();
            if (resultJson) {
                clearInterval(poller);
                const result = JSON.parse(resultJson);
                showLoadingModal(false);
                alert(result.message);
            }
        } catch (e) {
            clearInterval(poller);
            showLoadingModal(false);
            alert("Ocurrió un error al verificar el resultado de la subida.");
        }
    }, 500); // Chequeamos cada medio segundo
}

// --- PUNTO DE ENTRADA PRINCIPAL ---

// Asignar funciones a los botones globales que son accesibles desde el objeto window
// porque los 'onclick' en el HTML los buscan ahí.
window.loadView = loadView;
window.goBackToWelcome = api.goToWelcome;
window.handleSaveGlobal = async () => {
    try {
        await api.updateProjectData(getProjectData());
        const result = await api.saveProjectFile();
        alert(result.message);
    } catch (e) {
        console.error("Error al guardar:", e);
        alert("Ocurrió un error al guardar el proyecto.");
    }
};
window.handleAppDisconnect = api.confirmAndDisconnect;
// NUEVA ASIGNACIÓN
window.handleFactoryReset = handleFactoryReset;

window.handleUpload = handleUpload;

// Evento que se dispara cuando la API de Python está lista.
window.addEventListener('pywebviewready', async () => {
    console.log("EVENTO: pywebviewready -> La API y el DOM están listos.");
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const status = await api.getConnectionStatus();
    updateSidebarButtons(status.is_connected);
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