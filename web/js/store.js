// web/js/store.js

let projectData = {};

export function getProjectData() {
    return projectData;
}

export function setProjectData(newData) {
    projectData = newData;
    console.log("Datos del proyecto actualizados:", projectData);
}

export function isConnected() {
    return projectData.is_connected || false;
}