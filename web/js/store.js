// web/js/store.js

let projectData = {};

export function getProjectData() {
    return projectData;
}

export function setProjectData(newData) {
    // Asignamos los nuevos datos directamente.
    projectData = newData;

    // --- LÓGICA DE INICIALIZACIÓN A PRUEBA DE FALLOS ---
    // Nos aseguramos de que toda la estructura exista, rellenando lo que falte.

    if (!projectData.hardware_config) {
        projectData.hardware_config = {};
    }
    // Verificamos cada propiedad que debe ser un array
    const hardwareArrays = ['movements', 'sequences', 'plans', 'intermittences', 'holidays', 'flow_rules'];
    hardwareArrays.forEach(key => {
        if (!Array.isArray(projectData.hardware_config[key])) {
            projectData.hardware_config[key] = [];
        }
    });
    if (!projectData.hardware_config.info) {
        projectData.hardware_config.info = {};
    }


    if (!projectData.software_config) {
        projectData.software_config = {};
    }
    
    if (!projectData.software_config.intersection) {
        const controller_id = projectData.hardware_config.info?.controller_id || 'Sin Asignar';
        
        projectData.software_config.intersection = {
            properties: {
                controller_id: controller_id,
                name: 'Nueva Intersección',
                coordinates: { lat: -2.170, lng: -79.900 } 
            },
            map_view: {
                lat: -2.170,
                lng: -79.900,
                zoom: 18
            },
            elements: [],
            conflict_matrix: Array(8).fill(null).map(() => Array(8).fill(false))
        };
    }
    
    console.log("Datos del proyecto actualizados y validados:", projectData);
}


export function isConnected() {
    return projectData.is_connected || false;
}
