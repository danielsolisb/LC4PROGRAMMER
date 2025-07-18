import webview
import http.server
import socketserver
import threading
import serial.tools.list_ports

PORT = 8000

class Api:
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
            return f'http://localhost:{PORT}/web/html/app.html?mode={mode}'
        return None

    # --- NUEVO MÉTODO PARA REGRESAR A LA PANTALLA DE BIENVENIDA ---
    def go_to_welcome(self):
        """Devuelve la URL de la pantalla de bienvenida."""
        return f'http://localhost:{PORT}/web/html/welcome.html'

    def get_com_ports(self):
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]

    def save_serial_settings(self, port, baudrate):
        print(f"--- Configuración Serie Guardada ---\n  Puerto: {port}\n  Velocidad: {baudrate} baud\n---------------------------------")
    
    def save_ip_settings(self, ip, port):
        print(f"--- Configuración de Red Guardada ---\n  Dirección IP: {ip}\n  Puerto de Red: {port}\n----------------------------------")

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
    
    window = webview.create_window(
        'Cormar - Controlador Semafórico',
        start_url,
        js_api=api,
        width=1024,
        height=768,
        resizable=True
    )
    
    webview.start(debug=False)
