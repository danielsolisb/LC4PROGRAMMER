// web/js/ui.js

/**
 * Actualiza el indicador de estado de conexión en la barra lateral.
 * @param {boolean} isConnected - Si está o no conectado.
 */
export function updateAppConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('app-status-indicator');
    if (!statusIndicator) return;
    statusIndicator.textContent = isConnected ? 'Conectado' : 'Desconectado';
    statusIndicator.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
    statusIndicator.style.backgroundColor = isConnected ? '#2ecc71' : '#e74c3c';
}

/**
 * Muestra u oculta el modal de carga.
 * @param {boolean} show - True para mostrar, false para ocultar.
 */
export function showLoadingModal(show) {
    const modal = document.getElementById('loading-modal');
    if (modal) {
        modal.classList.toggle('visible', show);
    }
}