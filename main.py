import webview
import http.server
import socketserver
import threading
import time 
import json
from urllib.parse import urlencode
from communicator import Communicator

# --- CORRECCIÓN AQUÍ ---
import serial.tools.list_ports # Importación necesaria

PORT = 8000
window = None

# El Handler para el servidor no cambia
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

    # Funciones de conexión y desconexión no cambian
    def connect(self, port, baudrate):
        return self._communicator.connect(port, baudrate)

    def disconnect(self):
        return self._communicator.disconnect()

    def get_connection_status(self):
        return {'is_connected': self._communicator.is_connected}
        
    def get_com_ports(self):
        # Esta función ahora funcionará correctamente
        return [port.device for port in serial.tools.list_ports.comports()]

    # La lógica para navegar y cargar la app se mantiene
    def go_to_app_and_load_data(self):
        if not window:
            return

        app_url = f'http://localhost:{PORT}/web/html/app.html'
        window.load_url(app_url)
        time.sleep(1) 

        print("API: Obteniendo datos para el dashboard...")
        id_response = self._communicator.send_command(0x11)
        time_response = self._communicator.send_command(0x21)
        
        controller_id = "N/A"
        if id_response.get('status') == 'success':
            try: controller_id = id_response.get('data').split(':')[1].strip()
            except: controller_id = "Formato inválido"
        
        date_str, time_str = "N/A", "N/A"
        if time_response.get('status') == 'success':
            try:
                parts = time_response.get('data').split(' - ')
                time_str = parts[0].replace('Hora: ', '').strip()
                date_str = parts[1].split('(')[0].replace('Fecha: ', '').strip()
            except: date_str, time_str = "Formato inválido", "Formato inválido"

        data_to_push = {
            'controller_id': controller_id,
            'date': date_str,
            'time': time_str
        }

        js_code = f"populateDashboard({json.dumps(data_to_push)})"
        window.evaluate_js(js_code)

    def go_to_welcome(self):
        if window:
            welcome_url = f'http://localhost:{PORT}/web/html/welcome.html'
            window.load_url(welcome_url)

# El resto del archivo no necesita cambios
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