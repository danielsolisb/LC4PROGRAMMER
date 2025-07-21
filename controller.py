# controller.py

import re
import json
from communicator import Communicator

# --- Constantes (sin cambios) ---
MAX_MOVEMENTS = 60
MAX_SEQUENCES = 8
MAX_PLANS = 20
MAX_INTERMITENCES = 10
MAX_HOLIDAYS = 20

class Controller:
    def __init__(self, communicator: Communicator):
        self._comm = communicator
        self.project_data = {}

    # --- Métodos de Parseo (sin cambios) ---
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
        if "no existe" in response_text: return None
        match = re.search(r"Movimiento\[(\d+)]: D:(\w+) E:(\w+) F:(\w+) H:(\w+) J:(\w+) T:\[([\w\s]+)\]", response_text)
        if match:
            times_str = match.group(7).split()
            return {'id': int(match.group(1)), 'portD': match.group(2), 'portE': match.group(3),'portF': match.group(4), 'portH': match.group(5), 'portJ': match.group(6),'times': [int(t, 16) for t in times_str]}
        return None

    def _parse_sequence_response(self, response_text: str) -> dict | None:
        if "no existe" in response_text: return None
        match = re.search(r"Sec\[(\d+)]: TIPO:(\d+) ANCLA_POS:(\d+) MOV:([\d\s]*)", response_text)
        if match:
            mov_indices = [int(i) for i in match.group(4).split()]
            return {'id': int(match.group(1)), 'type': int(match.group(2)),'anchor_pos': int(match.group(3)), 'movements': mov_indices}
        return None

    def _parse_plan_response(self, response_text: str) -> dict | None:
        if "no existe" in response_text: return None
        match = re.search(r"Plan\[(\d+)]: TipoDia:(\d+), Sec:(\d+), Tsel:(\d+), Hora:(\d+), Min:(\d+)", response_text)
        if match:
            return {'id': int(match.group(1)), 'day_type_id': int(match.group(2)), 'sequence_id': int(match.group(3)),'time_sel': int(match.group(4)), 'hour': int(match.group(5)), 'minute': int(match.group(6))}
        return None

    def _fetch_all_items(self, item_name: str, max_items: int, read_cmd: int, parser_func) -> list:
        print(f"CONTROLLER: Capturando {item_name}...")
        items = []
        for i in range(max_items):
            payload = bytes([i])
            response = self._comm.send_command(read_cmd, data_payload=payload)
            if response.get('status') == 'success' and response.get('data'):
                parsed_item = parser_func(response['data'])
                if parsed_item:
                    items.append(parsed_item)
        print(f"CONTROLLER: Capturados {len(items)} {item_name}.")
        return items

    def capture_full_configuration(self):
        print("CONTROLLER: Iniciando captura de configuración completa...")
        id_response = self._comm.send_command(0x11)
        time_response = self._comm.send_command(0x21)
        controller_id = self._parse_id_response(id_response)
        date_str, time_str = self._parse_time_response(time_response)
        movements = self._fetch_all_items("movimientos", MAX_MOVEMENTS, 0x24, self._parse_movement_response)
        sequences = self._fetch_all_items("secuencias", MAX_SEQUENCES, 0x31, self._parse_sequence_response)
        plans = self._fetch_all_items("planes", MAX_PLANS, 0x41, self._parse_plan_response)
        
        # --- CORRECCIÓN AQUÍ ---
        # Usamos las claves 'date' y 'time' para ser consistentes.
        self.project_data = {
            'info': { 'controller_id': controller_id, 'date': date_str, 'time': time_str },
            'movements': movements,
            'sequences': sequences,
            'plans': plans
        }
        print("CONTROLLER: Captura completa finalizada.")

    def get_dashboard_data(self) -> dict:
        """Devuelve la información del dashboard desde el proyecto ya capturado."""
        info = self.project_data.get('info', {})
        return {
            'controller_id': info.get('controller_id', 'N/A'),
            'date': info.get('date', 'N/A'),
            'time': info.get('time', 'N/A')
        }
        
    def save_project_to_file(self, filepath: str) -> dict:
        print(f"CONTROLLER: Guardando proyecto en {filepath}")
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self.project_data, f, indent=2, ensure_ascii=False)
            return {'status': 'success', 'message': f'Proyecto guardado en {filepath}'}
        except Exception as e:
            print(f"CONTROLLER: Error al guardar archivo: {e}")
            return {'status': 'error', 'message': str(e)}
