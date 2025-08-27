// web/js/views/plan-visualizer.js

import { getProjectData } from '../store.js';
import { LIGHT_MAP, LIGHT_ORDER } from '../constants.js';

// --- Constantes y Mapeos (sin cambios) ---
const DAY_TYPE_LEGEND = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Todos los días', 8: 'Todos los días menos Domingos', 9: 'Sábado y Domingo', 10: 'Todos excepto Sábado y Domingo', 11: 'Viernes, Sábado y Domingo', 12: 'Todos menos Vie, Sáb, Dom', 13: 'Viernes y Sábado', 14: 'Feriados' };
const GROUP_LIGHTS = { 1: ['R1', 'A1', 'V1'], 2: ['R2', 'A2', 'V2'], 3: ['R3', 'A3', 'V3'], 4: ['R4', 'A4', 'V4'], 5: ['R5', 'A5', 'V5'], 6: ['R6', 'A6', 'V6'], 7: ['R7', 'A7', 'V7'], 8: ['R8', 'A8', 'V8'] };

// --- Funciones de Renderizado (sin cambios en su lógica interna) ---
function renderLegend() {
    const legendContainer = document.getElementById('legend-content');
    let html = `<h5>Colores de Estado</h5><div class="legend-item"><span class="color-box green"></span>Verde (Paso)</div><div class="legend-item"><span class="color-box amber"></span>Ámbar (Precaución)</div><div class="legend-item"><span class="color-box red"></span>Rojo (Detener)</div><div class="legend-item"><span class="color-box gray"></span>Apagado</div><div class="legend-item"><span class="color-box violet"></span>Conflicto</div><div class="legend-item"><span class="color-box amber intermittent"></span>Intermitente</div><hr><h5>Tipos de Día</h5>`;
    for (const key in DAY_TYPE_LEGEND) { html += `<p><b>${key}:</b> ${DAY_TYPE_LEGEND[key]}</p>`; }
    legendContainer.innerHTML = html;
}

function renderPlanTabs(plans) {
    const tabsContainer = document.getElementById('plan-tabs-container');
    tabsContainer.innerHTML = '';
    if (!plans || plans.length === 0) { tabsContainer.innerHTML = '<p>No hay planes configurados.</p>'; return; }
    plans.forEach((plan, index) => {
        const tab = document.createElement('button');
        tab.className = 'plan-tab' + (index === 0 ? ' active' : '');
        tab.textContent = `Plan #${plan.id}`;
        tab.dataset.planId = plan.id;
        tab.addEventListener('click', () => {
            document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderPlanDetails(plan.id);
        });
        tabsContainer.appendChild(tab);
    });
}

function getGroupStatus(movement, groupNumber) {
    const lights = GROUP_LIGHTS[groupNumber];
    const status = { red: false, amber: false, green: false };
    lights.forEach(lightName => {
        const lightInfo = LIGHT_MAP[lightName];
        if (!lightInfo) return;
        const portValue = parseInt(movement[lightInfo.port], 16);
        const isLightOn = (portValue & (1 << lightInfo.bit)) !== 0;
        if (lightName.startsWith('R')) status.red = isLightOn;
        else if (lightName.startsWith('A')) status.amber = isLightOn;
        else if (lightName.startsWith('V')) status.green = isLightOn;
    });
    return status;
}

// --- NUEVA FUNCIÓN: Obtiene una lista de todas las luces encendidas en un movimiento ---
function getActiveLightsForMovement(movement) {
    const activeLights = [];
    LIGHT_ORDER.forEach(lightName => {
        const lightInfo = LIGHT_MAP[lightName];
        const portValue = parseInt(movement[lightInfo.port], 16);
        if ((portValue & (1 << lightInfo.bit)) !== 0) {
            activeLights.push(lightName);
        }
    });
    return activeLights.join(' ');
}


/**
 * Dibuja los detalles y la línea de tiempo para un plan específico.
 * @param {number} planId - El ID del plan a renderizar.
 */
function renderPlanDetails(planId) {
    const projectData = getProjectData();
    const hardwareData = projectData.hardware_config;
    const gridContainer = document.getElementById('timeline-grid-container');
    const infoTablesContainer = document.getElementById('info-tables-container');
    gridContainer.innerHTML = '';
    infoTablesContainer.innerHTML = '';

    const plan = hardwareData.plans.find(p => p.id === planId);
    if (!plan) {
        gridContainer.innerHTML = `<p class="error-message">Error: No se encontró el Plan #${planId}.</p>`;
        return;
    }

    const detailsContainer = document.getElementById('plan-details-container');
    const dayDescription = DAY_TYPE_LEGEND[plan.day_type_id] || 'Desconocido';
    detailsContainer.innerHTML = `<p><strong>Secuencia Asociada:</strong> #${plan.sequence_id}</p><p><strong>Índice de Tiempo Seleccionado:</strong> T${plan.time_sel}</p><p><strong>Días de Aplicación:</strong> ${dayDescription} (Tipo ${plan.day_type_id})</p><p><strong>Hora de Inicio:</strong> ${String(plan.hour).padStart(2, '0')}:${String(plan.minute).padStart(2, '0')}</p>`;

    const sequence = hardwareData.sequences.find(s => s.id === plan.sequence_id);
    if (!sequence) {
        gridContainer.innerHTML = `<p class="error-message">Error: El Plan #${planId} apunta a la Secuencia #${plan.sequence_id}, pero no se encontró. Verifique la configuración.</p>`;
        return;
    }
    
    if (!sequence.movements || sequence.movements.length === 0) {
        gridContainer.innerHTML = '<p>La secuencia asociada a este plan no tiene movimientos definidos.</p>';
        return;
    }

    const cycleMovements = sequence.movements.map(movId => {
        const movement = hardwareData.movements.find(m => m.id === movId);
        if (!movement) {
            console.warn(`Advertencia: No se encontró el Movimiento #${movId} referenciado por la Secuencia #${sequence.id}.`);
        }
        return movement;
    }).filter(Boolean); // Filtra los movimientos que no se encontraron (null/undefined)

    if (cycleMovements.length === 0) {
        gridContainer.innerHTML = `<p class="error-message">Error: Ninguno de los movimientos de la Secuencia #${sequence.id} fue encontrado. Verifique la configuración.</p>`;
        return;
    }

    const totalCycleTime = cycleMovements.reduce((total, mov) => total + (mov.times[plan.time_sel] || 0), 0);
    if (totalCycleTime === 0) {
        gridContainer.innerHTML = '<p>La duración total del ciclo para este plan es 0. No se puede generar la línea de tiempo.</p>';
        return;
    }

    const intermittenceRule = hardwareData.intermittences.find(i => i.id_plan === plan.id);
    //const intermittenceRule = hardwareData.intermittences.find(i => i.plan_id === plan.id);

    // --- El resto del renderizado de la línea de tiempo y las tablas continúa aquí... ---
    // (Esta parte del código no necesita cambios)
    const barsArea = document.createElement('div');
    barsArea.className = 'timeline-bars-area';
    const majorTickInterval = totalCycleTime > 100 ? 10 : 5;
    const minorTickInterval = 1;
    const majorTickPercent = (majorTickInterval / totalCycleTime) * 100;
    const minorTickPercent = (minorTickInterval / totalCycleTime) * 100;
    barsArea.style.backgroundImage = `repeating-linear-gradient(to right, #f0f0f0 0 1px, transparent 1px ${minorTickPercent}%), repeating-linear-gradient(to right, #ccc 0 1px, transparent 1px ${majorTickPercent}%)`;
    gridContainer.appendChild(barsArea);
    gridContainer.appendChild(Object.assign(document.createElement('div'), { className: 'grid-cell header grid-label' }));
    const rulerContentCell = Object.assign(document.createElement('div'), { className: 'grid-cell header timeline-ruler-content' });
    for (let t = 0; t <= totalCycleTime; t += minorTickInterval) {
        const positionPercent = (t / totalCycleTime) * 100;
        const tick = document.createElement('div');
        tick.className = 'ruler-tick ' + (t % majorTickInterval === 0 ? 'major' : 'minor');
        tick.style.left = `${positionPercent}%`;
        rulerContentCell.appendChild(tick);
        if (t % majorTickInterval === 0) {
            const label = document.createElement('span');
            label.className = 'ruler-label';
            label.textContent = t;
            label.style.left = `${positionPercent}%`;
            rulerContentCell.appendChild(label);
        }
    }
    gridContainer.appendChild(rulerContentCell);
    gridContainer.appendChild(Object.assign(document.createElement('div'), { className: 'grid-cell header grid-label', textContent: 'Etapa' }));
    const stageContentCell = Object.assign(document.createElement('div'), { className: 'grid-cell header timeline-stages-content' });
    let accumulatedTime = 0;
    cycleMovements.forEach(mov => {
        const duration = mov.times[plan.time_sel] || 0;
        if (duration > 0) {
            const startPercent = (accumulatedTime / totalCycleTime) * 100;
            const separator = document.createElement('div');
            separator.className = 'stage-separator';
            separator.style.left = `${startPercent}%`;
            stageContentCell.appendChild(separator);
            const label = document.createElement('span');
            label.className = 'stage-label';
            label.textContent = `Mov. ${mov.id}`;
            label.style.left = `${startPercent + (duration / totalCycleTime * 100 / 2)}%`;
            stageContentCell.appendChild(label);
            accumulatedTime += duration;
        }
    });
    gridContainer.appendChild(stageContentCell);
    for (let i = 1; i <= 8; i++) {
        gridContainer.appendChild(Object.assign(document.createElement('div'), { className: 'grid-cell grid-label', textContent: `G${i}` }));
        const barContainerCell = Object.assign(document.createElement('div'), { className: 'grid-cell timeline-bar-container' });
        cycleMovements.forEach(mov => {
            const duration = mov.times[plan.time_sel] || 0;
            if (duration === 0) return;
            const status = getGroupStatus(mov, i);
            const activeLightsCount = Object.values(status).filter(Boolean).length;
            let colorClass = 'gray';
            const segment = document.createElement('div');
            segment.className = 'timeline-segment';
            if (activeLightsCount === 1) {
                if (status.red) colorClass = 'red';
                else if (status.amber) colorClass = 'amber';
                else if (status.green) colorClass = 'green';
                segment.textContent = duration > 3 ? duration : '';
            } else if (activeLightsCount > 1) {
                colorClass = 'violet';
                const conflictContainer = document.createElement('div');
                conflictContainer.className = 'conflict-indicator-container';
                if (status.red) conflictContainer.appendChild(Object.assign(document.createElement('span'), { className: 'conflict-light-dot red' }));
                if (status.amber) conflictContainer.appendChild(Object.assign(document.createElement('span'), { className: 'conflict-light-dot amber' }));
                if (status.green) conflictContainer.appendChild(Object.assign(document.createElement('span'), { className: 'conflict-light-dot green' }));
                segment.appendChild(conflictContainer);
            } else {
                segment.textContent = duration > 3 ? duration : '';
            }
            segment.classList.add(colorClass);
            segment.style.width = `${(duration / totalCycleTime) * 100}%`;
            segment.title = `Grupo ${i}, Movimiento ${mov.id}\nDuración: ${duration}s`;
            if (intermittenceRule && colorClass !== 'gray' && colorClass !== 'violet') {
                 const groupLights = GROUP_LIGHTS[i];
                 const lightForCheck = groupLights.find(l => (l.startsWith('R') && status.red) || (l.startsWith('A') && status.amber) || (l.startsWith('V') && status.green));
                 if (lightForCheck) {
                    const lightInfo = LIGHT_MAP[lightForCheck];
                    const maskPort = `mask${lightInfo.port.charAt(4).toUpperCase()}`;
                    if (intermittenceRule[maskPort]) {
                        const maskValue = parseInt(intermittenceRule[maskPort], 16);
                        if ((maskValue & (1 << lightInfo.bit)) !== 0) {
                            segment.classList.add('intermittent');
                        }
                    }
                 }
            }
            barContainerCell.appendChild(segment);
        });
        gridContainer.appendChild(barContainerCell);
    }
    let movementsTableHTML = `<div class="info-table-wrapper"><h5>Detalle de Movimientos</h5><table class="info-table"><thead><tr><th>Movimiento</th><th>Luces Activas</th><th>Tiempo (s)</th></tr></thead><tbody>`;
    cycleMovements.forEach(mov => {
        const duration = mov.times[plan.time_sel] || 0;
        const activeLights = getActiveLightsForMovement(mov);
        movementsTableHTML += `<tr><td>${mov.id}</td><td class="light-list">${activeLights}</td><td>${duration}</td></tr>`;
    });
    movementsTableHTML += `</tbody></table></div>`;
    let greensTableHTML = `<div class="info-table-wrapper"><h5>Verdes Efectivos</h5><table class="info-table"><thead><tr><th>#</th><th>Movimiento</th><th>Grupos con Verde</th><th>Tiempo (s)</th></tr></thead><tbody>`;
    let effectiveGreenCounter = 0;
    cycleMovements.forEach(mov => {
        const duration = mov.times[plan.time_sel] || 0;
        const greenGroups = [];
        for (let i = 1; i <= 8; i++) {
            const status = getGroupStatus(mov, i);
            if (status.green && !status.red && !status.amber) {
                greenGroups.push(`G${i}`);
            }
        }
        if (greenGroups.length > 0) {
            effectiveGreenCounter++;
            greensTableHTML += `<tr><td>Verde Efectivo ${effectiveGreenCounter}</td><td>${mov.id}</td><td>${greenGroups.join(', ')}</td><td>${duration}</td></tr>`;
        }
    });
    greensTableHTML += `</tbody></table></div>`;
    infoTablesContainer.innerHTML = movementsTableHTML + greensTableHTML;
}

// --- Función de Inicialización Principal ---
export function initializePlanVisualizerView() {
    const projectData = getProjectData();
    // Hacemos una comprobación segura. Si hardware_config no existe, usamos un objeto vacío.
    const hardwareData = projectData.hardware_config || {}; 

    renderLegend();
    renderPlanTabs(hardwareData.plans); // Ahora esto nunca fallará

    // Solo intentamos renderizar los detalles si realmente hay planes
    if (hardwareData.plans && hardwareData.plans.length > 0) {
        renderPlanDetails(hardwareData.plans[0].id);
    } else {
        // Si no hay planes, limpiamos las otras secciones para que no muestren datos viejos
        document.getElementById('plan-details-container').innerHTML = '<p>No hay planes para visualizar.</p>';
        document.getElementById('timeline-grid-container').innerHTML = '';
        document.getElementById('info-tables-container').innerHTML = '';
    }
}
