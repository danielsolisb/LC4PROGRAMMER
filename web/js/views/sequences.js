// web/js/views/sequences.js

import { getProjectData } from '../store.js';
import { LIGHT_MAP, LIGHT_ORDER } from '../constants.js';

function displaySelectedSequence() {
    const projectData = getProjectData();
    const selector = document.getElementById('sequence-selector');
    const sequenceId = parseInt(selector.value, 10);
    const timelineContainer = document.getElementById('timeline-container');
    const hardwareData = projectData.hardware_config;
    timelineContainer.innerHTML = '';

    if (isNaN(sequenceId) || !hardwareData.sequences) return;
    
    const sequence = hardwareData.sequences.find(s => s.id === sequenceId);
    if (!sequence) return;

    timelineContainer.style.gridTemplateColumns = `auto repeat(${LIGHT_ORDER.length}, 1fr) auto`;
    timelineContainer.insertAdjacentHTML('beforeend', '<div class="timeline-cell timeline-header">Mov.</div>');
    LIGHT_ORDER.forEach(lightName => {
        timelineContainer.insertAdjacentHTML('beforeend', `<div class="timeline-cell timeline-header">${lightName}</div>`);
    });
    timelineContainer.insertAdjacentHTML('beforeend', '<div class="timeline-cell timeline-header">Tiempos</div>');

    sequence.movements.forEach(movementId => {
        const movement = hardwareData.movements.find(m => m.id === movementId);
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

export function initializeSequencesView() {
    const projectData = getProjectData();
    const hardwareData = projectData.hardware_config;
    const selector = document.getElementById('sequence-selector');
    if (!selector) return;

    selector.innerHTML = '<option value="">-- Seleccione una secuencia --</option>';
    if (hardwareData && hardwareData.sequences) {
        hardwareData.sequences.forEach(seq => {
            const option = new Option(`Secuencia #${seq.id}`, seq.id);
            selector.add(option);
        });
        // Seleccionar la primera por defecto y mostrarla
        if (hardwareData.sequences.length > 0) {
            selector.value = hardwareData.sequences[0].id;
        }
    }
    
    selector.addEventListener('change', displaySelectedSequence);
    displaySelectedSequence();
}