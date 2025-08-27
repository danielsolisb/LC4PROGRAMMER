// web/js/views/config.js

import { getProjectData } from '../store.js';
import { api } from '../api.js';
import { LIGHT_MAP, DAY_TYPE_LEGEND } from '../constants.js'; // Importamos LIGHT_MAP

// --- VARIABLES GLOBALES Y CONSTANTES DE LA VISTA ---
let map;
let intersectionPin = null;
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


// =================================================================================
// --- INICIALIZACIÓN PRINCIPAL Y MANEJO DE PESTAÑAS ---
// =================================================================================

export function initializeConfigView() {
    setupTabSwitching();
    // Forzamos la carga inicial de la primera pestaña
    document.querySelector('.config-tab[data-tab="tab-intersection"]').click();
}

function setupTabSwitching() {
    const tabs = document.querySelectorAll('.config-tab');
    const tabContents = document.querySelectorAll('.config-tab-content');
    let isIntersectionTabInitialized = false;
    let isSequencesTabInitialized = false;
    let isSchedulingTabInitialized = false; // Nueva variable

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
                }
            } else if (tab.dataset.tab === 'tab-scheduling') { // Nuevo bloque
                if (!isSchedulingTabInitialized) {
                    initializeSchedulingTab();
                    isSchedulingTabInitialized = true;
                }
            }
        });
    });
}


// =================================================================================
// --- PESTAÑA 1: DISEÑO DE INTERSECCIÓN (SIN CAMBIOS) ---
// =================================================================================

function initializeIntersectionTab() {
    renderGeneralProperties();
    renderHolidays();
    renderConflictMatrix();
    initializeMapWhenReady();
    setupMapToolbar();
    // El listener del botón de sincronización se añade dentro de renderGeneralProperties
}

function renderGeneralProperties() {
    const container = document.getElementById('general-properties-form');
    // Verificación de seguridad para evitar errores si la estructura no existe
    const props = getProjectData().software_config?.intersection?.properties || {};
    container.innerHTML = `
        <div class="form-group">
            <label for="controller-id">ID del Controlador</label>
            <input type="text" id="controller-id" value="${props.controller_id || ''}">
        </div>
        <div class="form-group">
            <label for="intersection-name">Nombre de la Intersección</label>
            <input type="text" id="intersection-name" value="${props.name || ''}">
        </div>
        <div class="form-group">
            <label>Fecha, Hora y Día del Sistema</label>
            <div id="current-datetime" class="datetime-display">Cargando...</div>
            <button id="sync-datetime-btn" class="tool-btn sync-btn">Sincronizar con Controlador</button>
        </div>`;
    
    document.getElementById('controller-id').addEventListener('input', (e) => {
        getProjectData().software_config.intersection.properties.controller_id = e.target.value;
    });
    document.getElementById('intersection-name').addEventListener('input', (e) => {
        getProjectData().software_config.intersection.properties.name = e.target.value;
    });
   
    const datetimeDisplay = document.getElementById('current-datetime');
    setInterval(() => {
        const now = new Date();
        datetimeDisplay.textContent = `${DIAS_SEMANA[now.getDay()]}, ${now.toLocaleString('es-EC')}`;
    }, 1000);

    // El botón sync-datetime-btn no tiene una funcionalidad real de API en el backend,
    // así que lo dejamos como está, solo con un alert.
    document.getElementById('sync-datetime-btn').addEventListener('click', async () => {
        const now = new Date();
        const payload = { 
            year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), 
            dayOfWeek: now.getDay(), hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() 
        };
        alert(`Sincronizando...\nPayload a enviar:\n${JSON.stringify(payload, null, 2)}`);
    });
}

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
        for (let j = 0; j < 8; j++) {
            html += `<td><input type="checkbox" data-row="${i}" data-col="${j}" ${matrix[i][j] ? 'checked' : ''} ${i === j ? 'disabled' : ''}></td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const row = parseInt(e.target.dataset.row, 10);
            const col = parseInt(e.target.dataset.col, 10);
            const isChecked = e.target.checked;
            
            // Actualizamos la matriz en ambos sentidos para mantener la simetría
            getProjectData().software_config.intersection.conflict_matrix[row][col] = isChecked;
            getProjectData().software_config.intersection.conflict_matrix[col][row] = isChecked;
            
            const symmetricCheckbox = container.querySelector(`input[data-row="${col}"][data-col="${row}"]`);
            if (symmetricCheckbox) {
                symmetricCheckbox.checked = isChecked;
            }
        });
    });
}

function isGroupAllowed(sequenceMovements, candidateGroupId) {
    const matrix = getProjectData().software_config.intersection.conflict_matrix;
    return !sequenceMovements.some(existingGroupId => {
        if (!existingGroupId) return false;
        return matrix[candidateGroupId - 1]?.[existingGroupId - 1];
    });
}

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
    if (mapContainer && mapContainer._leaflet_id) {
        map.remove();
    }
    
    const mapView = getProjectData().software_config.intersection.map_view;
    map = L.map('config-map').setView([mapView.lat, mapView.lng], mapView.zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 22,
        maxNativeZoom: 19
    }).addTo(map);
    
    map.on('moveend zoomend', () => {
        const center = map.getCenter();
        const zoom = map.getZoom();
        getProjectData().software_config.intersection.map_view.lat = center.lat;
        getProjectData().software_config.intersection.map_view.lng = center.lng;
        getProjectData().software_config.intersection.map_view.zoom = zoom;
        updateIconLabelsZoom();
    });

    addIntersectionPin();
    renderElementsOnMap();
    updateIconLabelsZoom();
}

function addIntersectionPin() {
    const intersectionConfig = getProjectData().software_config.intersection;
    const pinCoords = intersectionConfig.properties.coordinates;
    const pinIcon = L.divIcon({
        html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="intersection-pin-svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        className: 'intersection-pin-icon',
        iconSize: [30, 42],
        iconAnchor: [15, 42]
    });

    if (intersectionPin) map.removeLayer(intersectionPin);
    
    intersectionPin = L.marker([pinCoords.lat, pinCoords.lng], {
        icon: pinIcon,
        draggable: true,
        zIndexOffset: 1000
    }).addTo(map);

    intersectionPin.bindPopup("<b>Ubicación de la Intersección</b><br>Arrastra para reubicar.");

    intersectionPin.on('dragend', (e) => {
        const newLatLng = e.target.getLatLng();
        intersectionConfig.properties.coordinates.lat = newLatLng.lat;
        intersectionConfig.properties.coordinates.lng = newLatLng.lng;
    });
}

function updateIconLabelsZoom() {
    if (!map) return;
    const currentZoom = map.getZoom();
    const showLabels = currentZoom >= 19;

    for (const id in mapMarkers) {
        const marker = mapMarkers[id];
        const iconElement = marker.getElement();
        if (iconElement) {
            iconElement.classList.toggle('label-visible', showLabels);
        }
    }
}

function setupMapToolbar() {
    document.querySelectorAll('.map-toolbar .tool-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            if (map) addElementToMap(type, map.getCenter());
        });
    });
}

function renderElementsOnMap() {
    for (const id in mapMarkers) map.removeLayer(mapMarkers[id]);
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
            marker.setIcon(createDivIcon(elementData.type, elementData.name));
            updateIconLabelsZoom();
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
        const elements = getProjectData().software_config.intersection.elements;
        const index = elements.findIndex(el => el.id === elementData.id);
        if (index > -1) elements.splice(index, 1);
    });
}


// =================================================================================
// --- PESTAÑA 2: LÓGICA DE SECUENCIAS (NUEVO CÓDIGO) ---
// =================================================================================

function initializeSequencesTab() {
    renderSequenceList();
    document.getElementById('add-sequence-btn').addEventListener('click', handleAddSequence);
    // Llamamos a la nueva función que prepara el modal
    setupAddMovementModal(); 
}

/**
 * Renderiza la lista completa de secuencias y sus movimientos en la columna izquierda.
 */
function renderSequenceList() {
    const container = document.getElementById('sequence-list-container');
    const hardware = getProjectData().hardware_config;
    container.innerHTML = '';

    hardware.sequences.forEach(seq => {
        const seqBlock = document.createElement('div');
        seqBlock.className = 'sequence-block';

        const isDemand = seq.type === 1;
        const optionsHTML = `
            <option value="0" ${!isDemand ? 'selected' : ''}>Automática</option>
            <option value="1" ${isDemand ? 'selected' : ''}>Bajo Demanda</option>
        `;

        // Contenedor para las reglas, se mostrará solo si es "Bajo Demanda"
        const rulesContainerHTML = `
            <div class="flow-rule-container" style="display: ${isDemand ? 'block' : 'none'};">
                <h6>Reglas de Flujo</h6>
                <ul class="flow-rule-list" id="rule-list-${seq.id}"></ul>
                <button class="tool-btn add-rule-btn" data-seq-id="${seq.id}">Añadir Regla</button>
            </div>
        `;

        seqBlock.innerHTML = `
            <div class="sequence-header">
                <h6>Secuencia ${seq.id}
                    <select class="sequence-type-selector" data-seq-id="${seq.id}">${optionsHTML}</select>
                </h6>
                <button class="delete-btn" data-seq-id="${seq.id}">Eliminar</button>
            </div>
            <ul class="movement-list" id="movement-list-${seq.id}"></ul>
            <button class="tool-btn add-movement-btn" data-seq-id="${seq.id}">Añadir Movimiento</button>
            ${rulesContainerHTML}
        `;

        // Renderizar lista de movimientos
        const movementList = seqBlock.querySelector(`#movement-list-${seq.id}`);
        seq.movements.forEach(movId => {
            const li = document.createElement('li');
            li.className = 'movement-item';
            li.dataset.movId = movId;
            li.dataset.seqId = seq.id;
            li.innerHTML = `<span>Movimiento ${movId}</span><button class="delete-btn" data-seq-id="${seq.id}" data-mov-id="${movId}">X</button>`;
            movementList.appendChild(li);
        });

        // Renderizar lista de reglas de flujo
        const ruleList = seqBlock.querySelector(`#rule-list-${seq.id}`);
        const rulesForSeq = hardware.flow_rules.filter(rule => rule.sequence_id === seq.id);
        rulesForSeq.forEach(rule => {
            const li = document.createElement('li');
            li.className = 'flow-rule-item';
            li.dataset.ruleId = rule.id;
            li.innerHTML = `<span>Regla ${rule.id}: Mov.${rule.origin_mov_id} 
                → Mov.${rule.destination_mov_id}</span><button class="delete-btn" data-rule-id="${rule.id}">X</button>`;
            ruleList.appendChild(li);
        });

        container.appendChild(seqBlock);
    });

    addSequenceListListeners();
}

/**
 * Añade todos los event listeners a los elementos de la lista de secuencias.
 * VERSIÓN UNIFICADA Y CORREGIDA
 */
function addSequenceListListeners() {
    // --- Listeners Generales ---
    // Cambiar el tipo de secuencia (Automática / Bajo Demanda)
    document.querySelectorAll('.sequence-type-selector').forEach(selector => {
        selector.addEventListener('change', (e) => {
            const seqId = parseInt(e.target.dataset.seqId, 10);
            const newType = parseInt(e.target.value, 10);
            const sequence = getProjectData().hardware_config.sequences.find(s => s.id === seqId);
            if (sequence) {
                sequence.type = newType;
                renderSequenceList(); // Re-dibuja para mostrar/ocultar el panel de reglas
            }
        });
    });

    // Eliminar una secuencia completa
    document.querySelectorAll('.sequence-header .delete-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteSequence(parseInt(e.target.dataset.seqId, 10)); }));
    
    // Abrir el modal para añadir un movimiento
    document.querySelectorAll('.add-movement-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); if(window.showAddMovementModal) window.showAddMovementModal(parseInt(e.target.dataset.seqId, 10)); }));
    
    // --- Listeners para MOVIMIENTOS ---
    // Seleccionar un item de movimiento
    document.querySelectorAll('.movement-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.movement-item.active, .flow-rule-item.active').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const movId = parseInt(item.dataset.movId, 10);
            const seqId = parseInt(item.dataset.seqId, 10);
            
            renderMovementEditor(movId); // Muestra el editor de movimiento
            renderSequenceVisualizer(seqId, 0); // Dibuja el visualizador de la secuencia
        });
    });

    // Eliminar un movimiento de una secuencia
    document.querySelectorAll('.movement-item .delete-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); handleDeleteMovement(parseInt(e.target.dataset.seqId, 10), parseInt(e.target.dataset.movId, 10)); }));

    // --- Listeners para REGLAS DE FLUJO ---
    // Añadir una nueva regla de flujo
    document.querySelectorAll('.add-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAddFlowRule(parseInt(e.target.dataset.seqId, 10));
        });
    });

    // Seleccionar un item de regla de flujo
    document.querySelectorAll('.flow-rule-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.movement-item.active, .flow-rule-item.active').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const ruleId = parseInt(item.dataset.ruleId, 10);
            
            renderFlowRuleEditor(ruleId); // Muestra el editor de la regla
            
            // Muestra también el visualizador para dar contexto
            const rule = getProjectData().hardware_config.flow_rules.find(r => r.id === ruleId);
            if (rule) {
                renderSequenceVisualizer(rule.sequence_id, 0);
            }
        });
    });

    // Eliminar una regla de flujo
    document.querySelectorAll('.flow-rule-item .delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteFlowRule(parseInt(e.target.dataset.ruleId, 10));
        });
    });
}


/**
 * Renderiza el editor para un movimiento específico en la columna derecha.
 * @param {number} movId - El ID del movimiento a editar.
 */
function renderMovementEditor(movId) {
    const hardware = getProjectData().hardware_config;
    const movement = hardware.movements.find(m => m.id === movId);
    const editorPanel = document.getElementById('movement-editor-panel');

    if (!movement) {
        editorPanel.innerHTML = '<p class="placeholder-text">Error: Movimiento no encontrado.</p>';
        return;
    }

    while (movement.times.length < 5) {
        movement.times.push(0);
    }

    let timesHTML = '<h5>Tiempos (segundos)</h5>';
    for (let i = 0; i < 5; i++) {
        timesHTML += `<div class="time-input-group"><label for="time-input-${i}">T${i}</label><input type="number" id="time-input-${i}" class="time-input" data-time-index="${i}" value="${movement.times[i]}" min="0" max="255"></div>`;
    }

    const lightStates = hexPortsToLightStates(movement);
    let lightsHTML = '<h5>Grupos Semafóricos</h5><div class="lights-grid">';
    for (let i = 1; i <= 8; i++) {
        lightsHTML += `<div class="light-group"><div class="light-group-title">Grupo ${i}</div>`;
        ['R', 'A', 'V'].forEach(lightType => {
            const lightId = `${lightType}${i}`;
            if (LIGHT_MAP[lightId]) {
                const isChecked = lightStates[lightId] ? 'checked' : '';
                lightsHTML += `<div class="light-control"><input type="checkbox" id="light-check-${lightId}" data-light-id="${lightId}" ${isChecked}><label for="light-check-${lightId}" class="light-label-${lightType}">${lightType}</label></div>`;
            }
        });
        lightsHTML += `</div>`;
    }
    lightsHTML += '</div>';

    editorPanel.innerHTML = `
        <h4>Editando Movimiento ${movId}</h4>
        <div class="movement-editor-grid">
            <div class="times-editor">${timesHTML}</div>
            <div class="lights-editor">${lightsHTML}</div>
        </div>
        <div id="conflict-warning-container"></div>
    `;

    const updateVisualizer = () => {
        const visualizer = document.getElementById('sequence-visualizer-container');
        if (visualizer.style.display !== 'none') {
            const activeItem = document.querySelector('.movement-item.active');
            if (activeItem) {
                const activeSeqId = parseInt(activeItem.dataset.seqId, 10);
                const selectedTimeIndex = parseInt(document.getElementById('visualizer-time-select').value, 10);
                renderSequenceVisualizer(activeSeqId, selectedTimeIndex);
            }
        }
    };

    editorPanel.querySelectorAll('.time-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const timeIndex = parseInt(e.target.dataset.timeIndex, 10);
            let value = parseInt(e.target.value, 10) || 0;
            if (value < 0) value = 0;
            if (value > 255) value = 255;
            movement.times[timeIndex] = value;
            e.target.value = value;
            updateVisualizer();
        });
    });

    editorPanel.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const currentLightStates = {};
            editorPanel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                currentLightStates[cb.dataset.lightId] = cb.checked;
            });
            const newPorts = lightStatesToHexPorts(currentLightStates);
            Object.assign(movement, newPorts);
            updateVisualizer();
            
            // Si es una luz verde o roja, actualizamos las restricciones
            if (checkbox.dataset.lightId.startsWith('V') || checkbox.dataset.lightId.startsWith('R')) {
                updateConflictRestraints(editorPanel);
            }

            
        });
    });
    
    // --- LLAMADA INICIAL PARA VALIDACIÓN ---
    // Verificamos el estado al cargar el editor por primera vez.
    const hasConflict = updateConflictRestraints(editorPanel);
    const warningContainer = document.getElementById('conflict-warning-container');
    if (hasConflict) {
        warningContainer.innerHTML = `<div class="conflict-warning"><strong>Advertencia:</strong> Este movimiento tiene un conflicto de luces verdes según la matriz actual. Por favor, corríjalo.</div>`;
    } else {
        warningContainer.innerHTML = '';
    }
}

// --- Lógica de Manejo de Datos (Añadir, Eliminar) ---
function handleAddSequence() {
    const hardware = getProjectData().hardware_config;
    const nextId = hardware.sequences.reduce((max, seq) => Math.max(max, seq.id), -1) + 1;
    
    // --- MODIFICACIÓN AQUÍ ---
    // Añadimos el campo "type: 0" para definirla como Automática por defecto.
    const newSequence = { 
        id: nextId, 
        type: 0, // 0 = SEQUENCE_TYPE_AUTOMATIC
        anchor_pos: 0, 
        movements: [] 
    };
    hardware.sequences.push(newSequence);
    
    renderSequenceList();
}

function handleAddMovement(seqId) {
    const hardware = getProjectData().hardware_config;
    const sequence = hardware.sequences.find(s => s.id === seqId);
    if (!sequence) return;

    // Encontrar el ID de movimiento más alto y sumarle 1
    const nextMovId = hardware.movements.reduce((max, mov) => Math.max(max, mov.id), -1) + 1;
    const newMovement = {
        id: nextMovId,
        portD: '00', portE: '00', portF: '00', portH: '00', portJ: '00',
        times: [0, 0, 0, 0, 0] // Inicializar con 5 tiempos en 0
    };

    hardware.movements.push(newMovement);
    sequence.movements.push(nextMovId);
    
    renderSequenceList();
    
    // Abrir el nuevo movimiento en el editor automáticamente
    // Necesitamos un pequeño delay para que el DOM se actualice
    setTimeout(() => {
        const newItem = document.querySelector(`.movement-item[data-mov-id="${nextMovId}"]`);
        if (newItem) newItem.click();
    }, 100);
}

function handleDeleteSequence(seqId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la Secuencia ${seqId}? Los movimientos que no se usen en otras secuencias también serán eliminados.`)) {
        return;
    }

    const data = getProjectData();
    const hardware = data.hardware_config;
    const seqIndex = hardware.sequences.findIndex(s => s.id === seqId);

    if (seqIndex === -1) return;

    // 1. Guardamos los movimientos de la secuencia que vamos a eliminar.
    const movementsToCheck = [...hardware.sequences[seqIndex].movements];

    // 2. Eliminamos la secuencia de la lista.
    hardware.sequences.splice(seqIndex, 1);

    // 3. Hacemos la "recolección de basura" de movimientos huérfanos.
    movementsToCheck.forEach(movId => {
        // Buscamos si el movimiento todavía es usado por ALGUNA de las secuencias restantes.
        const isMovementUsed = hardware.sequences.some(seq => seq.movements.includes(movId));

        // Si el movimiento ya no se usa en ningún lado, lo eliminamos de la lista global.
        if (!isMovementUsed) {
            const movIndex = hardware.movements.findIndex(m => m.id === movId);
            if (movIndex > -1) {
                hardware.movements.splice(movIndex, 1);
            }
        }
    });

    // 4. Limpiamos los paneles de la derecha y redibujamos la lista actualizada.
    document.getElementById('movement-editor-panel').innerHTML = '<p class="placeholder-text">Seleccione un movimiento de la lista para comenzar a editar.</p>';
    document.getElementById('sequence-visualizer-container').style.display = 'none';
    renderSequenceList();
}

function handleDeleteMovement(seqId, movId) {
    // --- LÓGICA DE BLOQUEO (OPCIÓN C) ---
    const isUsedByIntermittence = getProjectData().hardware_config.intermittences.some(inter => {
        const plan = getProjectData().hardware_config.plans.find(p => p.id === inter.id_plan);
        if (plan) {
            const sequence = getProjectData().hardware_config.sequences.find(s => s.id === plan.sequence_id);
            return sequence && sequence.id === seqId && inter.indice_mov === movId;
        }
        return false;
    });

    if (isUsedByIntermittence) {
        alert(`Error: No se puede quitar el Movimiento ${movId} porque está siendo utilizado por una o más Reglas de Intermitencia. Por favor, elimine esas reglas primero desde la pestaña 'Programación y Agenda'.`);
        return;
    }
    // --- FIN DE LA LÓGICA DE BLOQUEO ---

    if (!window.confirm(`¿Estás seguro de que quieres quitar el Movimiento ${movId} de la Secuencia ${seqId}?`)) {
        return;
    }

    const data = getProjectData();
    const sequence = data.hardware_config.sequences.find(s => s.id === seqId);

    if (sequence) {
        const index = sequence.movements.indexOf(movId);
        if (index > -1) {
            sequence.movements.splice(index, 1);
        }
    }

    document.getElementById('movement-editor-panel').innerHTML = '<p class="placeholder-text">Seleccione un movimiento de la lista para comenzar a editar.</p>';
    document.getElementById('sequence-visualizer-container').style.display = 'none';
    renderSequenceList();
}
// --- FUNCIONES AUXILIARES DE CONVERSIÓN (HEX <-> ESTADOS DE LUZ) ---

/**
 * Convierte los puertos hexadecimales de un movimiento a un objeto de estados booleanos.
 * @param {object} movement - El objeto del movimiento con portD, portE, etc.
 * @returns {object} Un objeto como { R1: true, A1: false, ... }
 */
function hexPortsToLightStates(movement) {
    const states = {};
    for (const lightId in LIGHT_MAP) {
        const { port, bit } = LIGHT_MAP[lightId];
        const portValue = parseInt(movement[port], 16);
        states[lightId] = (portValue & (1 << bit)) !== 0;
    }
    return states;
}

/**
 * Convierte un objeto de estados de luz booleanos a un objeto con puertos hexadecimales.
 * @param {object} states - Un objeto como { R1: true, A1: false, ... }
 * @returns {object} Un objeto como { portD: '80', portE: '00', ... }
 */
function lightStatesToHexPorts(states) {
    const ports = { portD: 0, portE: 0, portF: 0, portH: 0, portJ: 0 };
    for (const lightId in states) {
        if (states[lightId]) {
            const { port, bit } = LIGHT_MAP[lightId];
            if (ports[port] !== undefined) {
                ports[port] |= (1 << bit);
            }
        }
    }
    
    // Convertir los valores numéricos a cadenas hexadecimales de 2 caracteres
    return {
        portD: ports.portD.toString(16).padStart(2, '0').toUpperCase(),
        portE: ports.portE.toString(16).padStart(2, '0').toUpperCase(),
        portF: ports.portF.toString(16).padStart(2, '0').toUpperCase(),
        portH: ports.portH.toString(16).padStart(2, '0').toUpperCase(),
        portJ: ports.portJ.toString(16).padStart(2, '0').toUpperCase(),
    };
}


// =================================================================================
// --- INICIO: AÑADE ESTA NUEVA FUNCIÓN AQUÍ ---
// =================================================================================

/**
 * Obtiene el estado (rojo, ámbar, verde) para un grupo semafórico específico dentro de un movimiento.
 * @param {object} movement - El objeto del movimiento.
 * @param {number} groupNumber - El número del grupo (1-8).
 * @returns {object} Un objeto como { red: true, amber: false, green: false }.
 */
function getGroupStatus(movement, groupNumber) {
    // Mapeo local de qué luces pertenecen a cada grupo
    const GROUP_LIGHTS = {
        1: ['R1', 'A1', 'V1'], 2: ['R2', 'A2', 'V2'],
        3: ['R3', 'A3', 'V3'], 4: ['R4', 'A4', 'V4'],
        5: ['R5', 'A5', 'V5'], 6: ['R6', 'A6', 'V6'],
        7: ['R7', 'A7', 'V7'], 8: ['R8', 'A8', 'V8']
    };
    
    const lights = GROUP_LIGHTS[groupNumber];
    if (!lights) return { red: false, amber: false, green: false };

    const status = { red: false, amber: false, green: false };
    const lightStates = hexPortsToLightStates(movement); // Usamos la función que ya existe

    lights.forEach(lightName => {
        if (lightName.startsWith('R')) status.red = !!lightStates[lightName];
        else if (lightName.startsWith('A')) status.amber = !!lightStates[lightName];
        else if (lightName.startsWith('V')) status.green = !!lightStates[lightName];
    });
    
    return status;
}

/**
 * Actualiza las restricciones de los checkboxes según todos los conflictos definidos
 * (Rojo/Verde en el mismo grupo y Verde/Verde según la matriz).
 * @param {HTMLElement} editorPanel - El elemento contenedor del editor de movimiento.
 * @returns {boolean} - Devuelve true si se encontró un conflicto preexistente.
 */
function updateConflictRestraints(editorPanel) {
    const conflictMatrix = getProjectData().software_config.intersection.conflict_matrix;
    const allCheckboxes = editorPanel.querySelectorAll('input[type="checkbox"]');
    
    // --- PASO 1: RESTABLECER ESTADO ---
    // Habilitamos todas las casillas para empezar la validación desde cero.
    allCheckboxes.forEach(cb => {
        cb.disabled = false;
        cb.closest('.light-control').classList.remove('disabled');
    });

    // --- PASO 2: APLICAR CONFLICTO INTERNO ROJO/VERDE ---
    for (let i = 1; i <= 8; i++) {
        const redCheckbox = editorPanel.querySelector(`#light-check-R${i}`);
        const greenCheckbox = editorPanel.querySelector(`#light-check-V${i}`);

        if (redCheckbox && greenCheckbox) {
            if (redCheckbox.checked) {
                greenCheckbox.disabled = true;
                greenCheckbox.closest('.light-control').classList.add('disabled');
            } else if (greenCheckbox.checked) {
                redCheckbox.disabled = true;
                redCheckbox.closest('.light-control').classList.add('disabled');
            }
        }
    }

    // --- PASO 3: APLICAR CONFLICTO DE MATRIZ VERDE/VERDE ---
    const greenCheckboxes = editorPanel.querySelectorAll('input[data-light-id^="V"]');
    const activeGreenGroups = [];
    greenCheckboxes.forEach(cb => {
        if (cb.checked) {
            const groupIndex = parseInt(cb.dataset.lightId.replace('V', ''), 10) - 1;
            activeGreenGroups.push(groupIndex);
        }
    });

    const conflictingGroups = new Set();
    activeGreenGroups.forEach(groupIndex => {
        conflictMatrix[groupIndex].forEach((hasConflict, otherGroupIndex) => {
            if (hasConflict) {
                conflictingGroups.add(otherGroupIndex);
            }
        });
    });

    greenCheckboxes.forEach(cb => {
        const groupIndex = parseInt(cb.dataset.lightId.replace('V', ''), 10) - 1;
        if (conflictingGroups.has(groupIndex) && !activeGreenGroups.includes(groupIndex)) {
            cb.disabled = true;
            cb.closest('.light-control').classList.add('disabled');
        }
    });
    
    // --- PASO 4: VERIFICAR CONFLICTOS PREEXISTENTES ---
    for (let i = 0; i < activeGreenGroups.length; i++) {
        for (let j = i + 1; j < activeGreenGroups.length; j++) {
            if (conflictMatrix[activeGreenGroups[i]][activeGreenGroups[j]]) {
                return true; // Conflicto de matriz encontrado
            }
        }
    }
    
    return false; // No se encontraron conflictos
}

// =================================================================================
// --- INICIO: NUEVAS FUNCIONES AÑADIDAS ---
// =================================================================================

/**
 * Dibuja la línea de tiempo completa para una secuencia seleccionada.
 * @param {number} seqId - El ID de la secuencia a visualizar.
 * @param {number} timeIndex - El índice del tiempo (0-4) a utilizar para las duraciones.
 */
/*
function renderSequenceVisualizer(seqId, timeIndex) {
    const hardware = getProjectData().hardware_config;
    const sequence = hardware.sequences.find(s => s.id === seqId);
    const visualizerContainer = document.getElementById('sequence-visualizer-container');

    if (!sequence || sequence.movements.length === 0) {
        visualizerContainer.style.display = 'none';
        return;
    }

    const cycleMovements = sequence.movements.map(movId => hardware.movements.find(m => m.id === movId)).filter(Boolean);
    const totalCycleTime = cycleMovements.reduce((total, mov) => total + (mov.times[timeIndex] || 0), 0);

    visualizerContainer.style.display = 'block';
    visualizerContainer.innerHTML = `
        <div class="sequence-visualizer-header">
            <h5>Visualización de Secuencia ${seqId}</h5>
            <div class="visualizer-controls">
                <label for="visualizer-time-select">Índice de Tiempo:</label>
                <select id="visualizer-time-select">
                    <option value="0" ${timeIndex === 0 ? 'selected' : ''}>T0</option>
                    <option value="1" ${timeIndex === 1 ? 'selected' : ''}>T1</option>
                    <option value="2" ${timeIndex === 2 ? 'selected' : ''}>T2</option>
                    <option value="3" ${timeIndex === 3 ? 'selected' : ''}>T3</option>
                    <option value="4" ${timeIndex === 4 ? 'selected' : ''}>T4</option>
                </select>
                <span><b>Ciclo Total:</b> ${totalCycleTime}s</span>
            </div>
        </div>
        <div class="timeline-wrapper" id="sequence-timeline-wrapper">
            <div class="timeline-grid-container" id="sequence-timeline-grid"></div>
        </div>
    `;

    const gridContainer = document.getElementById('sequence-timeline-grid');
    if (totalCycleTime > 0) {
        // --- Lógica de dibujado CORREGIDA ---
        let gridHTML = '';

        // 1. Fondo con la rejilla (ahora parte del string HTML)
        const majorTickInterval = totalCycleTime > 100 ? 10 : (totalCycleTime > 30 ? 5 : 2);
        const backgroundStyle = `
            background-image: 
                repeating-linear-gradient(to right, #f0f0f0, #f0f0f0 1px, transparent 1px, transparent calc(${100/totalCycleTime}%)),
                repeating-linear-gradient(to right, #ccc, #ccc 1px, transparent 1px, transparent calc(${majorTickInterval*100/totalCycleTime}%));
        `;
        gridHTML += `<div class="timeline-bars-area" style="${backgroundStyle}"></div>`;

        // 2. Cabeceras y etiquetas de Etapa
        gridHTML += `
            <div class="grid-cell header grid-label">Etapa</div>
            <div class="grid-cell header timeline-stages-content">
        `;
        let accumulatedTime = 0;
        cycleMovements.forEach(mov => {
            const duration = mov.times[timeIndex] || 0;
            if (duration > 0) {
                const startPercent = (accumulatedTime / totalCycleTime) * 100;
                const widthPercent = (duration / totalCycleTime) * 100;
                gridHTML += `
                    <div class="stage-separator" style="left: ${startPercent}%;"></div>
                    <span class="stage-label" style="left: ${startPercent + (widthPercent / 2)}%;">Mov. ${mov.id}</span>
                `;
                accumulatedTime += duration;
            }
        });
        gridHTML += '</div>';

        // 3. Barras de los grupos semafóricos
        for (let i = 1; i <= 8; i++) {
            gridHTML += `<div class="grid-cell grid-label">G${i}</div><div class="grid-cell timeline-bar-container">`;
            cycleMovements.forEach(mov => {
                const duration = mov.times[timeIndex] || 0;
                if (duration === 0) return;
                
                const status = getGroupStatus(mov, i);
                let colorClass = 'gray';
                if (Object.values(status).filter(Boolean).length > 1) colorClass = 'violet';
                else if (status.green) colorClass = 'green';
                else if (status.amber) colorClass = 'amber';
                else if (status.red) colorClass = 'red';
                
                const widthPercent = (duration / totalCycleTime) * 100;
                gridHTML += `<div class="timeline-segment ${colorClass}" style="width: ${widthPercent}%" title="G${i}, Mov ${mov.id}, ${duration}s"></div>`;
            });
            gridHTML += `</div>`;
        }

        // 4. Se asigna todo el HTML al contenedor de una sola vez
        gridContainer.innerHTML = gridHTML;
    }

    // El listener para el selector de tiempo
    document.getElementById('visualizer-time-select').addEventListener('change', (e) => {
        renderSequenceVisualizer(seqId, parseInt(e.target.value, 10));
    });
}
    */
/**
 * Inicializa los listeners y la lógica para el modal de añadir movimiento.
 */
function setupAddMovementModal() {
    const modal = document.getElementById('add-movement-modal');
    if (!modal) return;
    
    let currentSeqId = null;

    const showModal = (seqId) => {
        currentSeqId = seqId;
        document.getElementById('modal-title').textContent = `Añadir Movimiento a Secuencia ${seqId}`;
        document.getElementById('modal-step-1').style.display = 'block';
        document.getElementById('modal-step-2').style.display = 'none';
        modal.classList.add('visible');
    };

    const hideModal = () => modal.classList.remove('visible');

    document.getElementById('modal-btn-cancel').addEventListener('click', hideModal);

    document.getElementById('modal-btn-new').addEventListener('click', () => {
        const hardware = getProjectData().hardware_config;
        const nextMovId = hardware.movements.reduce((max, mov) => Math.max(max, mov.id), -1) + 1;
        const newMovement = { id: nextMovId, portD: '00', portE: '00', portF: '00', portH: '00', portJ: '00', times: [3, 3, 3, 3, 3] }; // Tiempos por defecto
        hardware.movements.push(newMovement);
        
        const sequence = hardware.sequences.find(s => s.id === currentSeqId);
        sequence.movements.push(nextMovId);
        
        hideModal();
        renderSequenceList();
        setTimeout(() => { document.querySelector(`.movement-item[data-mov-id="${nextMovId}"]`)?.click(); }, 100);
    });

    document.getElementById('modal-btn-existing').addEventListener('click', () => {
        const hardware = getProjectData().hardware_config;
        const sequence = hardware.sequences.find(s => s.id === currentSeqId);
        const selector = document.getElementById('modal-select-movement');
        selector.innerHTML = '';

        const availableMovements = hardware.movements.filter(mov => !sequence.movements.includes(mov.id));
        
        if (availableMovements.length > 0) {
            availableMovements.forEach(mov => {
                selector.add(new Option(`Movimiento ${mov.id}`, mov.id));
            });
        } else {
            selector.add(new Option('No hay movimientos disponibles para añadir', ''));
        }
        
        document.getElementById('modal-step-1').style.display = 'none';
        document.getElementById('modal-step-2').style.display = 'block';
    });
    
    document.getElementById('modal-btn-add-selected').addEventListener('click', () => {
        const movIdToAdd = parseInt(document.getElementById('modal-select-movement').value, 10);
        if (isNaN(movIdToAdd)) return;

        const sequence = getProjectData().hardware_config.sequences.find(s => s.id === currentSeqId);
        sequence.movements.push(movIdToAdd);
        
        hideModal();
        renderSequenceList();
    });
    
    // Asignamos la función `showModal` a un objeto global temporal para que sea accesible desde otros listeners
    window.showAddMovementModal = showModal;
}

// =================================================================================
// --- FIN: NUEVAS FUNCIONES AÑADIDAS ---
// =================================================================================

/**
 * Maneja la creación de una nueva regla de flujo para una secuencia.
 * @param {number} seqId - El ID de la secuencia.
 */
function handleAddFlowRule(seqId) {
    const hardware = getProjectData().hardware_config;
    const nextRuleId = hardware.flow_rules.reduce((max, rule) => Math.max(max, rule.id), -1) + 1;

    const newRule = {
        id: nextRuleId,
        sequence_id: seqId,
        origin_mov_id: 0,
        rule_type: 0, // GOTO por defecto
        demand_mask: 0,
        destination_mov_id: 0
    };

    hardware.flow_rules.push(newRule);
    renderSequenceList();
    setTimeout(() => { document.querySelector(`.flow-rule-item[data-rule-id="${nextRuleId}"]`)?.click(); }, 100);
}

/**
 * Maneja la eliminación de una regla de flujo.
 * @param {number} ruleId - El ID de la regla a eliminar.
 */
function handleDeleteFlowRule(ruleId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la Regla de Flujo ${ruleId}?`)) return;

    const hardware = getProjectData().hardware_config;
    const ruleIndex = hardware.flow_rules.findIndex(r => r.id === ruleId);

    if (ruleIndex > -1) {
        hardware.flow_rules.splice(ruleIndex, 1);
        document.getElementById('movement-editor-panel').innerHTML = '<p class="placeholder-text">Seleccione un item de la lista para editar.</p>';
        renderSequenceList();
    }
}

/**
 * Renderiza el editor para una REGLA DE FLUJO específica.
 * @param {number} ruleId - El ID de la regla a editar.
 */
function renderFlowRuleEditor(ruleId) {
    const hardware = getProjectData().hardware_config;
    const rule = hardware.flow_rules.find(r => r.id === ruleId);
    const editorPanel = document.getElementById('movement-editor-panel');
    if (!rule) { editorPanel.innerHTML = '<p class="placeholder-text">Error: Regla no encontrada.</p>'; return; }

    const sequence = hardware.sequences.find(s => s.id === rule.sequence_id);
    const movementsInSeq = sequence ? sequence.movements : [];

    // Opciones para los selectores de movimiento
    let movOptions = movementsInSeq.map(movId => `<option value="${movId}">Movimiento ${movId}</option>`).join('');

    // Checkboxes para la máscara de demanda
    let demandCheckboxes = `
        <div class="demand-mask-grid">
            <label><input type="checkbox" data-bit="0" ${ (rule.demand_mask & 1) ? 'checked' : '' }> P1 (RB0)</label>
            <label><input type="checkbox" data-bit="1" ${ (rule.demand_mask & 2) ? 'checked' : '' }> P2 (RB1)</label>
            <label><input type="checkbox" data-bit="2" ${ (rule.demand_mask & 4) ? 'checked' : '' }> P3 (RB2)</label>
            <label><input type="checkbox" data-bit="3" ${ (rule.demand_mask & 8) ? 'checked' : '' }> P4 (RB3)</label>
        </div>
    `;

    editorPanel.innerHTML = `
        <h4>Editando Regla de Flujo ${rule.id}</h4>
        <div class="rule-editor-form">
            <div class="form-group">
                <label for="rule-origin-mov">Movimiento de Origen (Disparador)</label>
                <select id="rule-origin-mov">${movOptions}</select>
            </div>
            <div class="form-group">
                <label for="rule-type">Tipo de Regla</label>
                <select id="rule-type">
                    <option value="0" ${rule.rule_type === 0 ? 'selected' : ''}>GOTO (Salto Incondicional)</option>
                    <option value="1" ${rule.rule_type === 1 ? 'selected' : ''}>Punto de Decisión</option>
                </select>
            </div>
            <div class="form-group" id="demand-mask-container" style="display: ${rule.rule_type === 1 ? 'block' : 'none'};">
                <label>Condición de Demanda (se activa con CUALQUIERA de los seleccionados)</label>
                ${demandCheckboxes}
            </div>
            <div class="form-group">
                <label for="rule-dest-mov">Movimiento de Destino (Salto)</label>
                <select id="rule-dest-mov">${movOptions}</select>
            </div>
        </div>
    `;

    // Asignar valores y listeners
    document.getElementById('rule-origin-mov').value = rule.origin_mov_id;
    document.getElementById('rule-dest-mov').value = rule.destination_mov_id;

    document.getElementById('rule-origin-mov').addEventListener('change', (e) => { rule.origin_mov_id = parseInt(e.target.value, 10); renderSequenceList(); });
    document.getElementById('rule-dest-mov').addEventListener('change', (e) => { rule.destination_mov_id = parseInt(e.target.value, 10); renderSequenceList(); });
    
    const typeSelector = document.getElementById('rule-type');
    typeSelector.addEventListener('change', (e) => {
        rule.rule_type = parseInt(e.target.value, 10);
        document.getElementById('demand-mask-container').style.display = rule.rule_type === 1 ? 'block' : 'none';
    });

    document.querySelectorAll('#demand-mask-container input').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            let newMask = 0;
            document.querySelectorAll('#demand-mask-container input:checked').forEach(cb => {
                newMask |= (1 << parseInt(cb.dataset.bit, 10));
            });
            rule.demand_mask = newMask;
        });
    });
}

/**
 * Mejora la función de renderizado del visualizador para incluir las reglas de flujo.
 */
function renderSequenceVisualizer(seqId, timeIndex) {
    const hardware = getProjectData().hardware_config;
    const sequence = hardware.sequences.find(s => s.id === seqId);
    const visualizerContainer = document.getElementById('sequence-visualizer-container');
    if (!sequence || sequence.movements.length === 0) { visualizerContainer.style.display = 'none'; return; }

    const cycleMovements = sequence.movements.map(movId => hardware.movements.find(m => m.id === movId)).filter(Boolean);
    const totalCycleTime = cycleMovements.reduce((total, mov) => total + (mov.times[timeIndex] || 0), 0);

    visualizerContainer.style.display = 'block';
    visualizerContainer.innerHTML = `
        <div class="sequence-visualizer-header">
            <h5>Visualización de Secuencia ${seqId}</h5>
            <div class="visualizer-controls">
                <label for="visualizer-time-select">Índice de Tiempo:</label>
                <select id="visualizer-time-select">
                    <option value="0" ${timeIndex === 0 ? 'selected' : ''}>T0</option>
                    <option value="1" ${timeIndex === 1 ? 'selected' : ''}>T1</option>
                    <option value="2" ${timeIndex === 2 ? 'selected' : ''}>T2</option>
                    <option value="3" ${timeIndex === 3 ? 'selected' : ''}>T3</option>
                    <option value="4" ${timeIndex === 4 ? 'selected' : ''}>T4</option>
                </select>
                <span><b>Ciclo Total:</b> ${totalCycleTime}s</span>
            </div>
        </div>
        <div class="timeline-wrapper" id="sequence-timeline-wrapper">
            <div class="timeline-grid-container" id="sequence-timeline-grid"></div>
        </div>
    `;

    const gridContainer = document.getElementById('sequence-timeline-grid');
    if (totalCycleTime > 0) {
        let gridHTML = '';
        const majorTickInterval = totalCycleTime > 100 ? 10 : (totalCycleTime > 30 ? 5 : 2);
        const backgroundStyle = `background-image: repeating-linear-gradient(to right, #f0f0f0, #f0f0f0 1px, transparent 1px, transparent calc(${100/totalCycleTime}%)), repeating-linear-gradient(to right, #ccc, #ccc 1px, transparent 1px, transparent calc(${majorTickInterval*100/totalCycleTime}%));`;
        gridHTML += `<div class="timeline-bars-area" style="${backgroundStyle}"></div>`;
        gridHTML += `<div class="grid-cell header grid-label">Etapa</div><div class="grid-cell header timeline-stages-content">`;
        
        let accumulatedTime = 0;
        cycleMovements.forEach(mov => {
            const duration = mov.times[timeIndex] || 0;
            if (duration > 0) {
                const startPercent = (accumulatedTime / totalCycleTime) * 100;
                const widthPercent = (duration / totalCycleTime) * 100;
                // --- MODIFICACIÓN: Añadir indicador para reglas de flujo ---
                const isOrigin = hardware.flow_rules.some(r => r.sequence_id === seqId && r.origin_mov_id === mov.id);
                const ruleIcon = isOrigin ? ' 决策' : ''; // Icono para punto de decisión
                gridHTML += `<div class="stage-separator" style="left: ${startPercent}%;"></div><span class="stage-label" style="left: ${startPercent + (widthPercent / 2)}%;">Mov. ${mov.id}${ruleIcon}</span>`;
                accumulatedTime += duration;
            }
        });
        gridHTML += '</div>';

        for (let i = 1; i <= 8; i++) {
            gridHTML += `<div class="grid-cell grid-label">G${i}</div><div class="grid-cell timeline-bar-container">`;
            cycleMovements.forEach(mov => {
                const duration = mov.times[timeIndex] || 0;
                if (duration === 0) return;
                const status = getGroupStatus(mov, i);
                let colorClass = 'gray';
                if (Object.values(status).filter(Boolean).length > 1) colorClass = 'violet';
                else if (status.green) colorClass = 'green';
                else if (status.amber) colorClass = 'amber';
                else if (status.red) colorClass = 'red';
                const widthPercent = (duration / totalCycleTime) * 100;
                gridHTML += `<div class="timeline-segment ${colorClass}" style="width: ${widthPercent}%" title="G${i}, Mov ${mov.id}, ${duration}s"></div>`;
            });
            gridHTML += `</div>`;
        }
        gridContainer.innerHTML = gridHTML;
    }

    document.getElementById('visualizer-time-select').addEventListener('change', (e) => {
        renderSequenceVisualizer(seqId, parseInt(e.target.value, 10));
    });
}


// =================================================================================
// --- PESTAÑA 3: PROGRAMACIÓN Y AGENDA ---
// =================================================================================

function initializeSchedulingTab() {
    renderPlanList();
    document.getElementById('add-plan-btn').addEventListener('click', handleAddPlan);
    // NUEVO: Inicializamos también el panel de intermitencias
    renderIntermittencePanel();
}

/**
 * Renderiza la lista de planes en la columna izquierda.
 */
function renderPlanList() {
    const container = document.getElementById('plan-list-container');
    const plans = getProjectData().hardware_config.plans;
    container.innerHTML = '';

    // Ordenamos los planes por hora para una mejor visualización
    const sortedPlans = [...plans].sort((a, b) => a.hour - b.hour || a.minute - b.minute);

    sortedPlans.forEach(plan => {
        const item = document.createElement('div');
        item.className = 'plan-item';
        item.dataset.planId = plan.id;

        const dayText = DAY_TYPE_LEGEND[plan.day_type_id] || 'Desconocido';
        const timeText = `${String(plan.hour).padStart(2, '0')}:${String(plan.minute).padStart(2, '0')}`;

        item.innerHTML = `
            <div class="plan-item-summary">
                <span class="plan-item-title">Plan #${plan.id}</span>
                <span class="plan-item-details">Sec. ${plan.sequence_id}, T${plan.time_sel} | ${dayText} @ ${timeText}</span>
            </div>
        `;
        container.appendChild(item);
    });

    // Añadir listeners para seleccionar un plan
    container.querySelectorAll('.plan-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.plan-item.active').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderPlanEditor(parseInt(item.dataset.planId, 10));
        });
    });
}

/**
 * Renderiza el editor para un plan específico en la columna derecha.
 * @param {number} planId - El ID del plan a editar.
 */
function renderPlanEditor(planId) {
    const hardware = getProjectData().hardware_config;
    const plan = hardware.plans.find(p => p.id === planId);
    const editorContainer = document.getElementById('plan-editor-container');
    if (!plan) {
        editorContainer.innerHTML = '<p class="placeholder-text">Error: Plan no encontrado.</p>';
        return;
    }

    // Opciones para los selectores
    const dayTypeOptions = Object.entries(DAY_TYPE_LEGEND).map(([id, text]) => `<option value="${id}">${id}: ${text}</option>`).join('');
    const sequenceOptions = hardware.sequences.map(seq => `<option value="${seq.id}">Secuencia ${seq.id}</option>`).join('');
    const timeOptions = [0, 1, 2, 3, 4].map(i => `<option value="${i}">T${i}</option>`).join('');

    editorContainer.innerHTML = `
        <h4>Editando Plan #${plan.id}</h4>
        <div class="form-group">
            <label>Hora de Inicio</label>
            <div class="time-editor-group">
                <input type="number" id="plan-hour" value="${plan.hour}" min="0" max="23" placeholder="Hora">
                <input type="number" id="plan-minute" value="${plan.minute}" min="0" max="59" placeholder="Minuto">
            </div>
        </div>
        <div class="form-group">
            <label for="plan-day-type">Días de Aplicación</label>
            <select id="plan-day-type">${dayTypeOptions}</select>
        </div>
        <div class="form-group">
            <label for="plan-sequence">Secuencia a Ejecutar</label>
            <select id="plan-sequence">${sequenceOptions}</select>
        </div>
        <div class="form-group">
            <label for="plan-time-sel">Índice de Tiempo</label>
            <select id="plan-time-sel">${timeOptions}</select>
        </div>
        <button id="delete-plan-btn" class="delete-btn" style="width: 100%; padding: 10px;">Eliminar Plan</button>
    `;

    // Asignar valores actuales a los selectores
    document.getElementById('plan-day-type').value = plan.day_type_id;
    document.getElementById('plan-sequence').value = plan.sequence_id;
    document.getElementById('plan-time-sel').value = plan.time_sel;

    // Añadir listeners para guardar los cambios en tiempo real
    const updatePlan = (key, value) => {
        // Validación para evitar planes duplicados
        if (key === 'hour' || key === 'minute' || key === 'day_type_id') {
            const newHour = key === 'hour' ? value : plan.hour;
            const newMinute = key === 'minute' ? value : plan.minute;
            const newDayType = key === 'day_type_id' ? value : plan.day_type_id;
            
            const isDuplicate = hardware.plans.some(p => 
                p.id !== plan.id &&
                p.day_type_id === newDayType &&
                p.hour === newHour &&
                p.minute === newMinute
            );
            
            if (isDuplicate) {
                alert('Error: Ya existe un plan para el mismo tipo de día y hora de inicio. No se guardará el cambio.');
                renderPlanList(); // Re-renderiza para restaurar la vista
                document.querySelector(`.plan-item[data-plan-id="${plan.id}"]`)?.click();
                return;
            }
        }
        
        plan[key] = value;
        renderPlanList(); // Re-renderiza la lista para actualizar el resumen
        document.querySelector(`.plan-item[data-plan-id="${plan.id}"]`)?.classList.add('active'); // Mantiene la selección activa
    };

    document.getElementById('plan-hour').addEventListener('input', (e) => updatePlan('hour', parseInt(e.target.value, 10) || 0));
    document.getElementById('plan-minute').addEventListener('input', (e) => updatePlan('minute', parseInt(e.target.value, 10) || 0));
    document.getElementById('plan-day-type').addEventListener('change', (e) => updatePlan('day_type_id', parseInt(e.target.value, 10)));
    document.getElementById('plan-sequence').addEventListener('change', (e) => updatePlan('sequence_id', parseInt(e.target.value, 10)));
    document.getElementById('plan-time-sel').addEventListener('change', (e) => updatePlan('time_sel', parseInt(e.target.value, 10)));
    document.getElementById('delete-plan-btn').addEventListener('click', () => handleDeletePlan(plan.id));
}

/**
 * Maneja la creación de un nuevo plan.
 */
function handleAddPlan() {
    const hardware = getProjectData().hardware_config;
    if (hardware.plans.length >= 20) {
        alert("Error: Se ha alcanzado el número máximo de 20 planes.");
        return;
    }
    
    // Encontrar el ID más alto y sumarle 1
    const nextId = hardware.plans.reduce((max, p) => Math.max(max, p.id), -1) + 1;
    const newPlan = {
        id: nextId,
        day_type_id: 7, // Todos los días por defecto
        hour: 0,
        minute: 0,
        sequence_id: hardware.sequences.length > 0 ? hardware.sequences[0].id : 0,
        time_sel: 0
    };

    hardware.plans.push(newPlan);
    renderPlanList();
    // Seleccionar automáticamente el nuevo plan
    setTimeout(() => { document.querySelector(`.plan-item[data-plan-id="${nextId}"]`)?.click(); }, 100);
}

/**
 * Maneja la eliminación de un plan.
 * @param {number} planId - El ID del plan a eliminar.
 */
function handleDeletePlan(planId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el Plan #${planId}?`)) return;

    const hardware = getProjectData().hardware_config;
    const planIndex = hardware.plans.findIndex(p => p.id === planId);
    
    if (planIndex > -1) {
        hardware.plans.splice(planIndex, 1);
        document.getElementById('plan-editor-container').innerHTML = '<p class="placeholder-text">Seleccione un plan de la lista para comenzar a editar.</p>';
        renderPlanList();
    }
}

// =================================================================================
// --- INICIO: NUEVAS FUNCIONES PARA GESTIÓN DE INTERMITENCIAS ---
// =================================================================================

/**
 * Renderiza el panel completo de gestión de intermitencias.
 */
/**
 * Renderiza el contenido del panel de gestión de intermitencias.
 */
function renderIntermittencePanel() {
    // La estructura principal ya está en el HTML, solo necesitamos
    // renderizar la lista y asignar el listener al botón.
    renderIntermittenceList();
    document.getElementById('add-intermittence-btn').addEventListener('click', handleAddIntermittence);
}

/**
 * Renderiza la lista de reglas de intermitencia.
 */
function renderIntermittenceList() {
    const container = document.getElementById('intermittence-list-container');
    const intermittences = getProjectData().hardware_config.intermittences;
    container.innerHTML = '';

    intermittences.forEach(rule => {
        const item = document.createElement('li');
        item.className = 'intermittence-item';
        item.dataset.ruleId = rule.id;
        item.innerHTML = `
            <span>Regla #${rule.id}: Plan ${rule.id_plan}, Mov. ${rule.indice_mov}</span>
            <button class="delete-btn" data-rule-id="${rule.id}">X</button>
        `;
        container.appendChild(item);
    });

    // Listeners
    container.querySelectorAll('.intermittence-item').forEach(item => {
        item.addEventListener('click', () => {
            container.querySelectorAll('.intermittence-item.active').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            renderIntermittenceEditor(parseInt(item.dataset.ruleId, 10));
        });
    });

    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteIntermittence(parseInt(e.target.dataset.ruleId, 10));
        });
    });
}

/**
 * Renderiza el editor para una regla de intermitencia.
 * @param {number} ruleId - El ID de la regla a editar.
 */
function renderIntermittenceEditor(ruleId) {
    const hardware = getProjectData().hardware_config;
    const rule = hardware.intermittences.find(r => r.id === ruleId);
    const editorContainer = document.getElementById('intermittence-editor-container');
    if (!rule) { editorContainer.innerHTML = '<p class="placeholder-text">Error: Regla no encontrada.</p>'; return; }

    const planOptions = hardware.plans.map(p => `<option value="${p.id}">Plan ${p.id}</option>`).join('');

    editorContainer.innerHTML = `
        <h6>Editando Regla de Intermitencia #${rule.id}</h6>
        <div class="form-group">
            <label for="inter-plan">Plan Vinculado</label>
            <select id="inter-plan">${planOptions}</select>
        </div>
        <div class="form-group">
            <label for="inter-mov">Movimiento Afectado</label>
            <select id="inter-mov"></select>
        </div>
        <div class="form-group">
            <label>Luces a Hacer Intermitentes</label>
            <div class="lights-grid" id="inter-lights-grid"></div>
        </div>
    `;

    const planSelector = document.getElementById('inter-plan');
    const movSelector = document.getElementById('inter-mov');

    // Función para actualizar el menú de movimientos y la cuadrícula de luces
    const updateEditorFields = (selectedPlanId) => {
        const plan = hardware.plans.find(p => p.id === selectedPlanId);
        movSelector.innerHTML = ''; // Limpiar opciones

        if (plan) {
            const sequence = hardware.sequences.find(s => s.id === plan.sequence_id);
            if (sequence) {
                sequence.movements.forEach(movId => {
                    movSelector.add(new Option(`Movimiento ${movId}`, movId));
                });
            }
        }
        
        // Seleccionar el movimiento guardado si aún existe en la lista
        const currentMovId = rule.indice_mov;
        if (Array.from(movSelector.options).some(opt => opt.value == currentMovId)) {
            movSelector.value = currentMovId;
        } else {
            // Si el movimiento guardado ya no es válido, seleccionamos el primero y actualizamos el objeto
            rule.indice_mov = movSelector.options.length > 0 ? parseInt(movSelector.options[0].value, 10) : 0;
        }

        updateLightsGrid(rule.indice_mov);
    };

    // Función para actualizar la cuadrícula de checkboxes
    const updateLightsGrid = (selectedMovId) => {
        const lightsGrid = document.getElementById('inter-lights-grid');
        const movement = hardware.movements.find(m => m.id === selectedMovId);
        lightsGrid.innerHTML = '';
        if (!movement) return;

        const activeLights = hexPortsToLightStates(movement);
        
        for (let i = 1; i <= 8; i++) {
            let groupHTML = `<div class="light-group">`;
            ['R', 'A', 'V'].forEach(lightType => {
                const lightId = `${lightType}${i}`;
                if (LIGHT_MAP[lightId]) {
                    const isEnabled = activeLights[lightId]; // La luz está encendida en el movimiento?
                    const isChecked = (parseInt(rule[`mask${LIGHT_MAP[lightId].port.slice(-1).toUpperCase()}`], 16) & (1 << LIGHT_MAP[lightId].bit)) !== 0;

                    groupHTML += `
                        <div class="light-control ${!isEnabled ? 'disabled' : ''}">
                            <input type="checkbox" id="inter-check-${lightId}" data-light-id="${lightId}" ${isChecked ? 'checked' : ''} ${!isEnabled ? 'disabled' : ''}>
                            <label for="inter-check-${lightId}" class="light-label-${lightType}">${lightType}</label>
                        </div>
                    `;
                }
            });
            groupHTML += `</div>`;
            lightsGrid.innerHTML += groupHTML;
        }

        // Añadir listeners a los nuevos checkboxes
        lightsGrid.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const masks = { D: 0, E: 0, F: 0 };
                lightsGrid.querySelectorAll('input:checked').forEach(cb => {
                    const lightInfo = LIGHT_MAP[cb.dataset.lightId];
                    masks[lightInfo.port.slice(-1).toUpperCase()] |= (1 << lightInfo.bit);
                });
                
                rule.maskD = masks.D.toString(16).padStart(2, '0').toUpperCase();
                rule.maskE = masks.E.toString(16).padStart(2, '0').toUpperCase();
                rule.maskF = masks.F.toString(16).padStart(2, '0').toUpperCase();
                
                // Aplicar/quitar animación
                const label = checkbox.nextElementSibling;
                label.classList.toggle('blinking', checkbox.checked);
            });
            // Aplicar animación inicial
            const label = checkbox.nextElementSibling;
            label.classList.toggle('blinking', checkbox.checked);
        });
    };

    // Listeners principales
    planSelector.addEventListener('change', () => {
        const newPlanId = parseInt(planSelector.value, 10);
        rule.id_plan = newPlanId;
        updateEditorFields(newPlanId);
        renderIntermittenceList(); // Actualizar el resumen
    });

    movSelector.addEventListener('change', () => {
        const newMovId = parseInt(movSelector.value, 10);
        rule.indice_mov = newMovId;
        updateLightsGrid(newMovId);
        renderIntermittenceList(); // Actualizar el resumen
    });

    // Carga inicial
    planSelector.value = rule.id_plan;
    updateEditorFields(rule.id_plan);
}

/**
 * Maneja la creación de una nueva regla de intermitencia.
 */
function handleAddIntermittence() {
    const hardware = getProjectData().hardware_config;
    if (hardware.intermittences.length >= 10) {
        alert("Error: Se ha alcanzado el número máximo de 10 reglas de intermitencia.");
        return;
    }

    const nextId = hardware.intermittences.reduce((max, r) => Math.max(max, r.id), -1) + 1;
    const newRule = {
        id: nextId,
        id_plan: hardware.plans.length > 0 ? hardware.plans[0].id : 0,
        indice_mov: 0,
        maskD: "00", maskE: "00", maskF: "00"
    };

    hardware.intermittences.push(newRule);
    renderIntermittenceList();
    setTimeout(() => { document.querySelector(`.intermittence-item[data-rule-id="${nextId}"]`)?.click(); }, 100);
}

/**
 * Maneja la eliminación de una regla de intermitencia.
 * @param {number} ruleId - El ID de la regla a eliminar.
 */
function handleDeleteIntermittence(ruleId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la Regla de Intermitencia #${ruleId}?`)) return;

    const hardware = getProjectData().hardware_config;
    const ruleIndex = hardware.intermittences.findIndex(r => r.id === ruleId);
    
    if (ruleIndex > -1) {
        hardware.intermittences.splice(ruleIndex, 1);
        document.getElementById('intermittence-editor-container').innerHTML = '<p class="placeholder-text">Seleccione una regla para editar.</p>';
        renderIntermittenceList();
    }
}