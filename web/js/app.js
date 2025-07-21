/**
 * --- LÓGICA DE INICIALIZACIÓN PRINCIPAL ---
 * Se ejecuta una sola vez cuando la página está completamente cargada y la API de Python está lista.
 */
window.addEventListener('pywebviewready', async () => {
    console.log("App.js: pywebview está listo. Solicitando datos iniciales a Python...");
    try {
        // 1. Llama a Python para obtener todos los datos iniciales en un solo paquete.
        const initialState = await window.pywebview.api.get_initial_ui_data();
        console.log("App.js: Datos iniciales recibidos.", initialState);
        
        // 2. Rellena el dashboard con los datos recibidos.
        if (initialState) {
            document.getElementById('info-id').textContent = initialState.controller_id || 'No disponible';
            document.getElementById('info-date').textContent = initialState.date || 'No disponible';
            document.getElementById('info-time').textContent = initialState.time || 'No disponible';
            
            // 3. Actualiza el indicador de estado de la conexión.
            updateAppConnectionStatus(initialState.is_connected);
        }
    } catch (e) {
        console.error("App.js: Error fatal al obtener datos iniciales.", e);
        // Manejar error en la UI si es necesario
    }
    
    // 4. Muestra la sección del dashboard por defecto.
    showSection('dashboard');
});


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