# main.py

import json
import webview
import http.server
import socketserver
import threading
import serial.tools.list_ports

from communicator import Communicator
from controller import Controller

PORT = 8000
window = None

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

    def new_project(self):
        """
        Prepara un nuevo proyecto vacío y navega a la pantalla de la app.
        """
        if not window: return
        print("API: Creando nuevo proyecto...")
        # Llama a la nueva función en el controlador para limpiar los datos
        self._controller.reset_project_data()
        # Navega a la app. El frontend se encargará de mostrar el estado vacío.
        app_url = f'http://localhost:{PORT}/web/html/app.html?action=new'
        window.load_url(app_url)

    def open_project_file(self):
        """
        Abre un diálogo para seleccionar un archivo .lc4, lo carga en memoria
        y luego navega a la pantalla de la aplicación.
        """
        if not window: return
        print("API: Abriendo diálogo para seleccionar archivo...")
        
        filepaths = window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Archivos de Proyecto LC4 (*.lc4)",)
        )

        if filepaths:
            filepath = filepaths[0]
            print(f"API: Archivo seleccionado: {filepath}. Cargando datos...")
            # Llama al controlador para que lea y cargue el archivo
            result = self._controller.load_project_from_file(filepath)

            if result['status'] == 'success':
                # Si la carga fue exitosa, navegamos a la app con una acción específica
                app_url = f'http://localhost:{PORT}/web/html/app.html?action=load'
                window.load_url(app_url)
            else:
                # Si hubo un error al cargar, se lo mostramos al usuario
                window.create_alert('Error al Abrir Archivo', result['message'])
        else:
            print("API: Selección de archivo cancelada.")
    
    def get_project_data_from_memory(self):
        """
        Devuelve el diccionario completo del proyecto que está actualmente en memoria.
        """
        print("API: El frontend solicitó los datos del proyecto en memoria.")
        # Añadimos el estado de conexión para que la UI siempre esté sincronizada
        self._controller.project_data['is_connected'] = self._communicator.is_connected
        return self._controller.project_data

    def perform_full_capture(self):
        """
        Realiza la captura completa y, al finalizar, "empuja" el objeto
        completo del proyecto (incluyendo el estado de conexión) al frontend.
        """
        if not window: return

        print("API: Realizando captura de configuración completa...")
        self._controller.capture_full_configuration()

        # Obtenemos el diccionario completo del proyecto desde el controlador
        full_project_data = self._controller.project_data
        
        # Añadimos el estado de la conexión a este diccionario
        full_project_data['is_connected'] = self._communicator.is_connected

        # Serializamos el objeto completo a JSON y lo enviamos al frontend
        json_data = json.dumps(full_project_data)
        print(f"API: Empujando datos COMPLETOS al frontend.")
        window.evaluate_js(f'onCaptureComplete({json_data})')

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


# El resto del archivo (start_server, if __name__ == '__main__') no necesita cambios.
def start_server():
    httpd = socketserver.TCPServer(("", PORT), Handler)
    print(f"Iniciando servidor local en http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == '__main__':
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    api = Api()
    start_url = f'http://localhost:{PORT}/web/html/welcome.html'
    
    window = webview.create_window('Cormar - Controlador Semafórico', start_url, js_api=api, width=880, height=620, resizable=True)
        
    webview.start(debug=True)
