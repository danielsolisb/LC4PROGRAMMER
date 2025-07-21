/**
 * ESTA FUNCIÓN AHORA ES LA ENTRADA DE DATOS DESDE PYTHON
 * @param {object} data - Un objeto con los datos del dashboard.
 */
function populateDashboard(data) {
    console.log("Datos recibidos desde Python:", data);
    if (data) {
        document.getElementById('info-id').textContent = data.controller_id || 'No disponible';
        document.getElementById('info-date').textContent = data.date || 'No disponible';
        document.getElementById('info-time').textContent = data.time || 'No disponible';
    }
}

/**
 * Muestra una sección principal y actualiza la navegación.
 * @param {string} sectionId - El ID de la sección a mostrar (ej. 'dashboard').
 */
function showSection(sectionId) {
    // Esta función no cambia
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

// YA NO NECESITAMOS EL EVENT LISTENER 'pywebviewready' PARA CARGAR DATOS
// La página simplemente se carga y espera a que Python le envíe la información.
// Todavía mostramos el dashboard por defecto al cargar.
document.addEventListener('DOMContentLoaded', () => {
    showSection('dashboard');
});