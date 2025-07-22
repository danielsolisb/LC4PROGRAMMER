// web/js/app.js

// Este objeto contendrá toda la configuración del proyecto
let projectData = {};


// --- Lógica de Inicialización ---
window.addEventListener('pywebviewready', () => {
    console.log("EVENTO: pywebviewready -> La API y el DOM están listos.");
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action'); // Puede ser 'capture', 'new', 'open' o null

    // Usamos un switch para manejar los diferentes casos de carga
    switch (action) {
        case 'capture':
            runCaptureFlow();
            break;
            
        case 'load':
            runLoadFileFlow();
            break;

        case 'new':
        case 'open': // 'open' ya no se usa, pero lo dejamos por si acaso
            runNewProjectFlow();
            break;
        
        default:
            runNewProjectFlow();
            break;
    }
});


/**
 * Esta función es llamada DIRECTAMENTE por Python cuando la captura ha finalizado.
 * @param {object} fullProjectData - El objeto JS con TODOS los datos del proyecto.
 */
function onCaptureComplete(fullProjectData) {
    console.log("Función onCaptureComplete llamada por Python. Datos COMPLETOS recibidos:", fullProjectData);
    
    // 1. Almacenamos el objeto completo en nuestra variable global.
    projectData = fullProjectData;

    // 2. Actualizamos la UI del dashboard usando la información del objeto completo.
    // Pasamos la sección 'info' y el estado de conexión a la función de actualización.
    updateDashboard(projectData.info, projectData.is_connected);

    // 3. Ocultar el modal de carga.
    const modal = document.getElementById('loading-modal');
    modal.classList.remove('visible');
}

async function runLoadFileFlow() {
    console.log("Cargando datos de proyecto desde el backend (archivo)...");
    try {
        // Python ya cargó el archivo, ahora solo pedimos los datos desde la memoria
        const loadedData = await window.pywebview.api.get_project_data_from_memory();
        projectData = loadedData;
        console.log("Datos del archivo cargados en JS:", projectData);

        // Actualizamos el dashboard. Al abrir un archivo, el estado de conexión
        // puede ser cualquiera, por eso lo leemos del objeto que nos envía Python.
        updateDashboard(projectData.info, projectData.is_connected); 
    } catch (e) {
        console.error("Error al cargar datos del archivo:", e);
        alert("Ocurrió un error al mostrar los datos del archivo cargado.");
    }
}

async function runCaptureFlow() {
    const modal = document.getElementById('loading-modal');
    try {
        modal.classList.add('visible');
        console.log("Iniciando captura de datos desde el backend...");
        // La llamada a Python no cambia, solo lo que Python hace internamente.
        await window.pywebview.api.perform_full_capture();
    } catch (e) {
        console.error("Error al invocar la captura:", e);
        alert("Ocurrió un error al iniciar la captura. Revise la consola.");
        modal.classList.remove('visible');
    }
}

// --- FUNCIÓN MODIFICADA ---
// Ahora la función de actualización del dashboard es más específica.
/**
 * Actualiza los elementos del dashboard.
 * @param {object} infoData - El objeto 'info' del proyecto.
 * @param {boolean} isConnected - El estado de la conexión.
 */
function updateDashboard(infoData, isConnected) {
    if (infoData) {
        document.getElementById('info-id').textContent = infoData.controller_id || 'N/A';
        document.getElementById('info-date').textContent = infoData.date || 'N/A';
        document.getElementById('info-time').textContent = infoData.time || 'N/A';
    }
    // El estado de conexión se maneja por separado.
    updateAppConnectionStatus(isConnected);
}

// --- El resto de las funciones no necesitan cambios ---

async function runNewProjectFlow() {
    console.log("Inicialización para un proyecto nuevo.");
    projectData = {}; 
    try {
        const status = await window.pywebview.api.get_connection_status();
        updateDashboard({}, status.is_connected); 
    } catch (e) {
        console.error("Error durante la inicialización de nuevo proyecto:", e);
        updateDashboard({}, false);
    }
}

function updateAppConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('app-status-indicator');
    if (!statusIndicator) return;
    statusIndicator.textContent = isConnected ? 'Conectado' : 'Desconectado';
    statusIndicator.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
    if (isConnected) {
        statusIndicator.style.backgroundColor = '#2ecc71';
    } else {
        statusIndicator.style.backgroundColor = '#e74c3c';
    }
}

async function handleSaveGlobal() {
    console.log("JS: Solicitando a Python que guarde el proyecto...");
    // No se necesita enviar datos, Python ya los tiene en self._controller.project_data
    try {
        const result = await window.pywebview.api.save_project_file();
        alert(result.message);
    } catch (e) {
        console.error("Error al intentar guardar el proyecto:", e);
        alert("Ocurrió un error inesperado al guardar el proyecto.");
    }
}

async function handleAppDisconnect() {
    console.log("JS: Solicitando a Python que maneje la desconexión...");
    await window.pywebview.api.confirm_and_disconnect();
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.classList.remove('active');
    });
    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) {
        activeSection.style.display = 'block';
    }
    const activeLink = document.getElementById('nav-' + sectionId);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

async function goBackToWelcome() {
    console.log("Regresando a la pantalla de bienvenida...");
    await window.pywebview.api.go_to_welcome();
}
