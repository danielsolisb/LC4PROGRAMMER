# controller.py

import re
from communicator import Communicator

# --- Constantes para los límites del firmware ---
# Esto hace que el código sea más fácil de mantener.
MAX_MOVEMENTS = 60
MAX_SEQUENCES = 8
MAX_PLANS = 20
MAX_INTERMITENCES = 10
MAX_HOLIDAYS = 20

class Controller:
    """
    Orquesta la lógica de negocio y la comunicación con el dispositivo LC4.
    Ahora también mantiene un estado interno de la configuración capturada.
    """
    def __init__(self, communicator: Communicator):
        self._comm = communicator
        # Variable para almacenar la configuración completa del controlador
        self.project_data = {}

    def _parse_id_response(self, response: dict) -> str:
        if response.get('status') == 'success' and response.get('data'):
            try: return response.get('data').split(':')[1].strip()
            except (IndexError, AttributeError): return "Formato Inválido"
        return "N/A"

    def _parse_time_response(self, response: dict) -> tuple[str, str]:
        if response.get('status') == 'success' and response.get('data'):
            try:
                parts = response.get('data').split(' - ')
                time_str = parts[0].replace('Hora: ', '').strip()
                date_str = parts[1].split('(')[0].replace('Fecha: ', '').strip()
                return date_str, time_str
            except (IndexError, AttributeError): return "Formato Inválido", "Formato Inválido"
        return "N/A", "N/A"

    def _parse_movement_response(self, response_text: str) -> dict | None:
        """Parsea la respuesta del comando de leer movimiento."""
        if "no existe" in response_text:
            return None
        # Usamos expresiones regulares para una extracción robusta
        match = re.search(r"Movimiento\[(\d+)]: D:(\w+) E:(\w+) F:(\w+) H:(\w+) J:(\w+) T:\[([\w\s]+)\]", response_text)
        if match:
            times_str = match.group(7).split()
            return {
                'id': int(match.group(1)),
                'portD': match.group(2), 'portE': match.group(3), 'portF': match.group(4),
                'portH': match.group(5), 'portJ': match.group(6),
                'times': [int(t, 16) for t in times_str] # Los tiempos vienen en Hex
            }
        return None

    def _fetch_all_movements(self) -> list:
        """Lee todos los movimientos del controlador."""
        print("CONTROLLER: Capturando movimientos...")
        movements = []
        for i in range(MAX_MOVEMENTS):
            # Payload es el índice del movimiento a leer, convertido a bytes
            payload = bytes([i])
            response = self._comm.send_command(0x24, data_payload=payload) # CMD Leer Movimiento
            if response.get('status') == 'success' and response.get('data'):
                parsed_mov = self._parse_movement_response(response['data'])
                if parsed_mov:
                    movements.append(parsed_mov)
        print(f"CONTROLLER: Capturados {len(movements)} movimientos.")
        return movements
    
    def capture_full_configuration(self):
        """
        Orquesta la captura de TODA la configuración del controlador
        y la almacena en self.project_data.
        """
        print("CONTROLLER: Iniciando captura de configuración completa...")
        # Llama a todos los métodos de captura
        self.project_data['movements'] = self._fetch_all_movements()
        # self.project_data['sequences'] = self._fetch_all_sequences()
        # self.project_data['plans'] = self._fetch_all_plans()
        # ...etc.

        print("CONTROLLER: Captura completa finalizada.")
        # Opcional: Imprimir los datos capturados para depuración
        # import json
        # print(json.dumps(self.project_data, indent=2))

    def get_dashboard_data(self) -> dict:
        """
        Obtiene los datos básicos para el dashboard.
        Esta función se mantiene para la carga inicial de la UI.
        """
        print("CONTROLLER: Obteniendo datos para el dashboard...")
        id_response = self._comm.send_command(0x11)
        time_response = self._comm.send_command(0x21)
        
        controller_id = self._parse_id_response(id_response)
        date_str, time_str = self._parse_time_response(time_response)

        return {
            'controller_id': controller_id,
            'date': date_str,
            'time': time_str
        }
        
    # --- FUTURAS FUNCIONES (EJEMPLO DE ESCALABILIDAD) ---
    def get_all_sequences(self):
        """
        Captura todas las secuencias del controlador.
        (A ser implementado)
        """
        print("CONTROLLER: Solicitando todas las secuencias...")
        # Lógica futura: bucle llamando a send_command con CMD 0x31 para cada slot
        # y procesando la respuesta.
        return [{'id': 0, 'type': 'Ejemplo', 'movements': '0 -> 1'}]

    def save_sequence(self, sequence_data: dict):
        """
        Guarda una secuencia en el controlador.
        (A ser implementado)
        """
        print(f"CONTROLLER: Guardando secuencia {sequence_data['id']}...")
        # Lógica futura: construir el payload y llamar a send_command con CMD 0x30
        return {'status': 'success'}
