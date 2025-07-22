// web/js/app.js

// --- 1. Variables Globales y Constantes ---
let projectData = {};

const LIGHT_MAP = {
    // Puerto D
    'R1': { port: 'portD', bit: 7 }, 'A1': { port: 'portD', bit: 6 }, 'V1': { port: 'portD', bit: 5 },
    'R2': { port: 'portD', bit: 4 }, 'A2': { port: 'portD', bit: 3 }, 'V2': { port: 'portD', bit: 2 },
    'R3': { port: 'portD', bit: 1 }, 'A3': { port: 'portD', bit: 0 },
    // Puerto E
    'V3': { port: 'portE', bit: 7 }, 'R4': { port: 'portE', bit: 6 }, 'A4': { port: 'portE', bit: 5 },
    'V4': { port: 'portE', bit: 4 }, 'R5': { port: 'portE', bit: 3 }, 'A5': { port: 'portE', bit: 2 },
    'V5': { port: 'portE', bit: 1 }, 'R6': { port: 'portE', bit: 0 },
    // Puerto F
    'A6': { port: 'portF', bit: 7 }, 'V6': { port: 'portF', bit: 6 }, 'R7': { port: 'portF', bit: 5 },
    'A7': { port: 'portF', bit: 4 }, 'V7': { port: 'portF', bit: 3 }, 'R8': { port: 'portF', bit: 2 },
    'A8': { port: 'portF', bit: 1 }, 'V8': { port: 'portF', bit: 0 },
};

// La lista ordenada de luces no cambia, sigue siendo nuestra guía para la UI.
const LIGHT_ORDER = [
    'R1','A1','V1','R2','A2','V2','R3','A3','V3','R4','A4','V4',
    'R5','A5','V5','R6','A6','V6','R7','A7','V7','R8','A8','V8'
];


// --- 2. Definición de Todas las Funciones Ayudantes y de UI ---

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

function updateDashboard(infoData, isConnected) {
    if (infoData) {
        document.getElementById('info-id').textContent = infoData.controller_id || '--';
        document.getElementById('info-date').textContent = infoData.date || '--';
        document.getElementById('info-time').textContent = infoData.time || '--';
    } else {
        document.getElementById('info-id').textContent = '--';
        document.getElementById('info-date').textContent = '--';
        document.getElementById('info-time').textContent = '--';
    }
    updateAppConnectionStatus(isConnected);
}

function initializeSequenceEditor() {
    const selector = document.getElementById('sequence-selector');
    // Verificamos que el selector exista antes de manipularlo
    if (!selector) return; 

    selector.innerHTML = '<option value="">-- Seleccione una secuencia --</option>';
    if (projectData && projectData.sequences) {
        projectData.sequences.forEach(seq => {
            const option = new Option(`Secuencia #${seq.id}`, seq.id);
            selector.add(option);
        });
    }
    const timelineContainer = document.getElementById('timeline-container');
    if (timelineContainer) {
        timelineContainer.innerHTML = '';
    }
}

function displaySelectedSequence() {
    const selector = document.getElementById('sequence-selector');
    const sequenceId = parseInt(selector.value, 10);
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = '';

    if (isNaN(sequenceId)) return;
    const sequence = projectData.sequences.find(s => s.id === sequenceId);
    if (!sequence) return;

    timelineContainer.style.gridTemplateColumns = `auto repeat(${LIGHT_ORDER.length}, 1fr) auto`;
    timelineContainer.insertAdjacentHTML('beforeend', '<div class="timeline-cell timeline-header">Mov.</div>');
    LIGHT_ORDER.forEach(lightName => {
        timelineContainer.insertAdjacentHTML('beforeend', `<div class="timeline-cell timeline-header">${lightName}</div>`);
    });
    timelineContainer.insertAdjacentHTML('beforeend', '<div class="timeline-cell timeline-header">Tiempos</div>');

    sequence.movements.forEach(movementId => {
        const movement = projectData.movements.find(m => m.id === movementId);
        if (!movement) return;
        timelineContainer.insertAdjacentHTML('beforeend', `<div class="timeline-cell movement-name">Movimiento ${movement.id}</div>`);
        LIGHT_ORDER.forEach(lightName => {
            const lightInfo = LIGHT_MAP[lightName];
            const portValue = parseInt(movement[lightInfo.port], 16);
            const isLightOn = (portValue & (1 << lightInfo.bit)) !== 0;
            const colorClass = lightName.startsWith('R') ? 'red' : lightName.startsWith('A') ? 'amber' : 'green';
            const onClass = isLightOn ? 'on' : '';
            timelineContainer.insertAdjacentHTML('beforeend', `
                <div class="timeline-cell light-indicator-container">
                    <div class="light-indicator ${colorClass} ${onClass}"></div>
                </div>
            `);
        });
        const timesString = `[${movement.times.join(', ')}]`;
        timelineContainer.insertAdjacentHTML('beforeend', `<div class="timeline-cell movement-times">${timesString}</div>`);
    });
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

async function goBackToWelcome() {
    console.log("Regresando a la pantalla de bienvenida...");
    await window.pywebview.api.go_to_welcome();
}


// --- 3. Lógica Principal de Carga de Vistas ---

async function loadView(viewName, forceReload = false) {
    const mainContent = document.getElementById('main-content-area');
    if (mainContent.dataset.currentView === viewName && !forceReload) {
        return;
    }
    try {
        const response = await fetch(`/web/html/views/${viewName}.html`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        mainContent.innerHTML = html;
        mainContent.dataset.currentView = viewName;

        document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById(`nav-${viewName}`).classList.add('active');

        if (viewName === 'dashboard') {
            updateDashboard(projectData.info, projectData.is_connected);
        } else if (viewName === 'sequences') {
            initializeSequenceEditor();
            if (projectData.sequences && projectData.sequences.length > 0) {
                document.getElementById('sequence-selector').value = projectData.sequences[0].id;
                displaySelectedSequence();
            }
        }
    } catch (error) {
        console.error("Error al cargar la vista:", error);
        mainContent.innerHTML = `<div class="main-header"><h2>Error</h2></div><p>No se pudo cargar la sección solicitada.</p>`;
    }
}


// --- 4. Lógica de Flujo de Datos y Eventos ---

function onCaptureComplete(fullProjectData) {
    console.log("Datos COMPLETOS recibidos:", fullProjectData);
    projectData = fullProjectData;
    // La función loadView se encargará de actualizar el dashboard
    loadView('dashboard', true); 
    
    const modal = document.getElementById('loading-modal');
    modal.classList.remove('visible');
}

async function runCaptureFlow() {
    const modal = document.getElementById('loading-modal');
    try {
        modal.classList.add('visible');
        // 1. Le pedimos a Python que inicie la captura en segundo plano.
        //    Esta llamada termina inmediatamente.
        window.pywebview.api.perform_full_capture();

        // 2. Iniciamos un "poller" que preguntará a Python cada 200ms
        //    si los datos ya están listos.
        const poller = setInterval(async () => {
            try {
                const resultJson = await window.pywebview.api.check_capture_result();
                
                // Si el resultado ya no es nulo, significa que Python nos dio los datos.
                if (resultJson) {
                    console.log("Poller: ¡Resultado recibido de Python!");
                    // Detenemos el "preguntador" para no hacer más llamadas.
                    clearInterval(poller);
                    
                    // Convertimos el texto JSON a un objeto y llamamos a la función final.
                    const resultData = JSON.parse(resultJson);
                    onCaptureComplete(resultData);
                } else {
                    // Si es nulo, simplemente esperamos a la siguiente pregunta.
                    console.log("Poller: Aún sin resultados, preguntando de nuevo...");
                }
            } catch (e) {
                console.error("Error dentro del poller:", e);
                clearInterval(poller); // Detenemos en caso de error
                modal.classList.remove('visible');
                alert("Ocurrió un error al verificar el resultado de la captura.");
            }
        }, 200); // Preguntamos 5 veces por segundo.

    } catch (e) {
        console.error("Error al invocar la captura:", e);
        alert("Ocurrió un error al iniciar la captura. Revise la consola.");
        modal.classList.remove('visible');
    }
}

async function runLoadFileFlow() {
    console.log("Cargando datos de proyecto desde archivo...");
    try {
        projectData = await window.pywebview.api.get_project_data_from_memory();
        console.log("Datos del archivo cargados en JS:", projectData);
        loadView('dashboard', true);
    } catch (e) {
        console.error("Error al cargar datos del archivo:", e);
    }
}

async function runNewProjectFlow() {
    console.log("Inicialización para un proyecto nuevo.");
    projectData = {};
    try {
        const status = await window.pywebview.api.get_connection_status();
        updateDashboard({}, status.is_connected);
    } catch (e) {
        updateDashboard({}, false);
    }
}

// --- 5. Punto de Entrada Principal ---
window.addEventListener('pywebviewready', () => {
    console.log("EVENTO: pywebviewready -> La API y el DOM están listos.");
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');

    loadView('dashboard'); // Siempre cargamos el dashboard primero

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
