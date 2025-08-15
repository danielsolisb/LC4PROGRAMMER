// web/js/views/dashboard.js

import { getProjectData, isConnected } from '../store.js';
import { updateAppConnectionStatus } from '../ui.js';

/**
 * Inicializa y actualiza los campos de la vista del Dashboard.
 */
export function initializeDashboardView() {
    // MODIFICADO: Apuntar a la sub-estructura 'hardware_config'
    const projectData = getProjectData();
    const info = projectData.hardware_config?.info || {};
    
    document.getElementById('info-id').textContent = info.controller_id || '--';
    document.getElementById('info-date').textContent = info.date || '--';
    document.getElementById('info-time').textContent = info.time || '--';
    
    updateAppConnectionStatus(isConnected());
}