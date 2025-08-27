# controller.py

import re
import json
from communicator import Communicator
import time
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

    def _parse_id_response(self, response_payload: bytes | None) -> str:
        # Payload: [ID] (1 byte)
        if response_payload:
            # response_payload[0] es el valor numérico del byte.
            # f"{...:02X}" lo formatea como un string hexadecimal de dos caracteres.
            return f"{response_payload[0]:02X}"
        return "N/A"


    def _parse_time_response(self, response_payload: bytes | None) -> tuple[str, str]:
        # Payload: [HH, MM, SS, DD, MM, YY, DoW] (7 bytes)
        if response_payload and len(response_payload) == 7:
            h, m, s, day, mon, year, dow = response_payload
            time_str = f"{h:02d}:{m:02d}:{s:02d}"
            date_str = f"{day:02d}/{mon:02d}/20{year:02d}" # Asumimos años 20xx
            return date_str, time_str
        return "Formato Inválido", "Formato Inválido"

    def _parse_movement_response(self, response_payload: bytes) -> dict | None:
        # Payload: [Index, D, E, F, H, J, T0, T1, T2, T3, T4] (11 bytes)
        if len(response_payload) == 11:
            
            # --- INICIO DE LA SOLUCIÓN ---
            # Un slot de movimiento vacío en la EEPROM usualmente se lee como 0xFF.
            # Si el primer byte de los puertos es 0xFF, consideramos que es un
            # movimiento inválido o "fantasma" y lo descartamos devolviendo None.
            portD_value = response_payload[1]
            if portD_value == 0xFF:
                return None # Descartar este movimiento
            # --- FIN DE LA SOLUCIÓN ---

            return {
                'id': response_payload[0],
                'portD': f"{response_payload[1]:02X}",
                'portE': f"{response_payload[2]:02X}",
                'portF': f"{response_payload[3]:02X}",
                'portH': f"{response_payload[4]:02X}",
                'portJ': f"{response_payload[5]:02X}",
                'times': list(response_payload[6:])
            }
        return None

    def _parse_sequence_response(self, response_payload: bytes) -> dict | None:
        # Payload: [Index, Tipo, Ancla_Pos, Num_Mov, Mov_0, ..., Mov_11] (16 bytes)
        if len(response_payload) == 16:
            num_movements = response_payload[3]
            movements = list(response_payload[4:4+num_movements])
            return {
                'id': response_payload[0],
                'type': response_payload[1],
                'anchor_pos': response_payload[2],
                'movements': movements
            }
        return None

    def _parse_plan_response(self, response_payload: bytes) -> dict | None:
        # Payload: [Index, TipoDia, Sec, Tsel, Hora, Min] (6 bytes)
        if len(response_payload) == 6:
            return {
                'id': response_payload[0],
                'day_type_id': response_payload[1],
                'sequence_id': response_payload[2],
                'time_sel': response_payload[3],
                'hour': response_payload[4],
                'minute': response_payload[5]
            }
        return None

    def _parse_intermittence_response(self, response_payload: bytes) -> dict | None:
        # Payload: [Index, PlanID, MovID, MaskD, MaskE, MaskF] (6 bytes)
        if len(response_payload) == 6:
            return {
                'id': response_payload[0],
                'id_plan': response_payload[1], # Corregido para que coincida con el frontend
                'indice_mov': response_payload[2], # Corregido para que coincida con el frontend
                'maskD': f"{response_payload[3]:02X}",
                'maskE': f"{response_payload[4]:02X}",
                'maskF': f"{response_payload[5]:02X}"
            }
        return None


    def _parse_flow_rule_response(self, response_payload: bytes) -> dict | None:
        # Payload: [Index, Sec, MovOrig, Tipo, Mascara, MovDest] (6 bytes)
        if len(response_payload) == 6:
            return {
                'id': response_payload[0],
                'sequence_id': response_payload[1],
                'origin_mov_id': response_payload[2],
                'rule_type': response_payload[3],
                'demand_mask': response_payload[4],
                'destination_mov_id': response_payload[5]
            }
        return None
        
    def _parse_all_holidays_response(self, response_payload: bytes) -> list:
        # Payload: [ID, Dia, Mes, ID, Dia, Mes, ...] (N * 3 bytes)
        holidays = []
        chunk_size = 3
        for i in range(0, len(response_payload), chunk_size):
            chunk = response_payload[i:i+chunk_size]
            if len(chunk) == chunk_size:
                holidays.append({
                    'id': chunk[0],
                    'day': chunk[1],
                    'month': chunk[2]
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
            # Si el comando fue exitoso (no NACK), procesamos el payload.
            if response.get('status') == 'success':
                parsed_item = parser_func(response['data'])
                if parsed_item:
                    items.append(parsed_item)
        print(f"CONTROLLER: Capturados {len(items)} {item_name}.")
        return items
        
    # --- NUEVA FUNCIÓN DE CAPTURA PARA FERIADOS ---
    def _fetch_all_holidays(self) -> list:
        """Función específica para capturar todos los feriados con un solo comando."""
        print("CONTROLLER: Capturando feriados...")
        response = self._comm.send_command(0x61)
        items = []
        if response.get('status') == 'success':
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
        
        # --- INICIO DE LA CORRECCIÓN ---
        # Extraemos el campo 'data' del diccionario de respuesta ANTES de pasarlo al parser.
        controller_id = self._parse_id_response(id_response.get('data'))
        date_str, time_str = self._parse_time_response(time_response.get('data'))
        # --- FIN DE LA CORRECCIÓN ---

        # Captura de todas las tablas de datos (esta parte ya estaba bien)
        movements = self._fetch_all_items("movimientos", MAX_MOVEMENTS, 0x24, self._parse_movement_response)
        sequences = self._fetch_all_items("secuencias", MAX_SEQUENCES, 0x31, self._parse_sequence_response)
        plans = self._fetch_all_items("planes", MAX_PLANS, 0x41, self._parse_plan_response)
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
        
        if response.get('status') == 'success':
            # --- INICIO DE LA CORRECCIÓN ---
            # Agregamos una pequeña pausa DESPUÉS de recibir el ACK.
            # Esto le da al firmware tiempo para completar la escritura en la EEPROM
            # antes de que le enviemos el siguiente comando en el bucle.
            time.sleep(0.05) # Pausa de 50 milisegundos, ajustable si es necesario.
            # --- FIN DE LA CORRECCIÓN ---
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
        
        # --- INICIO DE LA CORRECCIÓN ---
        # Añadimos el paso que faltaba para subir el ID del controlador.
        upload_steps = [
            (self._upload_controller_id, hardware_config.get('info', {})),
            (self._upload_movements, hardware_config.get('movements', [])),
            (self._upload_sequences, hardware_config.get('sequences', [])),
            (self._upload_plans, hardware_config.get('plans', [])),
            (self._upload_intermittences, hardware_config.get('intermittences', [])),
            (self._upload_holidays, hardware_config.get('holidays', [])),
            (self._upload_flow_rules, hardware_config.get('flow_rules', []))
        ]
        # --- FIN DE LA CORRECCIÓN ---

        for uploader, data in upload_steps:
            result = uploader(data)
            if result['status'] != 'success':
                return result # Si un paso falla, detenemos todo y reportamos el error

        print("CONTROLLER: Subida de configuración completada exitosamente.")
        return {'status': 'success', 'message': 'Configuración subida al controlador exitosamente.'}

    
    def _upload_controller_id(self, info_config):
        """Sube el ID del controlador."""
        print("CONTROLLER: Escribiendo ID del controlador...")
        controller_id_str = info_config.get('controller_id', '0')
        try:
            # El firmware espera un byte. Convertimos el ID a un entero.
            controller_id_byte = int(controller_id_str)
            payload = bytes([controller_id_byte])
            
            # El comando para guardar el ID es 0x10.
            if not self._send_write_command(0x10, payload):
                return {'status': 'error', 'message': 'Falló al escribir el ID del controlador'}
            return {'status': 'success'}
        except (ValueError, TypeError):
            return {'status': 'error', 'message': f'El ID del controlador "{controller_id_str}" no es un número válido.'}

    def _upload_controller_id(self, info_config):
        """Sube el ID del controlador."""
        print("CONTROLLER: Escribiendo ID del controlador...")
        # Extraemos el ID del diccionario 'info', si no existe, usamos '0'.
        controller_id_str = info_config.get('controller_id', '0')
        try:
            # El firmware espera un número. Convertimos el ID a entero.
            # El archivo .lc4 lo guarda como string, ej: "2".
            controller_id_byte = int(controller_id_str) 
            payload = bytes([controller_id_byte])
            
            # El comando para guardar el ID es 0x10.
            if not self._send_write_command(0x10, payload):
                return {'status': 'error', 'message': 'Falló al escribir el ID del controlador'}
            return {'status': 'success'}
        except (ValueError, TypeError):
            return {'status': 'error', 'message': f'El ID del controlador "{controller_id_str}" no es un número válido.'}