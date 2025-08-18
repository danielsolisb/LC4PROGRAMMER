// web/js/views/config.js

import { getProjectData } from '../store.js';
import { api } from '../api.js';

// --- VARIABLES GLOBALES Y CONSTANTES DE LA VISTA ---
let map;
let intersectionPin = null; // ¡NUEVO! Variable para el pin de la intersección
let mapMarkers = {};

let elementCounter = 0;
const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MAX_HOLIDAYS = 20;

// --- ÍCONOS SVG (se usarán dentro de divIcon) ---
const ICON_SVG_STRINGS = {
    group: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 160"><rect x="2" y="2" width="60" height="156" rx="10" fill="black"/><circle cx="32" cy="32" r="20" fill="#ff0000" stroke="gray" stroke-width="2"/><circle cx="32" cy="80" r="20" fill="#ffff00" stroke="gray" stroke-width="2"/><circle cx="32" cy="128" r="20" fill="#00ff00" stroke="gray" stroke-width="2"/></svg>',
    pedestrian: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 110"><rect x="2" y="2" width="60" height="106" rx="10" fill="black"/><circle cx="32" cy="30" r="20" fill="#ff0000" stroke="gray" stroke-width="2"/><circle cx="32" cy="80" r="20" fill="#00ff00" stroke="gray" stroke-width="2"/></svg>',
    demand: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="5" width="90" height="90" rx="15" fill="#f0e68c"/><circle cx="50" cy="50" r="35" fill="#005a9e" stroke="#333" stroke-width="5"/></svg>',
    direction: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 0 L100 50 L75 50 L75 100 L25 100 L25 50 L0 50 Z" fill="#005a9e" stroke="white" stroke-width="5"/></svg>'
};

// --- FUNCIONES PRINCIPALES ---

export function initializeConfigView() {
    setupTabSwitching();
    document.querySelector('.config-tab[data-tab="tab-intersection"]').click();
}

function setupTabSwitching() {
    const tabs = document.querySelectorAll('.config-tab');
    const tabContents = document.querySelectorAll('.config-tab-content');
    let isIntersectionTabInitialized = false;
    let isSequencesTabInitialized = false;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');

            if (tab.dataset.tab === 'tab-intersection') {
                if (!isIntersectionTabInitialized) {
                    initializeIntersectionTab();
                    isIntersectionTabInitialized = true;
                } else if (map) {
                    setTimeout(() => map.invalidateSize(), 150);
                }
            } else if (tab.dataset.tab === 'tab-sequences') {
                if (!isSequencesTabInitialized) {
                    initializeSequencesTab();
                    isSequencesTabInitialized = true;
                } else {
                    renderSequenceList();
                }
            }
        });
    });
}

function initializeIntersectionTab() {
    renderGeneralProperties();
    renderHolidays();
    renderConflictMatrix();
    initializeMapWhenReady();
    setupMapToolbar();
    document.getElementById('sync-datetime-btn').addEventListener('click', syncDateTimeWithController);
}

// --- RENDERIZADO DE COMPONENTES (sin cambios) ---
function renderGeneralProperties() {
    const container = document.getElementById('general-properties-form');
    const props = getProjectData().software_config.intersection.properties;
    container.innerHTML = `<div class="form-group"><label for="controller-id">ID del Controlador</label><input type="text" id="controller-id" value="${props.controller_id || ''}"></div><div class="form-group"><label for="intersection-name">Nombre de la Intersección</label><input type="text" id="intersection-name" value="${props.name || ''}"></div><div class="form-group"><label>Fecha, Hora y Día del Sistema</label><div id="current-datetime" class="datetime-display">Cargando...</div><button id="sync-datetime-btn" class="tool-btn sync-btn">Sincronizar con Controlador</button></div>`;
    document.getElementById('controller-id').addEventListener('input', (e) => getProjectData().software_config.intersection.properties.controller_id = e.target.value);
    document.getElementById('intersection-name').addEventListener('input', (e) => getProjectData().software_config.intersection.properties.name = e.target.value);
   
    const datetimeDisplay = document.getElementById('current-datetime');
    setInterval(() => {
        const now = new Date();
        datetimeDisplay.textContent = `${DIAS_SEMANA[now.getDay()]}, ${now.toLocaleString('es-EC')}`;
    }, 1000);
    document.getElementById('sync-datetime-btn').addEventListener('click', async () => {
        const now = new Date();
        const payload = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), dayOfWeek: now.getDay(), hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() };
        alert(`Sincronizando...\nPayload a enviar:\n${JSON.stringify(payload, null, 2)}`);
    });
}

// --- LÓGICA DE SECUENCIAS ---

function renderSequencesEditor() {
    renderSequenceList();
}
// --- LÓGICA PARA SECUENCIAS Y MOVIMIENTOS ---

function initializeSequencesTab() {
    renderSequenceList();
}

function renderSequenceList() {
    const project = getProjectData();
    const hardware = project.hardware_config;
    const container = document.getElementById('tab-sequences');
    if (!container) return;

    // Calcular el próximo ID disponible tomando el mayor existente + 1
    const nextSequenceId = hardware.sequences.reduce((max, seq) => Math.max(max, seq.id), 0) + 1;

    container.innerHTML = `
        <div id="sequence-list"></div>
        <button id="add-sequence-btn" class="tool-btn">Añadir Secuencia</button>
    `;

    const list = container.querySelector('#sequence-list');

    hardware.sequences.forEach(seq => {
        const seqDiv = document.createElement('div');
        seqDiv.className = 'sequence-item';
        seqDiv.innerHTML = `
            <h5>Secuencia ${seq.id}</h5>
            <button class="delete-sequence-btn tool-btn" data-id="${seq.id}">Eliminar Secuencia</button>
            <ul class="movement-list"></ul>
            <button class="add-movement-btn tool-btn" data-id="${seq.id}">Añadir Movimiento</button>
        `;
        const movList = seqDiv.querySelector('.movement-list');
        seq.movements.forEach(movId => {
            const li = document.createElement('li');
            li.innerHTML = `Movimiento ${movId} <button class="delete-movement-btn tool-btn" data-seqid="${seq.id}" data-movid="${movId}">Eliminar</button>`;
            movList.appendChild(li);
        });
        list.appendChild(seqDiv);
    });

    container.querySelector('#add-sequence-btn').addEventListener('click', () => {
        hardware.sequences.push({ id: nextSequenceId, movements: [] });
        renderSequenceList();
    });

    container.querySelectorAll('.add-movement-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const seqId = parseInt(e.target.dataset.id, 10);
            const sequence = hardware.sequences.find(s => s.id === seqId);
            if (!sequence) return;
            const nextMovId = hardware.movements.reduce((max, m) => Math.max(max, m.id), 0) + 1;
            const newMov = { id: nextMovId, portD: '00', portE: '00', portF: '00', portH: '00', portJ: '00', times: [] };
            hardware.movements.push(newMov);
            sequence.movements.push(nextMovId);
            renderSequenceList();
        });
    });

    container.querySelectorAll('.delete-sequence-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const seqId = parseInt(e.target.dataset.id, 10);
            const seqIndex = hardware.sequences.findIndex(s => s.id === seqId);
            if (seqIndex === -1) return;
            const seq = hardware.sequences[seqIndex];
            // Eliminar movimientos asociados de la lista global
            seq.movements.forEach(movId => {
                const movIndex = hardware.movements.findIndex(m => m.id === movId);
                if (movIndex > -1) hardware.movements.splice(movIndex, 1);
            });
            hardware.sequences.splice(seqIndex, 1);
            renderSequenceList();
        });
    });

    container.querySelectorAll('.delete-movement-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const seqId = parseInt(e.target.dataset.seqid, 10);
            const movId = parseInt(e.target.dataset.movid, 10);
            const sequence = hardware.sequences.find(s => s.id === seqId);
            if (!sequence) return;
            sequence.movements = sequence.movements.filter(id => id !== movId);
            const movIndex = hardware.movements.findIndex(m => m.id === movId);
            if (movIndex > -1) hardware.movements.splice(movIndex, 1);
            renderSequenceList();
        });
    });
}

function renderSequenceDetails(seqId) {
    const detailsContainer = document.getElementById('sequence-details');
    const sequences = getProjectData().hardware_config.sequences || [];
    const sequence = sequences.find(s => s.id === seqId);

    if (!sequence) {
        detailsContainer.innerHTML = '<p>Seleccione una secuencia.</p>';
        return;
    }

    let html = `<p><strong>Secuencia #${sequence.id}</strong></p>`;
    if (sequence.movements && sequence.movements.length) {
        html += '<ul>';
        sequence.movements.forEach(mov => {
            html += `<li>Movimiento ${mov}</li>`;
        });
        html += '</ul>';
    } else {
        html += '<p>Sin movimientos.</p>';
    }
    detailsContainer.innerHTML = html;
}
//function renderHolidays() { document.getElementById('holidays-editor').innerHTML = `<p>Editor de Feriados (funcionalidad futura).</p>`; }
function renderHolidays() {
    const container = document.getElementById('holidays-editor');
    const holidays = getProjectData().hardware_config.holidays;

    container.innerHTML = `
        <div class="form-group">
            <label>Agregar Feriado</label>
            <div style="display:flex; gap:5px;">
                <input type="number" id="holiday-day" min="1" max="31" placeholder="Día">
                <input type="number" id="holiday-month" min="1" max="12" placeholder="Mes">
                <button id="add-holiday-btn" class="tool-btn">Añadir</button>
            </div>
        </div>
        <ul id="holidays-list"></ul>
    `;

    const list = container.querySelector('#holidays-list');
    const addBtn = container.querySelector('#add-holiday-btn');

    function renderList() {
        list.innerHTML = '';
        holidays.forEach((h, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${String(h.day).padStart(2,'0')}/${String(h.month).padStart(2,'0')}</span>` +
                `<span class="delete-holiday-btn" data-idx="${idx}">✖</span>`;
            list.appendChild(li);
        });
        holidays.forEach((h, idx) => h.id = idx); // mantener ids consistentes
        addBtn.disabled = holidays.length >= MAX_HOLIDAYS;
    }

    addBtn.addEventListener('click', () => {
        const day = parseInt(container.querySelector('#holiday-day').value, 10);
        const month = parseInt(container.querySelector('#holiday-month').value, 10);
        if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) {
            alert('Fecha inválida');
            return;
        }
        if (holidays.length >= MAX_HOLIDAYS) {
            alert(`Máximo ${MAX_HOLIDAYS} feriados permitidos.`);
            return;
        }
        holidays.push({ id: holidays.length, day, month });
        container.querySelector('#holiday-day').value = '';
        container.querySelector('#holiday-month').value = '';
        renderList();
    });

    list.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-holiday-btn')) {
            const idx = parseInt(e.target.dataset.idx, 10);
            holidays.splice(idx, 1);
            renderList();
        }
    });

    renderList();
}
function renderConflictMatrix() {
    const container = document.getElementById('conflict-matrix-container');
    const matrix = getProjectData().software_config.intersection.conflict_matrix;
    let html = '<table class="conflict-matrix"><thead><tr><th></th>';
    for (let i = 1; i <= 8; i++) { html += `<th>G${i}</th>`; }
    html += '</tr></thead><tbody>';
    for (let i = 0; i < 8; i++) {
        html += `<tr><th>G${i + 1}</th>`;
        for (let j = 0; j < 8; j++) { html += `<td><input type="checkbox" data-row="${i}" data-col="${j}" ${matrix[i][j] ? 'checked' : ''} ${i === j ? 'disabled' : ''}></td>`; }
        html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const row = parseInt(e.target.dataset.row), col = parseInt(e.target.dataset.col), isChecked = e.target.checked;
            getProjectData().intersection.conflict_matrix[row][col] = isChecked;
            getProjectData().intersection.conflict_matrix[col][row] = isChecked;
            const symmetricCheckbox = container.querySelector(`input[data-row="${col}"][data-col="${row}"]`);
            if (symmetricCheckbox) symmetricCheckbox.checked = isChecked;
        });
    });
}

// Verifica si un grupo candidato puede ser utilizado en un movimiento
function isGroupAllowed(sequenceMovements, candidateGroupId) {
    const matrix = getProjectData().software_config.intersection.conflict_matrix;
    return !sequenceMovements.some(existingGroupId => {
        if (!existingGroupId) return false;
        return matrix[candidateGroupId - 1]?.[existingGroupId - 1];
    });
}

// --- LÓGICA DEL MAPA (RECONSTRUIDA) ---

function initializeMapWhenReady() {
    const mapContainer = document.getElementById('config-map');
    if (!mapContainer) return;
    const observer = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
            initializeMap();
            observer.unobserve(mapContainer);
        }
    });
    observer.observe(mapContainer);
}

function initializeMap() {
    const mapContainer = document.getElementById('config-map');
    if (mapContainer && mapContainer._leaflet_id) map.remove();
    
    const mapView = getProjectData().software_config.intersection.map_view;
    map = L.map('config-map').setView([mapView.lat, mapView.lng], mapView.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 22, // Permitir más zoom
        maxNativeZoom: 19
    }).addTo(map);
    
    map.on('moveend zoomend', () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        getProjectData().software_config.intersection.map_view.lat = center.lat;
        getProjectData().software_config.intersection.map_view.lng = center.lng;
        getProjectData().software_config.intersection.map_view.zoom = zoom;
        updateIconLabelsZoom(); // Actualizar etiquetas al cambiar el zoom
    });

    addIntersectionPin();
    renderElementsOnMap();
    updateIconLabelsZoom(); // Llamada inicial
}

function addIntersectionPin() {
    const intersectionConfig = getProjectData().software_config.intersection;
    const pinCoords = intersectionConfig.properties.coordinates;

    // Creamos un ícono especial para este pin
    const pinIcon = L.divIcon({
        html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="intersection-pin-svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        className: 'intersection-pin-icon',
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });

    if (intersectionPin) {
        map.removeLayer(intersectionPin);
    }

    intersectionPin = L.marker([pinCoords.lat, pinCoords.lng], {
        icon: pinIcon,
        draggable: true, // Hacemos que se pueda arrastrar
        zIndexOffset: 1000 // Para que siempre esté por encima
    }).addTo(map);

    intersectionPin.bindPopup("<b>Ubicación de la Intersección</b><br>Arrastra para reubicar.");

    // Guardar la nueva posición cuando se termine de arrastrar
    intersectionPin.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        intersectionConfig.properties.coordinates.lat = newLatLng.lat;
        intersectionConfig.properties.coordinates.lng = newLatLng.lng;
        console.log('Nueva ubicación de intersección guardada:', newLatLng);
    });
}



function updateIconLabelsZoom() {
    if (!map) return;
    const currentZoom = map.getZoom();
    const showLabels = currentZoom >= 19; // Umbral para mostrar etiquetas

    for (const id in mapMarkers) {
        const marker = mapMarkers[id];
        const iconElement = marker.getElement();
        if (iconElement) {
            iconElement.classList.toggle('label-visible', showLabels);
        }
    }
}

// --- Lógica de la Barra de Herramientas y Elementos ---

function setupMapToolbar() {
    document.querySelectorAll('.map-toolbar .tool-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            if (map) { addElementToMap(type, map.getCenter()); }
        });
    });
}

function renderElementsOnMap() {
    for (const id in mapMarkers) { map.removeLayer(mapMarkers[id]); }
    mapMarkers = {};
    const elements = getProjectData().software_config.intersection.elements;
    let maxId = -1;
    elements.forEach(element => {
        addElementToMap(element.type, { lat: element.lat, lng: element.lng }, element);
        const idNum = parseInt(element.id.split('_').pop());
        if (!isNaN(idNum) && idNum > maxId) maxId = idNum;
    });
    elementCounter = maxId + 1;
}

function createDivIcon(type, name = '') {
    const iconSizes = { group: [25, 60], pedestrian: [25, 45], demand: [30, 30], direction: [40, 40] };
    const size = iconSizes[type] || [30, 30];
    const svg = ICON_SVG_STRINGS[type];
    
    // El 'name' (ej: G1) ahora se renderiza directamente en el HTML del ícono
    return L.divIcon({
        html: `<div class="map-icon-wrapper">
                   <div class="map-icon-svg" style="width:${size[0]}px; height:${size[1]}px;">${svg}</div>
                   <span class="map-icon-label">${name}</span>
               </div>`,
        className: `leaflet-div-icon-${type}`,
        iconSize: size,
        iconAnchor: [size[0] / 2, size[1] / 2]
    });
}

function addElementToMap(type, latlng, loadedElement = null) {
    const id = loadedElement ? loadedElement.id : `${type}_${elementCounter++}`;
    const elementData = loadedElement || { id, type, lat: latlng.lat, lng: latlng.lng, rotation: 0, name: '' };
    if (!loadedElement) getProjectData().software_config.intersection.elements.push(elementData);

    const marker = L.marker([elementData.lat, elementData.lng], {
        icon: createDivIcon(type, elementData.name),
        draggable: true,
        rotationAngle: elementData.rotation || 0
    }).addTo(map);
    mapMarkers[id] = marker;

    marker.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        elementData.lat = newLatLng.lat;
        elementData.lng = newLatLng.lng;
    });

    marker.bindPopup(() => createPopupContent(elementData));
    marker.on('popupopen', () => attachPopupListeners(elementData, marker));
}

function createPopupContent(elementData) {
    const { id, type, rotation, name } = elementData;
    let nameSelector = '';

    const options = {
        group: Array.from({length: 8}, (_, i) => `G${i + 1}`),
        pedestrian: Array.from({length: 4}, (_, i) => `SP${i + 1}`),
        demand: Array.from({length: 4}, (_, i) => `BP${i + 1}`)
    };

    if (options[type]) {
        const label = { group: 'Grupo Semafórico', pedestrian: 'Semáforo Peatonal', demand: 'Botón de Demanda' }[type];
        let optionHTML = '<option value="">Sin Asignar</option>';
        const sequenceMovements = getProjectData().software_config?.intersection?.sequence_movements || [];
        options[type].forEach(opt => {
            const groupNum = parseInt(opt.replace(/\D/g, ''), 10);
            const allowed = isGroupAllowed(sequenceMovements, groupNum);
            const disabledAttr = allowed ? '' : 'disabled class="conflict-option"';
            optionHTML += `<option value="${opt}" ${name === opt ? 'selected' : ''} ${disabledAttr}>${opt}</option>`;
        });
        nameSelector = `<div class="popup-form-group"><label for="name-${id}">${label}</label><select id="name-${id}">${optionHTML}</select></div>`;
    }

    return `<b>ID:</b> ${id}<br>${nameSelector}<div class="popup-form-group"><label for="rot-${id}">Rotación: <span id="val-${id}">${rotation}°</span></label><input type="range" id="rot-${id}" min="0" max="359" value="${rotation}"></div><button class="popup-delete-btn" id="del-${id}">Eliminar</button>`;
}

function attachPopupListeners(elementData, marker) {
    const popupNode = marker.getPopup().getElement();
    if (!popupNode) return;

    const nameSelector = popupNode.querySelector(`#name-${elementData.id}`);
    if (nameSelector) {
        nameSelector.addEventListener('change', (e) => {
            elementData.name = e.target.value;
            // Actualizar el icono en tiempo real con la nueva etiqueta
            marker.setIcon(createDivIcon(elementData.type, elementData.name));
            updateIconLabelsZoom(); // Re-evaluar si la etiqueta debe ser visible
        });
    }

    popupNode.querySelector(`#rot-${elementData.id}`).addEventListener('input', (e) => {
        const angle = parseInt(e.target.value, 10);
        marker.setRotationAngle(angle);
        elementData.rotation = angle;
        popupNode.querySelector(`#val-${elementData.id}`).textContent = `${angle}°`;
    });

    popupNode.querySelector(`#del-${elementData.id}`).addEventListener('click', () => {
        map.closePopup();
        map.removeLayer(marker);
        delete mapMarkers[elementData.id];
        const elements = getProjectData().intersection.elements;
        const index = elements.findIndex(el => el.id === elementData.id);
        if (index > -1) elements.splice(index, 1);
    });
}
