/**
 * Es llamada por Python para inicializar TODA la UI con el estado inicial.
 * @param {object} initialState - Objeto con datos del dashboard y estado de conexión.
 */
function initializeUI(initialState) {
    console.log("Intentando inicializar UI con datos de Python:", initialState);

    // --- ¡SOLUCIÓN AQUÍ! ---
    // Comprobación defensiva: ¿Estamos en la página correcta?
    // Verificamos si el elemento principal del dashboard existe.
    const dashboardIdElement = document.getElementById('info-id');
    if (!dashboardIdElement) {
        // Si no existe, significa que la página cambió antes de que llegaran los datos.
        // Abortamos la función silenciosamente para evitar el error.
        console.log("Abortando inicialización de UI: Elementos del dashboard no encontrados. Probablemente la página cambió.");
        return; 
    }

    // Si la comprobación pasa, es seguro continuar.
    console.log("Elementos encontrados. Inicializando UI...");
    if (initialState) {
        dashboardIdElement.textContent = initialState.controller_id || 'No disponible';
        document.getElementById('info-date').textContent = initialState.date || 'No disponible';
        document.getElementById('info-time').textContent = initialState.time || 'No disponible';
    }
    
    updateAppConnectionStatus(initialState.is_connected);
}

/**
 * Actualiza la UI del indicador de estado.
 * @param {boolean} isConnected - El estado de la conexión.
 */
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

/**
 * Maneja el clic en el botón de desconectar. Delega toda la lógica a Python.
 */
async function handleAppDisconnect() {
    console.log("JS: Solicitando a Python que maneje la desconexión...");
    await window.pywebview.api.confirm_and_disconnect();
}


// --- El resto de las funciones no cambian ---
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

document.addEventListener('DOMContentLoaded', () => {
    showSection('dashboard');
});
