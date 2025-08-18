// web/js/api.js

export const api = {
    // Proyectos y Navegación
    newProject: () => window.pywebview.api.new_project(),
    openProjectFile: () => window.pywebview.api.open_project_file(),
    saveProjectFile: () => window.pywebview.api.save_project_file(),
    updateProjectData: (data) => window.pywebview.api.update_project_data(JSON.stringify(data)),
    goToWelcome: () => window.pywebview.api.go_to_welcome(),
    
    // Conexión
    connect: (port, baudrate) => window.pywebview.api.connect(port, baudrate),
    disconnect: () => window.pywebview.api.disconnect(),
    confirmAndDisconnect: () => window.pywebview.api.confirm_and_disconnect(),
    getConnectionStatus: () => window.pywebview.api.get_connection_status(),

    // Captura de Datos
    requestCaptureAndNavigate: () => window.pywebview.api.request_capture_and_navigate(),
    performFullCapture: () => window.pywebview.api.perform_full_capture(),
    checkCaptureResult: () => window.pywebview.api.check_capture_result(),
    getProjectDataFromMemory: () => window.pywebview.api.get_project_data_from_memory(),

    // Monitoreo
    startMonitoring: () => window.pywebview.api.start_monitoring(),
    stopMonitoring: () => window.pywebview.api.stop_monitoring(),
    checkMonitoringUpdate: () => window.pywebview.api.check_monitoring_update(),
};