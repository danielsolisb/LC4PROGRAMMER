// web/js/app.js

let projectData = {};
let monitoringPoller = null;

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
const LIGHT_ORDER = [
    'R1','A1','V1','R2','A2','V2','R3','A3','V3','R4','A4','V4',
    'R5','A5','V5','R6','A6','V6','R7','A7','V7','R8','A8','V8'
];
// --- 2. Definición de Todas las Funciones Ayudantes y de UI ---
const DAY_TYPE_MAP = {
    0: [0], // Domingo
    1: [1], // Lunes
    2: [2], // Martes
    3: [3], // Miércoles
    4: [4], // Jueves
    5: [5], // Viernes
    6: [6], // Sábado
    7: [1, 2, 3, 4, 5, 6, 0], // Todos los días
    8: [1, 2, 3, 4, 5, 6],    // Todos menos Domingo
    9: [6, 0],                // Sábado y Domingo
    10: [1, 2, 3, 4, 5],       // Todos excepto Sábado y Domingo
    11: [5, 6, 0],            // Viernes, Sábado y Domingo
    12: [1, 2, 3, 4],          // Todos menos Vie, Sáb, Dom
    13: [5, 6],                // Viernes y Sábado
    14: [7]                    // Feriados (usaremos la columna 8, índice 7)
};

// Paleta de colores profesional para asignar a los planes
const PLAN_COLORS = [
    '#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6',
    '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'
];

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
    if (monitoringPoller && viewName !== 'monitoring') {
        console.log("Saliendo de la vista de monitoreo. Deteniendo poller y comando.");
        clearInterval(monitoringPoller);
        monitoringPoller = null;
        await window.pywebview.api.stop_monitoring();
    }
    const mainContent = document.getElementById('main-content-area');
    if (mainContent.dataset.currentView === viewName && !forceReload) return;
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
        } else if (viewName === 'monitoring') {
            initializeMonitoringView();
        } else if (viewName === 'plans') {
            // --- NUEVA LLAMADA ---
            initializePlanEditor();
        }
    } catch (error) {
        console.error("Error al cargar la vista:", error);
        mainContent.innerHTML = `<div class="main-header"><h2>Error</h2></div><p>No se pudo cargar la sección solicitada.</p>`;
    }
}

/**
 * Obtiene un color consistente para un ID de plan.
 * @param {number} planId - El ID del plan.
 * @returns {string} Un color hexadecimal.
 */
function getPlanColor(planId) {
    return PLAN_COLORS[planId % PLAN_COLORS.length];
}

function initializePlanEditor() {
    const container = document.getElementById('plan-schedule-container');
    if (!container) return;
    container.innerHTML = '';

    // 1. Crear la estructura de la grilla (esto no cambia)
    const days = ['Hora', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Feriados'];
    days.forEach(day => container.insertAdjacentHTML('beforeend', `<div class="schedule-cell schedule-header">${day}</div>`));
    for (let hour = 0; hour < 24; hour++) {
        const timeStr = hour.toString().padStart(2, '0') + ':00';
        container.insertAdjacentHTML('beforeend', `<div class="schedule-cell time-slot">${timeStr}</div>`);
        for (let i = 0; i < 8; i++) {
            container.insertAdjacentHTML('beforeend', `<div class="schedule-cell"></div>`);
        }
    }

    if (!projectData || !projectData.plans || projectData.plans.length === 0) return;

    // 2. Procesar los planes en una estructura diaria (esto no cambia)
    const weeklySchedule = {};
    for (let i = 0; i < 8; i++) { weeklySchedule[i] = []; }
    projectData.plans.forEach(plan => {
        const applicableDays = DAY_TYPE_MAP[plan.day_type_id];
        if (applicableDays) {
            applicableDays.forEach(dayIndex => {
                weeklySchedule[dayIndex].push({ ...plan, startTime: plan.hour * 60 + plan.minute });
            });
        }
    });
    for (let day in weeklySchedule) {
        weeklySchedule[day].sort((a, b) => a.startTime - b.startTime);
    }

    // 3. Calcular los bloques de tiempo y dibujarlos
    for (let dayIndex = 0; dayIndex < 8; dayIndex++) { // 0=Dom, 1=Lun, ..., 7=Feriados
        const plansForToday = weeklySchedule[dayIndex];
        
        // Determinar el día anterior para la herencia de planes
        const yesterdayIndex = (dayIndex === 1) ? 0 : (dayIndex === 0) ? 6 : dayIndex - 1; // Lunes hereda de Domingo, Domingo de Sábado
        const plansFromYesterday = weeklySchedule[yesterdayIndex];
        const lastPlanFromYesterday = plansFromYesterday.length > 0 ? plansFromYesterday[plansFromYesterday.length - 1] : null;

        // Dibujar el plan heredado desde las 00:00 hasta el primer plan de hoy
        if (lastPlanFromYesterday) {
            const firstPlanStartTime = plansForToday.length > 0 ? plansForToday[0].startTime : 24 * 60;
            if (firstPlanStartTime > 0) {
                drawPlanCard(lastPlanFromYesterday, dayIndex, 0, firstPlanStartTime);
            }
        }

        // Dibujar los planes del día actual
        for (let i = 0; i < plansForToday.length; i++) {
            const currentPlan = plansForToday[i];
            const nextPlanStartTime = (i + 1 < plansForToday.length) ? plansForToday[i + 1].startTime : 24 * 60;
            drawPlanCard(currentPlan, dayIndex, currentPlan.startTime, nextPlanStartTime);
        }
    }
}
/**
 * Dibuja una tarjeta de plan en la grilla con la duración calculada.
 * @param {object} plan - El objeto del plan.
 * @param {number} dayIndex - El índice del día (0=Dom, 1=Lun...).
 * @param {number} startTimeInMinutes - Minuto de inicio del bloque.
 * @param {number} endTimeInMinutes - Minuto de fin del bloque.
 */
function drawPlanCard(plan, dayIndex, startTimeInMinutes, endTimeInMinutes) {
    const container = document.getElementById('plan-schedule-container');
    const durationInMinutes = endTimeInMinutes - startTimeInMinutes;
    if (durationInMinutes <= 0) return;

    const color = getPlanColor(plan.id);
    // Mapeo de día a la columna de la grilla (1-8)
    const dayMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 0: 7, 7: 8 };
    const column = dayMap[dayIndex];

    const card = document.createElement('div');
    card.className = 'plan-card';
    card.style.backgroundColor = color;
    
    // --- Lógica de Posicionamiento Preciso en Píxeles ---
    const headerHeight = 40;  // Altura de la cabecera en px (de CSS)
    const hourRowHeight = 45; // Altura de cada fila de hora en px (de CSS)
    
    // Calculamos la posición 'top' basada en la hora y minuto de inicio
    const topPosition = headerHeight + (startTimeInMinutes / 60) * hourRowHeight;
    // Calculamos la altura de la tarjeta basada en su duración en minutos
    const cardHeight = (durationInMinutes / 60) * hourRowHeight;

    card.style.position = 'absolute';
    card.style.top = `${topPosition}px`;
    card.style.height = `${cardHeight - 2}px`; // -2px para un pequeño margen visual

    // El posicionamiento horizontal sigue siendo porcentual
    const columnWidthPercent = 100 / 9;
    card.style.left = `${(column) * columnWidthPercent}%`; // +1 para saltar la columna de hora
    card.style.width = `calc(${columnWidthPercent}% - 4px)`; // -4px para margen

    card.innerHTML = `
        <span class="plan-card-title">Plan #${plan.id}</span>
        <span class="plan-card-details">Sec: ${plan.sequence_id}</span>
    `;
    const startHour = String(plan.hour).padStart(2,'0');
    const startMinute = String(plan.minute).padStart(2,'0');
    card.title = `Plan #${plan.id} - Sec: ${plan.sequence_id} | Inicia: ${startHour}:${startMinute}`;
    
    // Añadimos la tarjeta directamente al contenedor principal
    container.appendChild(card);
}

async function initializeMonitoringView() {
    const display = document.getElementById('monitoring-display');
    if (!display) return;

    display.innerHTML = ''; // Limpiar la vista anterior

    // 1. Reutilizamos la clase para un aspecto coherente
    display.className = 'timeline-container'; 
    // --- CAMBIO CLAVE: Se elimina la columna 'auto' del principio ---
    display.style.gridTemplateColumns = `repeat(${LIGHT_ORDER.length}, 1fr)`;

    // 2. Creamos la FILA DE CABECERA (sin la celda "Estado")
    LIGHT_ORDER.forEach(lightName => {
        display.insertAdjacentHTML('beforeend', `<div class="timeline-cell timeline-header">${lightName}</div>`);
    });

    // 3. Creamos la FILA DE DATOS (sin la celda "Real")
    LIGHT_ORDER.forEach(lightName => {
        const colorClass = lightName.startsWith('R') ? 'red' : lightName.startsWith('A') ? 'amber' : 'green';
        display.insertAdjacentHTML('beforeend', `
            <div class="timeline-cell light-indicator-container">
                <div id="monitor-light-${lightName}" class="light-indicator ${colorClass}"></div>
            </div>
        `);
    });

    // 4. El resto de la lógica para iniciar el monitoreo no cambia
    await window.pywebview.api.start_monitoring();

    if (monitoringPoller) clearInterval(monitoringPoller);
    monitoringPoller = setInterval(async () => {
        const updateJson = await window.pywebview.api.check_monitoring_update();
        if (updateJson) {
            const portData = JSON.parse(updateJson);
            updateMonitoringLights(portData);
        }
    }, 200);
}

function updateMonitoringLights(portData) {
    LIGHT_ORDER.forEach(lightName => {
        const lightElement = document.getElementById(`monitor-light-${lightName}`);
        if (!lightElement) return;

        const lightInfo = LIGHT_MAP[lightName];
        const portValue = parseInt(portData[lightInfo.port], 16);
        const isLightOn = (portValue & (1 << lightInfo.bit)) !== 0;

        lightElement.classList.toggle('on', isLightOn);
    });
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
