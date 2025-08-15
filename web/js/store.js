// web/js/store.js

let projectData = {};

export function getProjectData() {
    return projectData;
}

export function setProjectData(newData) {
    projectData = newData;

    // --- LÓGICA DE INICIALIZACIÓN MODIFICADA ---
    // Si los datos cargados no tienen la sección de configuración del software, la creamos.
    if (!projectData.software_config) {
        projectData.software_config = {};
    }
    
    // Si no existe la configuración de la intersección dentro de la config del software, la creamos.
    if (!projectData.software_config.intersection) {
        // Usamos la info del hardware si existe
        const controller_id = projectData.hardware_config?.info?.controller_id || 'Sin Asignar';
        
        projectData.software_config.intersection = {
            properties: {
                controller_id: controller_id,
                name: 'Nueva Intersección',
                // Coordenadas por defecto (Guayaquil)
                coordinates: { lat: -2.170, lng: -79.900 } 
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
    
    console.log("Datos del proyecto actualizados:", projectData);
}


export function isConnected() {
    return projectData.is_connected || false;
}
