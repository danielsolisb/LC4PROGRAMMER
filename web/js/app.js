/**
 * --- LÓGICA DE INICIALIZACIÓN PRINCIPAL ---
 * Se ejecuta una sola vez cuando la página está completamente cargada y la API de Python está lista.
 */
window.addEventListener('pywebviewready', async () => {
    // --- CORRECCIÓN AQUÍ ---
    // Verificación defensiva: ¿Estamos realmente en la página de la app?
    // Usamos document.querySelector para buscar por CLASE, no por ID.
    if (!document.querySelector('.app-container')) {
        // Si no estamos en la app, no hacemos nada. Esto evita errores de sincronización.
        return; 
    }

    console.log("App.js: pywebview está listo. Solicitando datos iniciales a Python...");
    try {
        const initialState = await window.pywebview.api.get_initial_ui_data();
        console.log("App.js: Datos iniciales recibidos.", initialState);
        
        if (initialState) {
            document.getElementById('info-id').textContent = initialState.controller_id || 'No disponible';
            document.getElementById('info-date').textContent = initialState.date || 'No disponible';
            document.getElementById('info-time').textContent = initialState.time || 'No disponible';
            
            updateAppConnectionStatus(initialState.is_connected);
        }
    } catch (e) {
        console.error("App.js: Error fatal al obtener datos iniciales.", e);
    }
    
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
 * Llama a la API de Python para guardar el proyecto.
 */
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

/**
 * Maneja el clic en el botón de desconectar. Delega toda la lógica a Python.
 */
async function handleAppDisconnect() {
    console.log("JS: Solicitando a Python que maneje la desconexión...");
    await window.pywebview.api.confirm_and_disconnect();
}

/**
 * Muestra una sección principal y actualiza la navegación.
 * @param {string} sectionId - El ID de la sección a mostrar.
 */
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

/**
 * Llama a la API de Python para volver a la pantalla de bienvenida.
 */
async function goBackToWelcome() {
    console.log("Regresando a la pantalla de bienvenida...");
    await window.pywebview.api.go_to_welcome();
}
