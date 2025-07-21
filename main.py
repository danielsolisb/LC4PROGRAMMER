import webview
import http.server
import socketserver
import threading
import serial.tools.list_ports
import json
from communicator import Communicator # Importamos nuestra nueva clase

PORT = 8000

class Api:
    def __init__(self):
        self._communicator = Communicator() # Instancia única y privada

    def connect(self, port, baudrate):
        """Intenta conectar usando el communicator."""
        print(f"API: Intentando conectar a {port}...")
        return self._communicator.connect(port, baudrate)

    def disconnect(self):
        """Desconecta usando el communicator."""
        print("API: Desconectando...")
        return self._communicator.disconnect()

    def get_connection_status(self):
        """Devuelve el estado de la conexión al frontend."""
        return {'is_connected': self._communicator.is_connected}

    def capture_id(self):
        """
        Envía el comando para leer el ID usando la conexión existente.
        """
        print("API: Solicitando ID del controlador...")
        response = self._communicator.send_command(0x11)
        print(f"API: Respuesta de captura: {response}")
        return response

    def get_com_ports(self):
        return [port.device for port in serial.tools.list_ports.comports()]

    # Las funciones navigate, save_settings, etc. ya no son necesarias aquí
    # porque la lógica se manejará desde el frontend.

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
    window = webview.create_window('Cormar - Controlador Semafórico', start_url, js_api=api, width=880, height=620, resizable=True)
    webview.start(debug=True) # Activamos debug para facilitar las pruebas
