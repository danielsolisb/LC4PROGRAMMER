// web/js/app.js (Solución Definitiva)

// Banderas de estado para la inicialización segura.
let domReady = false;
let apiReady = false;

/**
 * Lógica asíncrona principal. Obtiene los datos del backend y actualiza la UI.
 * Esta función es 'async' para poder usar 'await'.
 */
async function runAsyncInitialization() {
    console.log("runAsyncInitialization: Ejecutando. Solicitando datos al backend...");
    try {
        const initialState = await window.pywebview.api.get_initial_ui_data();
        console.log("Datos iniciales recibidos:", initialState);

        if (initialState) {
            document.getElementById('info-id').textContent = initialState.controller_id || 'N/A';
            document.getElementById('info-date').textContent = initialState.date || 'N/A';
            document.getElementById('info-time').textContent = initialState.time || 'N/A';
            updateAppConnectionStatus(initialState.is_connected);
        }
    } catch (e) {
        console.error("Error fatal al obtener datos iniciales:", e);
        document.getElementById('info-id').textContent = 'Error de Carga';
    }
}

/**
 * Función de verificación SÍNCRONA. Se llama después de cada evento clave.
 * Su único trabajo es comprobar si todo está listo y disparar la lógica asíncrona
 * de una manera que no devuelva la Promise.
 */
function tryToInitialize() {
    console.log(`tryToInitialize: Verificando estados -> DOM Listo: ${domReady}, API Lista: ${apiReady}`);
    
    // El "cerrojo de doble llave": solo proceder si ambas banderas son verdaderas.
    if (domReady && apiReady) {
        console.log("¡Ambas condiciones cumplidas! Lanzando la inicialización.");
        
        // Patrón "Fire-and-Forget": llamamos a la función async pero no la esperamos (await),
        // lo que evita que la Promise se propague hacia arriba.
        runAsyncInitialization().catch(e => {
            // Agregamos un .catch aquí por si la propia Promise falla,
            // para que el error se muestre en la consola de JS y no se pierda.
            console.error("Error no controlado en la ejecución asíncrona:", e);
        });
    }
}

// --- CONFIGURACIÓN DE LOS EVENT LISTENERS ---

// 1. Esperamos a que el DOM (la estructura HTML) esté listo.
window.addEventListener('DOMContentLoaded', () => {
    console.log("EVENTO: DOMContentLoaded -> El DOM está listo.");
    domReady = true; // Giramos la primera llave.
    tryToInitialize(); // Verificamos si la otra llave ya estaba girada.
});

// 2. Esperamos a que la API de pywebview esté lista.
window.addEventListener('pywebviewready', () => {
    console.log("EVENTO: pywebviewready -> La API de Python está lista.");
    apiReady = true; // Giramos la segunda llave.
    tryToInitialize(); // Verificamos si la otra llave ya estaba girada.
});


// --- FUNCIONES AUXILIARES (sin cambios) ---

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
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => { section.style.display = 'none'; });
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => { link.classList.remove('active'); });
    const activeSection = document.getElementById(sectionId + '-section');
    if (activeSection) { activeSection.style.display = 'block'; }
    const activeLink = document.getElementById('nav-' + sectionId);
    if (activeLink) { activeLink.classList.add('active'); }
}

async function goBackToWelcome() {
    console.log("Regresando a la pantalla de bienvenida...");
    await window.pywebview.api.go_to_welcome();
}
