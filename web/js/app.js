document.addEventListener('DOMContentLoaded', function() {
    loadDashboardData();
    showSection('dashboard');
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'capture') {
        console.log("Modo Captura activado.");
    } else {
        console.log("Modo Nuevo activado.");
    }
});

async function loadDashboardData() {
    try {
        const data = await window.pywebview.api.get_dashboard_data();
        if (data) {
            document.getElementById('info-id').textContent = data.controller_id || '--';
            document.getElementById('info-date').textContent = data.date || '--';
            document.getElementById('info-time').textContent = data.time || '--';
        }
    } catch (e) {
        console.error("Error al cargar los datos del dashboard:", e);
    }
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

// --- FUNCIÓN DE REGRESO RESTAURADA ---
async function goBackToWelcome() {
    console.log("Regresando a la pantalla de bienvenida...");
    const url = await window.pywebview.api.go_to_welcome();
    if (url) {
        window.location.href = url;
    }
}
