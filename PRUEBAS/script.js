// --- INICIO DEL CÓDIGO JAVASCRIPT ---

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN INICIAL Y VARIABLES GLOBALES ---

    let map;
    let designData = {
        mapInfo: {},
        elements: []
    };
    let markers = {}; // Objeto para guardar las referencias a los marcadores de Leaflet
    let elementCounter = 0;

    // --- ÍCONOS SVG PERSONALIZADOS ---
    const icons = {
        vehicular: L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 160" width="25" height="60"><rect x="2" y="2" width="60" height="156" rx="10" fill="black"/><circle cx="32" cy="32" r="20" fill="#ff0000" stroke="gray" stroke-width="2"/><circle cx="32" cy="80" r="20" fill="#ffff00" stroke="gray" stroke-width="2"/><circle cx="32" cy="128" r="20" fill="#00ff00" stroke="gray" stroke-width="2"/></svg>'),
            iconSize: [25, 60], iconAnchor: [12, 30], popupAnchor: [0, -30]
        }),
        peatonal: L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 110" width="25" height="45"><rect x="2" y="2" width="60" height="106" rx="10" fill="black"/><circle cx="32" cy="30" r="20" fill="#ff0000" stroke="gray" stroke-width="2"/><circle cx="32" cy="80" r="20" fill="#00ff00" stroke="gray" stroke-width="2"/></svg>'),
            iconSize: [25, 45], iconAnchor: [12, 22], popupAnchor: [0, -22]
        }),
        boton: L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="30" height="30"><rect x="5" y="5" width="90" height="90" rx="15" fill="#f0e68c"/><circle cx="50" cy="50" r="35" fill="#005a9e" stroke="#333" stroke-width="5"/></svg>'),
            iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15]
        }),
        sentido: L.icon({
            iconUrl: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="40" height="40"><path d="M50 0 L100 50 L75 50 L75 100 L25 100 L25 50 L0 50 Z" fill="#005a9e" stroke="white" stroke-width="5"/></svg>'),
            iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20]
        })
    };

    // --- 2. FUNCIONES PRINCIPALES ---

    function initMap() {
        const initialCoords = [-2.170997, -79.900528];
        const initialZoom = 18;

        const streetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 22,
            maxNativeZoom: 19
        });

        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 22,
            maxNativeZoom: 20
        });

        map = L.map('map', { layers: [streetMap] }).setView(initialCoords, initialZoom);
        
        const baseMaps = { "Calles": streetMap, "Satélite": satelliteMap };
        L.control.layers(baseMaps).addTo(map);

        updateMapInfo();
        map.on('moveend zoomend', updateMapInfo);
    }
    
    function updateMapInfo() {
        designData.mapInfo = { lat: map.getCenter().lat, lng: map.getCenter().lng, zoom: map.getZoom() };
    }

    function addElement(type, latlng, loadedElement = null) {
        const id = loadedElement ? loadedElement.id : `${type}_${elementCounter++}`;
        const initialRotation = loadedElement ? loadedElement.rotation : 0;
        let icon = icons[type] || icons.vehicular;

        const marker = L.marker(latlng, { 
            icon: icon,
            draggable: true,
            rotationAngle: initialRotation
        }).addTo(map);

        marker.on('dragend', (event) => {
            updateElementPosition(id, event.target.getLatLng());
            setTimeout(() => map.invalidateSize(), 100); 
        });
        
        markers[id] = marker;
        if (!loadedElement) {
            designData.elements.push({
                id: id, type: type, lat: latlng.lat, lng: latlng.lng, rotation: 0
            });
        }
        
        // --- CORRECCIÓN DE EVENTOS DEL POPUP ---
        // Se genera el contenido del popup dinámicamente cada vez que se abre.
        marker.bindPopup(() => {
            const elementData = designData.elements.find(el => el.id === id);
            return createPopupContent(id, type, elementData.rotation);
        });

        // Se añaden los listeners DESPUÉS de que el popup se haya abierto y su contenido exista en el DOM.
        marker.on('popupopen', () => {
            const popupNode = marker.getPopup().getElement();
            if (!popupNode) return;

            const rotationSlider = popupNode.querySelector(`#rot-${id}`);
            const deleteButton = popupNode.querySelector(`#del-${id}`);

            if (rotationSlider) {
                rotationSlider.addEventListener('input', (e) => {
                    updateElementRotation(id, e.target.value);
                });
            }
            if (deleteButton) {
                deleteButton.addEventListener('click', () => {
                    removeElement(id);
                });
            }
        });

        marker.on('popupclose', () => {
            setTimeout(() => map.invalidateSize(), 100);
        });
    }

    // Se modifica el contenido para añadir un ID único al botón de eliminar.
    function createPopupContent(id, type, currentRotation) {
        return `
            <b>ID:</b> ${id}<br>
            <b>Tipo:</b> ${type}
            <div class="rotation-control">
                <label for="rot-${id}">Rotación: <span id="val-${id}">${currentRotation}°</span></label>
                <input type="range" id="rot-${id}" min="0" max="359" value="${currentRotation}">
            </div>
            <button class="popup-delete-btn" id="del-${id}">Eliminar</button>
        `;
    }

    function updateElementRotation(id, angle) {
        const marker = markers[id];
        const element = designData.elements.find(el => el.id === id);
        
        if (marker && element) {
            marker.setRotationAngle(angle);
            element.rotation = parseInt(angle, 10);
            
            const valueLabel = document.getElementById(`val-${id}`);
            if (valueLabel) {
                valueLabel.textContent = `${angle}°`;
            }
        }
    }

    function updateElementPosition(id, newLatLng) {
        const element = designData.elements.find(el => el.id === id);
        if (element) {
            element.lat = newLatLng.lat;
            element.lng = newLatLng.lng;
        }
    }

    function removeElement(id) {
        if (markers[id]) {
            map.closePopup(); // Cierra el popup antes de eliminar
            map.removeLayer(markers[id]);
            delete markers[id];
            designData.elements = designData.elements.filter(el => el.id !== id);
            setTimeout(() => map.invalidateSize(), 100);
        }
    }

    function clearMap() {
        for (const id in markers) {
            map.removeLayer(markers[id]);
        }
        markers = {};
        designData.elements = [];
        elementCounter = 0;
    }

    function renderDesign(data) {
        clearMap();
        designData = data;
        map.setView([data.mapInfo.lat, data.mapInfo.lng], data.mapInfo.zoom);
        
        let maxId = -1;
        data.elements.forEach(element => {
            const latlng = L.latLng(element.lat, element.lng);
            addElement(element.type, latlng, element);
            
            const idNum = parseInt(element.id.split('_').pop());
            if (!isNaN(idNum) && idNum > maxId) {
                maxId = idNum;
            }
        });
        elementCounter = maxId + 1;

        setTimeout(() => map.invalidateSize(), 100);
    }

    // --- 3. EVENT LISTENERS PARA LOS BOTONES ---

    document.getElementById('add-vehicle-light').addEventListener('click', () => addElement('vehicular', map.getCenter()));
    document.getElementById('add-pedestrian-light').addEventListener('click', () => addElement('peatonal', map.getCenter()));
    document.getElementById('add-pedestrian-button').addEventListener('click', () => addElement('boton', map.getCenter()));
    document.getElementById('add-street-direction').addEventListener('click', () => addElement('sentido', map.getCenter()));

    document.getElementById('save-design').addEventListener('click', () => {
        const dataStr = JSON.stringify(designData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.download = 'diseno_interseccion_v2.json';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    });

    const fileInput = document.getElementById('file-input');
    document.getElementById('load-design').addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedData = JSON.parse(e.target.result);
                if (loadedData.mapInfo && Array.isArray(loadedData.elements)) {
                    renderDesign(loadedData);
                } else {
                    alert('Error: El archivo JSON no tiene el formato esperado.');
                }
            } catch (error) {
                alert('Error: El archivo seleccionado no es un JSON válido.');
                console.error("Error al parsear el JSON:", error);
            }
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    // --- 4. INICIALIZACIÓN ---
    initMap();
});
