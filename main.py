import webview
import http.server
import socketserver
import threading
import serial.tools.list_ports
from controller import Controller
import json

PORT = 8000

class Api:
    def __init__(self):
        self.com_port = None
        self.baud_rate = 9600
        # --- CORRECCIÓN AQUÍ: Hacemos el controlador "privado" ---
        # El guion bajo evita que pywebview lo inspeccione y cause errores.
        self._controller = Controller()

    def open_file_dialog(self):
        window = webview.windows[0]
        result = window.create_file_dialog(webview.OPEN_DIALOG)
        if result: print(f"Archivo seleccionado: {result[0]}")
        else: print("Ningún archivo seleccionado.")
        return result

    def navigate(self, screen, mode=''):
        print(f"Botón presionado: '{screen}' con modo '{mode}'")
        if screen == 'open':
            self.open_file_dialog()
            return None
        elif screen in ('new', 'capture'):
            if mode == 'capture':
                if not self.com_port:
                    message = "Error: Por favor, configure un puerto COM en Opciones primero."
                    webview.windows[0].evaluate_js(f'alert({json.dumps(message)})')
                    return None
                
                result = self._controller.connect_and_capture_id(self.com_port, self.baud_rate)
                
                if result['status'] == 'error':
                    message = f"Error de Captura: {result['message']}"
                    webview.windows[0].evaluate_js(f'alert({json.dumps(message)})')
                    return None
            
            return f'http://localhost:{PORT}/web/html/app.html?mode={mode}'
        return None

    # --- FUNCIÓN DE REGRESO RESTAURADA ---
    def go_to_welcome(self):
        """Devuelve la URL de la pantalla de bienvenida."""
        return f'http://localhost:{PORT}/web/html/welcome.html'

    def get_com_ports(self):
        return [port.device for port in serial.tools.list_ports.comports()]

    def save_serial_settings(self, port, baudrate):
        self.com_port = port
        self.baud_rate = baudrate
        print(f"--- Configuración Serie Guardada ---\n  Puerto: {self.com_port}\n  Velocidad: {self.baud_rate} baud\n---------------------------------")
    
    def save_ip_settings(self, ip, port):
        print(f"--- Configuración de Red Guardada ---\n  Dirección IP: {ip}\n  Puerto de Red: {port}\n----------------------------------")

    def get_dashboard_data(self):
        return self._controller.captured_data

def start_server():
    Handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(("", PORT), Handler)
    print(f"Iniciando servidor local en http://localhost:{PORT}")
    httpd.serve_forever()

if __name__ == '__main__':
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    api = Api()
    start_url = f'http://localhost:{PORT}/web/html/welcome.html'
    window = webview.create_window('Cormar - Controlador Semafórico', start_url, js_api=api, width=1024, height=768, resizable=True)
    webview.start(debug=False)
