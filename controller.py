from communicator import Communicator
import re

class Controller:
    def __init__(self):
        self.comm = Communicator()
        self.captured_data = {
            'controller_id': None,
            'date': None,
            'time': None
        }

    def connect_and_capture_id(self, port, baudrate):
        """Intenta conectar y capturar el ID del controlador."""
        conn_result = self.comm.connect(port, baudrate)
        if conn_result['status'] == 'error':
            return conn_result # Devuelve el diccionario de error

        # Comando para leer ID (0x11), como en tu app_controller.py
        response = self.comm.send_command(0x11)
        
        self.comm.disconnect() # Cerramos la conexión después de la consulta

        if response['status'] == 'success' and response['type'] == 'text':
            # Buscamos el ID en la respuesta de texto
            match = re.search(r"ID\s*=\s*(\d+)", response['data'])
            if match:
                controller_id = match.group(1)
                self.captured_data['controller_id'] = controller_id
                return {'status': 'success', 'data': self.captured_data}
            else:
                return {'status': 'error', 'message': 'No se encontró el ID en la respuesta.'}
        
        return response # Devuelve el resultado si no fue texto o hubo otro error
