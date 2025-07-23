// web/js/views/monitoring.js

import { api } from '../api.js';
import { LIGHT_MAP, LIGHT_ORDER } from '../constants.js';

let monitoringPoller = null;

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

export async function initializeMonitoringView() {
    const display = document.getElementById('monitoring-display');
    if (!display) return;

    display.innerHTML = '';
    display.className = 'timeline-container';
    display.style.gridTemplateColumns = `repeat(${LIGHT_ORDER.length}, 1fr)`;

    LIGHT_ORDER.forEach(lightName => {
        display.insertAdjacentHTML('beforeend', `<div class="timeline-cell timeline-header">${lightName}</div>`);
    });

    LIGHT_ORDER.forEach(lightName => {
        const colorClass = lightName.startsWith('R') ? 'red' : lightName.startsWith('A') ? 'amber' : 'green';
        display.insertAdjacentHTML('beforeend', `
            <div class="timeline-cell light-indicator-container">
                <div id="monitor-light-${lightName}" class="light-indicator ${colorClass}"></div>
            </div>
        `);
    });

    await api.startMonitoring();

    if (monitoringPoller) clearInterval(monitoringPoller);
    monitoringPoller = setInterval(async () => {
        const updateJson = await api.checkMonitoringUpdate();
        if (updateJson) {
            const portData = JSON.parse(updateJson);
            updateMonitoringLights(portData);
        }
    }, 200);
}

export async function cleanupMonitoringView() {
    if (monitoringPoller) {
        console.log("Saliendo de la vista de monitoreo. Deteniendo poller y comando.");
        clearInterval(monitoringPoller);
        monitoringPoller = null;
        await api.stopMonitoring();
    }
}