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
            'hardware_config': {
                'info': {}, 'movements': [], 'sequences': [], 'plans': [],
                'intermittences': [], 'holidays': [], 'flow_rules': []
            },
            'software_config': {}
        }

    def parse_monitoring_report(self, payload: bytes) -> dict | None:
        """
        Parsea el payload de una trama de reporte de monitoreo (CMD 0x82).
        Payload: [ID_Controlador, PortD, PortE, PortF, Estado_Peatonal]
        """
        if len(payload) != 5:
            return None
        
        # Extraemos los valores de los puertos como cadenas hexadecimales
        port_d_hex = f"{payload[1]:02X}"
        port_e_hex = f"{payload[2]:02X}"
        port_f_hex = f"{payload[3]:02X}"
        
        # Devolvemos un diccionario con el mismo formato que un 'movimiento'
        # para poder reutilizar la lógica de visualización del frontend.
        return {
            'portD': port_d_hex,
            'portE': port_e_hex,
            'portF': port_f_hex,
            'portH': "00", # No vienen en el reporte, asumimos 0
            'portJ': "00"  # No vienen en el reporte, asumimos 0
        }
        
    def load_project_from_file(self, filepath: str) -> dict:
        """
        MODIFICADO: Lee un archivo .lc4 y maneja tanto el formato nuevo como el antiguo.
        """
        print(f"CONTROLLER: Cargando proyecto desde {filepath}")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # NUEVO: Lógica de compatibilidad hacia atrás
            if 'hardware_config' in data and 'software_config' in data:
                # Es el formato nuevo, lo cargamos directamente
                self.project_data = data
            else:
                # Es el formato antiguo, lo adaptamos a la nueva estructura
                print("Detectado formato de archivo antiguo. Adaptando a la nueva estructura.")
                self.project_data['hardware_config'] = {
                    'info': data.get('info', {}),
                    'movements': data.get('movements', []),
                    'sequences': data.get('sequences', []),
                    'plans': data.get('plans', []),
                    'intermittences': data.get('intermittences', []),
                    'holidays': data.get('holidays', []),
                    'flow_rules': data.get('flow_rules', [])
                }
                # Si el formato antiguo tenía datos de intersección, los movemos
                if 'intersection' in data:
                    self.project_data['software_config'] = {
                        'intersection': data['intersection']
                    }
                else:
                    self.project_data['software_config'] = {}

            return {'status': 'success'}
        except Exception as e:
            # ... (manejo de errores sin cambios) ...
            return {'status': 'error', 'message': str(e)}

    def reset_project_data(self):
        """
        MODIFICADO: Reinicia el proyecto a la nueva estructura vacía.
        """
        print("CONTROLLER: Reseteando datos del proyecto a estado inicial.")
        self.project_data = {
            'hardware_config': {
                'info': {}, 'movements': [], 'sequences': [], 'plans': [],
                'intermittences': [], 'holidays': [], 'flow_rules': []
            },
            'software_config': {}
        }

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
        self.project_data['hardware_config'] = {
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
        """MODIFICADO: Devuelve datos desde la sub-estructura correcta."""
        info = self.project_data.get('hardware_config', {}).get('info', {})
        return {
            'controller_id': info.get('controller_id', 'N/A'),
            'date': info.get('date', 'N/A'),
            'time': info.get('time', 'N/A')
        }

    def save_project_to_file(self, filepath: str) -> dict:
        """
        MODIFICADO: Guarda el diccionario completo que ya tiene la nueva estructura.
        No se necesitan cambios aquí porque ahora self.project_data ya tiene el formato correcto.
        """
        print(f"CONTROLLER: Guardando proyecto en {filepath}")
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                # Simplemente guardamos el objeto principal, que ya está estructurado
                json.dump(self.project_data, f, indent=2, ensure_ascii=False)
            return {'status': 'success', 'message': f'Proyecto guardado en {filepath}'}
        except Exception as e:
            print(f"CONTROLLER: Error al guardar archivo: {e}")
            return {'status': 'error', 'message': str(e)}

    # =================================================================================
    # --- INICIO: NUEVAS FUNCIONES PARA SUBIR LA CONFIGURACIÓN ---
    # =================================================================================
    def _send_write_command(self, command, payload):
        """Función auxiliar para enviar un comando de escritura y verificar el ACK."""
        response = self._comm.send_command(command, data_payload=payload)
        # El ACK del firmware es el carácter 0x06
        if response.get('status') == 'success' and response.get('data') == '\x06':
            return True
        print(f"Error: No se recibió ACK para el comando 0x{command:02X}. Respuesta: {response.get('data')}")
        return False

    def _upload_movements(self, movements):
        """Sube todos los movimientos al controlador."""
        print("CONTROLLER: Escribiendo movimientos...")
        for i in range(MAX_MOVEMENTS):
            mov = next((m for m in movements if m['id'] == i), None)
            payload = bytearray(11)
            payload[0] = i
            if mov:
                payload[1] = int(mov['portD'], 16)
                payload[2] = int(mov['portE'], 16)
                payload[3] = int(mov['portF'], 16)
                payload[4] = int(mov['portH'], 16)
                payload[5] = int(mov['portJ'], 16)
                for j in range(5):
                    payload[6 + j] = mov['times'][j]
            else:
                # Si el movimiento no existe, lo llenamos con 0xFF (vacío)
                for j in range(1, 11):
                    payload[j] = 0xFF
            
            if not self._send_write_command(0x23, payload):
                return {'status': 'error', 'message': f'Falló al escribir el movimiento {i}'}
        return {'status': 'success'}

    def _upload_sequences(self, sequences):
        """Sube todas las secuencias al controlador."""
        print("CONTROLLER: Escribiendo secuencias...")
        for i in range(MAX_SEQUENCES):
            seq = next((s for s in sequences if s['id'] == i), None)
            payload = bytearray(16)
            payload[0] = i
            if seq:
                payload[1] = seq['type']
                payload[2] = seq['anchor_pos']
                payload[3] = len(seq['movements'])
                for j in range(12):
                    if j < len(seq['movements']):
                        payload[4 + j] = seq['movements'][j]
                    else:
                        payload[4 + j] = 0xFF # Rellenar con 0xFF
            else:
                for j in range(1, 16):
                    payload[j] = 0xFF
            
            if not self._send_write_command(0x30, payload):
                return {'status': 'error', 'message': f'Falló al escribir la secuencia {i}'}
        return {'status': 'success'}

    def _upload_plans(self, plans):
        """Sube todos los planes al controlador."""
        print("CONTROLLER: Escribiendo planes...")
        for i in range(MAX_PLANS):
            plan = next((p for p in plans if p['id'] == i), None)
            payload = bytearray(6)
            payload[0] = i
            if plan:
                payload[1] = plan['day_type_id']
                payload[2] = plan['sequence_id']
                payload[3] = plan['time_sel']
                payload[4] = plan['hour']
                payload[5] = plan['minute']
            else:
                # Un plan vacío tiene un tipo de día inválido (255)
                for j in range(1, 6):
                    payload[j] = 0xFF

            if not self._send_write_command(0x40, payload):
                return {'status': 'error', 'message': f'Falló al escribir el plan {i}'}
        return {'status': 'success'}

    def _upload_intermittences(self, intermittences):
        """Sube todas las reglas de intermitencia."""
        print("CONTROLLER: Escribiendo intermitencias...")
        for i in range(MAX_INTERMITENCES):
            rule = next((r for r in intermittences if r['id'] == i), None)
            payload = bytearray(6)
            payload[0] = i
            if rule:
                payload[1] = rule['id_plan']
                payload[2] = rule['indice_mov']
                payload[3] = int(rule['maskD'], 16)
                payload[4] = int(rule['maskE'], 16)
                payload[5] = int(rule['maskF'], 16)
            else:
                for j in range(1, 6):
                    payload[j] = 0xFF
            
            if not self._send_write_command(0x50, payload):
                return {'status': 'error', 'message': f'Falló al escribir la intermitencia {i}'}
        return {'status': 'success'}

    def _upload_holidays(self, holidays):
        """Sube todos los feriados."""
        print("CONTROLLER: Escribiendo feriados...")
        for i in range(MAX_HOLIDAYS):
            holiday = next((h for h in holidays if h['id'] == i), None)
            payload = bytearray(3)
            payload[0] = i
            if holiday:
                payload[1] = holiday['day']
                payload[2] = holiday['month']
            else:
                # Un feriado inválido puede tener día 0
                payload[1] = 0
                payload[2] = 0

            if not self._send_write_command(0x60, payload):
                return {'status': 'error', 'message': f'Falló al escribir el feriado {i}'}
        return {'status': 'success'}

    def _upload_flow_rules(self, flow_rules):
        """Sube todas las reglas de flujo."""
        print("CONTROLLER: Escribiendo reglas de flujo...")
        for i in range(MAX_FLOW_CONTROL_RULES):
            rule = next((r for r in flow_rules if r['id'] == i), None)
            payload = bytearray(6)
            payload[0] = i
            if rule:
                payload[1] = rule['sequence_id']
                payload[2] = rule['origin_mov_id']
                payload[3] = rule['rule_type']
                payload[4] = rule['demand_mask']
                payload[5] = rule['destination_mov_id']
            else:
                for j in range(1, 6):
                    payload[j] = 0xFF

            if not self._send_write_command(0x70, payload):
                return {'status': 'error', 'message': f'Falló al escribir la regla de flujo {i}'}
        return {'status': 'success'}


    def upload_full_configuration(self, hardware_config):
        """
        Orquesta el proceso completo de subida de la configuración.
        El orden es importante para mantener la integridad referencial.
        """
        print("CONTROLLER: Iniciando subida de configuración completa...")
        
        # El orden es importante. Primero subimos los datos base (movimientos)
        # y luego los que dependen de ellos (secuencias, planes, etc.)
        upload_steps = [
            (self._upload_movements, hardware_config.get('movements', [])),
            (self._upload_sequences, hardware_config.get('sequences', [])),
            (self._upload_plans, hardware_config.get('plans', [])),
            (self._upload_intermittences, hardware_config.get('intermittences', [])),
            (self._upload_holidays, hardware_config.get('holidays', [])),
            (self._upload_flow_rules, hardware_config.get('flow_rules', []))
        ]

        for uploader, data in upload_steps:
            result = uploader(data)
            if result['status'] != 'success':
                return result # Si un paso falla, detenemos todo y reportamos el error

        print("CONTROLLER: Subida de configuración completada exitosamente.")
        return {'status': 'success', 'message': 'Configuración subida al controlador exitosamente.'}