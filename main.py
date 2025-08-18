# main.py

import json
import webview
import http.server
import socketserver
import threading
import serial.tools.list_ports
import queue 
import time

from communicator import Communicator
from controller import Controller

PORT = 8000
ui_queue = queue.Queue()
window = None

# Creamos una cola dedicada para los reportes de monitoreo
monitoring_queue = queue.Queue()
# Una bandera para controlar el hilo de lectura
monitoring_active = threading.Event()

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

class Api:
    def __init__(self):
        self._communicator = Communicator()
        self._controller = Controller(self._communicator)
        self._monitoring_thread = None

    def start_monitoring(self):
        """Activa el modo monitoreo en el controlador y en el backend."""
        print("API: Iniciando modo monitoreo...")
        if not self._communicator.is_connected:
            return {'status': 'error', 'message': 'Debe estar conectado para monitorear.'}

        # Enviamos el comando para habilitar el monitoreo en el firmware
        self._communicator.send_command(0x80)
        
        # Iniciamos el hilo lector si no está ya corriendo
        if self._monitoring_thread is None or not self._monitoring_thread.is_alive():
            monitoring_active.set() # Activamos la bandera
            self._monitoring_thread = threading.Thread(
                target=self._background_monitoring_reader,
                args=(self._communicator.ser,) # Pasamos el objeto serial
            )
            self._monitoring_thread.start()
        return {'status': 'success'}
    
    def stop_monitoring(self):
        """Desactiva el modo monitoreo."""
        print("API: Deteniendo modo monitoreo...")
        monitoring_active.clear() # Desactivamos la bandera para detener el hilo
        
        # Esperamos un poco a que el hilo termine
        if self._monitoring_thread and self._monitoring_thread.is_alive():
            self._monitoring_thread.join(timeout=0.5)

        # Enviamos el comando para deshabilitar el monitoreo en el firmware
        if self._communicator.is_connected:
            self._communicator.send_command(0x81)
        return {'status': 'success'}
    
    def _background_monitoring_reader(self, ser_instance):
        """
        Corre en un hilo, lee continuamente el puerto serial buscando
        tramas de monitoreo (CMD 0x82) y las pone en la cola.
        """
        while monitoring_active.is_set():
            try:
                # Buscamos el inicio de una trama
                if ser_instance.read(1) == b'\x43':
                    if ser_instance.read(2) == b'\x53\x4F': # STX encontrado
                        cmd = ser_instance.read(1)
                        if cmd == b'\x82': # Es un reporte de monitoreo
                            length_byte = ser_instance.read(1)
                            length = int.from_bytes(length_byte, 'big')
                            payload = ser_instance.read(length)
                            # Leemos checksum y ETX para limpiar el buffer
                            ser_instance.read(3) 
                            
                            # Parseamos el payload y lo ponemos en la cola
                            parsed_data = self._controller.parse_monitoring_report(payload)
                            if parsed_data:
                                monitoring_queue.put(json.dumps(parsed_data))
            except (serial.SerialException, TypeError):
                print("Error en el hilo de monitoreo, cerrando.")
                monitoring_active.clear()
            time.sleep(0.01) # Pequeña pausa para no saturar la CPU

    def check_monitoring_update(self):
        """Permite al frontend preguntar si hay un nuevo reporte en la cola."""
        try:
            return monitoring_queue.get_nowait()
        except queue.Empty:
            return None

    def new_project(self):
        if not window: return
        self._controller.reset_project_data()
        app_url = f'http://localhost:{PORT}/web/html/app.html?action=new'
        window.load_url(app_url)

    def open_project_file(self):
        if not window: return
        filepaths = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=False,
            file_types=("Archivos de Proyecto LC4 (*.lc4)",)
        )
        if filepaths:
            result = self._controller.load_project_from_file(filepaths[0])
            if result['status'] == 'success':
                app_url = f'http://localhost:{PORT}/web/html/app.html?action=load'
                window.load_url(app_url)
            else:
                window.create_alert('Error al Abrir Archivo', result['message'])
    
    def get_project_data_from_memory(self):
        self._controller.project_data['is_connected'] = self._communicator.is_connected
        return self._controller.project_data
    
    def update_project_data(self, project_json):
        """Reemplaza los datos del proyecto en memoria."""
        self._controller.project_data = json.loads(project_json)
    def check_capture_result(self):
        """
        Permite al frontend preguntar si hay un resultado en la cola.
        Es una operación segura y no bloqueante.
        """
        try:
            # Intenta obtener un item de la cola SIN esperar.
            result = ui_queue.get_nowait()
            print("API: Resultado de captura entregado al frontend.")
            return result
        except queue.Empty:
            # Si la cola está vacía, simplemente devuelve None.
            return None

    def perform_full_capture(self):
        """
        Esta función no cambia. Su único trabajo es lanzar la captura en un hilo.
        """
        if not window: return
        capture_thread = threading.Thread(target=self._background_capture_task)
        capture_thread.start()

    def _background_capture_task(self):
        """
        Esta función ahora es más simple: hace el trabajo y deja el resultado en la cola.
        Ya no se comunica directamente con la GUI.
        """
        print("API (Thread): Realizando captura de configuración completa...")
        self._controller.capture_full_configuration()

        full_project_data = self._controller.project_data
        full_project_data['is_connected'] = self._communicator.is_connected

        json_data = json.dumps(full_project_data)
        
        # En lugar de llamar a evaluate_js, ponemos el resultado en nuestro "buzón"
        ui_queue.put(json_data)
        print("API (Thread): Datos de captura puestos en la cola para la UI.")

    # --- El resto de las funciones de la clase Api no necesitan cambios ---
    def request_capture_and_navigate(self):
        if not window: return
        print("API: Navegando a la aplicación para iniciar captura...")
        app_url = f'http://localhost:{PORT}/web/html/app.html?action=capture'
        window.load_url(app_url)

    def get_initial_ui_data(self):
        print("API: La UI solicitó los datos existentes en memoria.")
        # Esta función sigue siendo útil si en el futuro se carga un archivo
        # sin estar conectado a un controlador.
        dashboard_data = self._controller.get_dashboard_data()
        dashboard_data['is_connected'] = self._communicator.is_connected
        return dashboard_data

    def connect(self, port, baudrate):
        return self._communicator.connect(port, baudrate)

    def disconnect(self):
        return self._communicator.disconnect()

    def get_connection_status(self):
        return {'is_connected': self._communicator.is_connected}
        
    def get_com_ports(self):
        return [port.device for port in serial.tools.list_ports.comports()]

    def go_to_welcome(self):
        if window:
            welcome_url = f'http://localhost:{PORT}/web/html/welcome.html'
            window.load_url(welcome_url)

    def confirm_and_disconnect(self):
        if not window: return
        should_disconnect = window.create_confirmation_dialog('Confirmar Desconexión', '¿Estás seguro de que quieres desconectar y volver al inicio?')
        if should_disconnect:
            print("API: Usuario confirmó desconexión.")
            self.disconnect()
            self.go_to_welcome()

    def save_project_file(self):
        if not window: return
        try:
            filepath = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename="proyecto.lc4",
                file_types=("Archivos de Proyecto LC4 (*.lc4)", "Todos los archivos (*.*)")
            )
            if filepath:
                # La función de guardado en el controlador ya usa el objeto completo,
                # por lo que no necesita cambios.
                return self._controller.save_project_to_file(filepath)
            return {'status': 'info', 'message': 'Guardado cancelado por el usuario.'}
        except Exception as e:
            return {'status': 'error', 'message': f'Error interno: {e}'}


def start_server():
    httpd = socketserver.TCPServer(("", PORT), Handler)
    print(f"Iniciando servidor local en http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == '__main__':
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    api = Api()
    start_url = f'http://localhost:{PORT}/web/html/welcome.html'
    
    # El arranque se simplifica: ya no necesitamos el hilo listener.
    window = webview.create_window('Cormar - Controlador Semafórico', start_url, js_api=api, width=880, height=620, resizable=True)
    webview.start(debug=True)
