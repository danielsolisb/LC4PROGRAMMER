import webview
import http.server
import socketserver
import threading
import time
import json
import serial.tools.list_ports
from urllib.parse import urlencode

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
        super().do_GET()

class Api:
    def __init__(self):
        self._communicator = Communicator()
        self._controller = Controller(self._communicator)

    def connect(self, port, baudrate):
        return self._communicator.connect(port, baudrate)

    def disconnect(self):
        return self._communicator.disconnect()

    def get_connection_status(self):
        return {'is_connected': self._communicator.is_connected}
        
    def get_com_ports(self):
        return [port.device for port in serial.tools.list_ports.comports()]

    def go_to_app_and_capture_data(self):
        if not window: return
        print("API: Capturando configuración completa en segundo plano...")
        self._controller.capture_full_configuration()
        print("API: Navegando a la aplicación...")
        app_url = f'http://localhost:{PORT}/web/html/app.html'
        window.load_url(app_url)

    def get_initial_ui_data(self):
        print("API: La UI de la app solicitó los datos iniciales.")
        dashboard_data = self._controller.get_dashboard_data()
        dashboard_data['is_connected'] = self._communicator.is_connected
        return dashboard_data

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
            # --- CORRECCIÓN AQUÍ ---
            # Se ha eliminado el argumento 'title' que no es soportado.
            filepath = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename="proyecto.lc4",
                file_types=("Archivos de Proyecto LC4 (*.lc4)", "Todos los archivos (*.*)")
            )

            if filepath:
                result = self._controller.save_project_to_file(filepath)
                return result
            
            return {'status': 'info', 'message': 'Guardado cancelado por el usuario.'}
        except Exception as e:
            # Capturamos cualquier otro error inesperado para depuración
            print(f"API: Error inesperado en save_project_file: {e}")
            return {'status': 'error', 'message': f'Error interno: {e}'}


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
