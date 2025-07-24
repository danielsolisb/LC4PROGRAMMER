// web/js/store.js

let projectData = {};

export function getProjectData() {
    return projectData;
}

export function setProjectData(newData) {
    projectData = newData;

    // --- NUEVA LÓGICA DE INICIALIZACIÓN ---
    // Si los datos cargados no tienen una sección de intersección,
    // la creamos con valores por defecto.
    if (!projectData.intersection) {
        projectData.intersection = {
            properties: {
                controller_id: projectData.info?.controller_id || 'Sin Asignar',
                name: 'Nueva Intersección',
                coordinates: { lat: -2.170, lng: -79.900 } // Coordenadas por defecto (ej: Guayaquil)
            },
            map_view: {
                lat: -2.170,
                lng: -79.900,
                zoom: 18
            },
            elements: [], // Para los iconos del mapa
            // Matriz de 8x8 inicializada en false
            conflict_matrix: Array(8).fill(null).map(() => Array(8).fill(false))
        };
    }
    // --- FIN DE LA NUEVA LÓGICA ---

    console.log("Datos del proyecto actualizados:", projectData);
}

export function isConnected() {
    return projectData.is_connected || false;
}
