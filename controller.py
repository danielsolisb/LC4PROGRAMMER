# controller.py

import re
import json
from communicator import Communicator

# --- Constantes actualizadas ---
MAX_MOVEMENTS = 60
MAX_SEQUENCES = 8
MAX_PLANS = 20
MAX_INTERMITENCES = 10
MAX_HOLIDAYS = 20
# Nueva constante extraída del firmware
MAX_FLOW_CONTROL_RULES = 10


class Controller:
    def __init__(self, communicator: Communicator):
        self._comm = communicator
        # El diccionario del proyecto ahora se inicializa con todas las claves posibles
        self.project_data = {
            'info': {},
            'movements': [],
            'sequences': [],
            'plans': [],
            'intermittences': [],
            'holidays': [],
            'flow_rules': []
        }

    # --- Métodos de Parseo (Existentes y Nuevos) ---

    def _parse_id_response(self, response: dict) -> str:
        if response.get('status') == 'success' and response.get('data'):
            try:
                return response.get('data').split(':')[1].strip()
            except (IndexError, AttributeError):
                return "Formato Inválido"
        return "N/A"

    def _parse_time_response(self, response: dict) -> tuple[str, str]:
        if response.get('status') == 'success' and response.get('data'):
            try:
                parts = response.get('data').split(' - ')
                time_str = parts[0].replace('Hora: ', '').strip()
                date_str = parts[1].split('(')[0].replace('Fecha: ', '').strip()
                return date_str, time_str
            except (IndexError, AttributeError):
                return "Formato Inválido", "Formato Inválido"
        return "N/A", "N/A"

    def _parse_movement_response(self, response_text: str) -> dict | None:
        if "no existe" in response_text: return None
        match = re.search(r"Movimiento\[(\d+)]: D:(\w+) E:(\w+) F:(\w+) H:(\w+) J:(\w+) T:\[([\w\s]+)\]", response_text)
        if match:
            times_str = match.group(7).split()
            return {
                'id': int(match.group(1)), 'portD': match.group(2), 'portE': match.group(3),
                'portF': match.group(4), 'portH': match.group(5), 'portJ': match.group(6),
                'times': [int(t, 16) for t in times_str]
            }
        return None

    def _parse_sequence_response(self, response_text: str) -> dict | None:
        if "no existe" in response_text: return None
        match = re.search(r"Sec\[(\d+)]: TIPO:(\d+) ANCLA_POS:(\d+) MOV:([\d\s]*)", response_text)
        if match:
            mov_indices_str = match.group(4).strip()
            mov_indices = [int(i) for i in mov_indices_str.split()] if mov_indices_str else []
            return {
                'id': int(match.group(1)), 'type': int(match.group(2)),
                'anchor_pos': int(match.group(3)), 'movements': mov_indices
            }
        return None

    def _parse_plan_response(self, response_text: str) -> dict | None:
        # El firmware devuelve 255 para slots vacíos, los filtramos aquí.
        if "no existe" in response_text or "TipoDia:255" in response_text: return None
        match = re.search(r"Plan\[(\d+)]: TipoDia:(\d+), Sec:(\d+), Tsel:(\d+), Hora:(\d+), Min:(\d+)", response_text)
        if match:
            return {
                'id': int(match.group(1)), 'day_type_id': int(match.group(2)),
                'sequence_id': int(match.group(3)), 'time_sel': int(match.group(4)),
                'hour': int(match.group(5)), 'minute': int(match.group(6))
            }
        return None

    # --- INICIO DE NUEVOS MÉTODOS DE PARSEO ---

    def _parse_intermittence_response(self, response_text: str) -> dict | None:
        if "no existe" in response_text: return None
        match = re.search(r"Intermitencia\[(\d+)]: PlanID:(\d+) MovID:(\d+) MaskD:0x(\w+) MaskE:0x(\w+) MaskF:0x(\w+)", response_text)
        if match:
            return {
                'id': int(match.group(1)), 'plan_id': int(match.group(2)),
                'movement_id': int(match.group(3)), 'maskD': match.group(4),
                'maskE': match.group(5), 'maskF': match.group(6)
            }
        return None

    def _parse_flow_rule_response(self, response_text: str) -> dict | None:
        if "no existe" in response_text: return None
        match = re.search(r"Regla\[(\d+)]: Sec:(\d+) MovOrig:(\d+) Tipo:(\d+) Mascara:0x(\w+) MovDest:(\d+)", response_text)
        if match:
            return {
                'id': int(match.group(1)), 'sequence_id': int(match.group(2)),
                'origin_mov_id': int(match.group(3)), 'rule_type': int(match.group(4)),
                'demand_mask': match.group(5), 'destination_mov_id': int(match.group(6))
            }
        return None
        
    def _parse_all_holidays_response(self, response_text: str) -> list:
        """Parsea la respuesta multilínea del comando de leer feriados."""
        holidays = []
        # Buscamos todas las coincidencias de la línea de un feriado
        matches = re.finditer(r"Slot\[(\d+)]: (\d+)/(\d+)", response_text)
        for match in matches:
            holidays.append({
                'id': int(match.group(1)),
                'day': int(match.group(2)),
                'month': int(match.group(3))
            })
        return holidays

    # --- FIN DE NUEVOS MÉTODOS DE PARSEO ---

    def _fetch_all_items(self, item_name: str, max_items: int, read_cmd: int, parser_func) -> list:
        """Función genérica para leer una lista de items uno por uno."""
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
        
    # --- NUEVA FUNCIÓN DE CAPTURA PARA FERIADOS ---
    def _fetch_all_holidays(self) -> list:
        """Función específica para capturar todos los feriados con un solo comando."""
        print("CONTROLLER: Capturando feriados...")
        # El comando 0x61 no necesita payload
        response = self._comm.send_command(0x61)
        items = []
        if response.get('status') == 'success' and response.get('data'):
            items = self._parse_all_holidays_response(response['data'])
        print(f"CONTROLLER: Capturados {len(items)} feriados.")
        return items

    # --- MÉTODO DE CAPTURA PRINCIPAL ACTUALIZADO ---
    def capture_full_configuration(self):
        """
        Orquesta la captura de TODA la configuración del controlador
        y la almacena en self.project_data.
        """
        print("CONTROLLER: Iniciando captura de configuración completa...")
        # Información básica
        id_response = self._comm.send_command(0x11)
        time_response = self._comm.send_command(0x21)
        controller_id = self._parse_id_response(id_response)
        date_str, time_str = self._parse_time_response(time_response)

        # Captura de todas las tablas de datos
        movements = self._fetch_all_items("movimientos", MAX_MOVEMENTS, 0x24, self._parse_movement_response)
        sequences = self._fetch_all_items("secuencias", MAX_SEQUENCES, 0x31, self._parse_sequence_response)
        plans = self._fetch_all_items("planes", MAX_PLANS, 0x41, self._parse_plan_response)
        
        # --- NUEVAS LLAMADAS ---
        intermittences = self._fetch_all_items("intermitencias", MAX_INTERMITENCES, 0x51, self._parse_intermittence_response)
        holidays = self._fetch_all_holidays()
        flow_rules = self._fetch_all_items("reglas de flujo", MAX_FLOW_CONTROL_RULES, 0x71, self._parse_flow_rule_response)
        
        # Almacenamiento en el diccionario del proyecto
        self.project_data = {
            'info': {'controller_id': controller_id, 'date': date_str, 'time': time_str},
            'movements': movements,
            'sequences': sequences,
            'plans': plans,
            'intermittences': intermittences,
            'holidays': holidays,
            'flow_rules': flow_rules
        }
        print("CONTROLLER: Captura completa finalizada.")
        # Para depuración, puedes imprimir el resultado completo
        # print(json.dumps(self.project_data, indent=2))

    def get_dashboard_data(self) -> dict:
        """Devuelve la información del dashboard desde el proyecto ya capturado."""
        info = self.project_data.get('info', {})
        return {
            'controller_id': info.get('controller_id', 'N/A'),
            'date': info.get('date', 'N/A'),
            'time': info.get('time', 'N/A')
        }

    def save_project_to_file(self, filepath: str) -> dict:
        """Guarda el diccionario completo del proyecto en un archivo JSON."""
        print(f"CONTROLLER: Guardando proyecto en {filepath}")
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(self.project_data, f, indent=2, ensure_ascii=False)
            return {'status': 'success', 'message': f'Proyecto guardado en {filepath}'}
        except Exception as e:
            print(f"CONTROLLER: Error al guardar archivo: {e}")
            return {'status': 'error', 'message': str(e)}

