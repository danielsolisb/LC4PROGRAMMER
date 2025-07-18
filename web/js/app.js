document.addEventListener('DOMContentLoaded', function() {
    showSection('dashboard');
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');

    if (mode === 'capture') {
        console.log("Modo Captura activado. Iniciando proceso...");
    } else {
        console.log("Modo Nuevo activado.");
    }
});

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.style.display = 'none';
    });
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
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

/**
 * Llama a la API de Python para obtener la URL de bienvenida y navega hacia ella.
 */
async function goBackToWelcome() {
    console.log("Regresando a la pantalla de bienvenida...");
    const url = await window.pywebview.api.go_to_welcome();
    if (url) {
        window.location.href = url;
    }
}
