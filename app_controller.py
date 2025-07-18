# app_controller.py
from tkinter import messagebox
import re
from gui_components import COLOR_PIN_OFF, COLOR_TEXT_OFF, COLOR_TEXT_ON

def validate_decimal(valor_str, min_val=None, max_val=None):
    try:
        val = int(valor_str)
        if (min_val is not None and val < min_val) or (max_val is not None and val > max_val):
            raise ValueError("Valor fuera de rango.")
        return val
    except (ValueError, TypeError):
        return None

class AppController:
    def __init__(self, comm, ui):
        self.comm = comm
        self.ui = ui # 'ui' es una referencia a la clase MainApplication

    # === MÉTODOS DE ID Y GENERALES ===
    def cmd_guardar_id(self, id_str):
        val = validate_decimal(id_str, 0, 255)
        if val is None: messagebox.showerror("Error", "ID inválido."); return
        response = self.comm.send_command(0x10, bytes([val]))
        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", "ID del controlador guardado correctamente.")
        else:
            messagebox.showerror("Error", "Fallo al guardar el ID en el controlador.")
    
    def cmd_leer_id(self):
        self.comm.send_command(0x11)
        
    def cmd_consultar_estado(self):
        self.comm.send_command(0x20)
        
    def cmd_consultar_hora_fecha(self):
        self.comm.send_command(0x21)

    def cmd_set_rtc(self, h, m, s, d, mo, a, dow_str):
        """
        Construye y envía el comando 0x22 para establecer la fecha y hora.
        VERSIÓN CORREGIDA:
        - Construye un payload de 7 bytes.
        - Ordena los bytes como el firmware espera.
        - Convierte el día de la semana a su valor numérico.
        """
        try:
            hour_val = int(h)
            min_val = int(m)
            sec_val = int(s)
            day_val = int(d)
            month_val = int(mo)
            year_val = int(a)
    
            if not (0 <= hour_val <= 23 and 0 <= min_val <= 59 and 0 <= sec_val <= 59 and \
                    1 <= day_val <= 31 and 1 <= month_val <= 12 and 0 <= year_val <= 99):
                raise ValueError("Uno o más valores están fuera del rango permitido.")

            # --- INICIO DE LA CORRECCIÓN ---

            # 1. Convertir el día de la semana de texto a número
            # (Asumiendo Lunes=1, Martes=2, ..., Domingo=7)
            dias_semana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
            try:
                # .index() devuelve la posición (0 para Lunes), sumamos 1
                dow_val = dias_semana.index(dow_str) + 1
            except ValueError:
                messagebox.showerror("Error de Entrada", "Día de la semana inválido.")
                return

            # 2. El firmware en C espera el payload en el orden: [hora, min, seg, dia, mes, año, dia_sem]
            # Creamos la lista de payload con la LONGITUD CORRECTA (7 bytes) y ORDEN CORRECTO.
            
            payload_list = [
                hour_val,
                min_val,
                sec_val,
                day_val,
                month_val,
                year_val,
                dow_val  # <-- Se añade el día de la semana
            ]
    
            # 3. Convertimos la lista a un objeto de bytes
            payload = bytes(payload_list)
            
            # 4. Enviamos el comando con el payload ya corregido
            self.comm.send_command(0x22, payload)

        except (ValueError, TypeError):
            messagebox.showerror("Error de Formato", "Todos los campos deben ser números válidos y estar dentro de su rango.")
            return

    # ... resto de tus funciones ...
    #DEBUG
    def cmd_prueba_rtc(self):
        # Envía el comando 0x25 sin datos (payload vacío)
        self.comm.send_command(0x25)
    def cmd_prueba_ram_rtc(self):
        self.comm.send_command(0x26)

    # === MÉTODOS DE MOVIMIENTOS ===
    def cmd_guardar_movimiento(self, index_str, port_values_list, tiempos_entries):
        index = validate_decimal(index_str, 0, 59)
        if index is None: messagebox.showerror("Error", "Índice de movimiento inválido (0-59)."); return

        tiempos_val = [validate_decimal(entry.get(), 0, 255) for entry in tiempos_entries]
        if None in tiempos_val: messagebox.showerror("Error", "Valor de tiempo inválido (0-255)."); return
        
        datos = bytes([index] + port_values_list + tiempos_val)
        response = self.comm.send_command(0x23, datos)

        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", f"Movimiento {index} guardado correctamente.")
        else:
            # Aquí podrías decodificar el 'error_code' para un mensaje más específico
            messagebox.showerror("Error", f"Fallo al guardar el movimiento {index}.")

        
    def cmd_leer_movimiento(self, index_str):
        index = validate_decimal(index_str, 0, 59)
        if index is None: 
            messagebox.showerror("Error", "Índice de movimiento inválido.")
            return None
        
        response = self.comm.send_command(0x24, bytes([index]))
        # Si la respuesta es de tipo texto, devuelve solo el string de datos
        if response and response.get('type') == 'text':
            return response.get('data')
        return None # Devuelve None si no hubo una respuesta de texto válida

    # === MÉTODOS DE SECUENCIAS ===
    def cmd_guardar_secuencia(self, sec_idx_str, type_str, anchor_str, num_movs_str, indices_str):
        # --- FUNCIÓN REESCRITA ---
        sec_index = validate_decimal(sec_idx_str, 0, 7)
        num_movs = validate_decimal(num_movs_str, 1, 12)
        
        # Extrae el valor numérico del tipo (ej: "0: Automática" -> 0)
        seq_type = int(type_str.split(':')[0])
        
        anchor_step = validate_decimal(anchor_str, 0, 11)

        if sec_index is None or num_movs is None or anchor_step is None:
            messagebox.showerror("Error", "Índice de secuencia, paso ancla o número de movimientos inválido.")
            return
        
        indices = []
        try:
            indices_list = indices_str.split(',')
            if len(indices_list) != num_movs:
                messagebox.showerror("Error", f"Se esperaban {num_movs} índices, pero se ingresaron {len(indices_list)}.")
                return
            for s_idx in indices_list:
                val = validate_decimal(s_idx.strip(), 0, 59)
                if val is None: raise ValueError(f"Índice de movimiento '{s_idx}' inválido.")
                indices.append(val)
        except Exception as e:
            messagebox.showerror("Error", str(e))
            return
            
        # Rellena con 0xFF los espacios no usados de los 12 disponibles
        while len(indices) < 12: indices.append(0xFF)
        
        # El payload ahora incluye el tipo y el paso ancla
        # Payload: [sec_idx, tipo, ancla, num_movs, ...12 índices...]
        payload = bytes([sec_index, seq_type, anchor_step, num_movs] + indices)
        
        response = self.comm.send_command(0x30, payload)
        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", f"Secuencia {sec_index} guardada correctamente.")
        else:
            messagebox.showerror("Error", f"Fallo al guardar la secuencia {sec_index}.")

    def cmd_leer_secuencia(self, sec_idx_str):
        sec_index = validate_decimal(sec_idx_str, 0, 7)
        if sec_index is None: 
            messagebox.showerror("Error", "Índice de secuencia inválido.")
            return None
        
        response = self.comm.send_command(0x31, bytes([sec_index]))
        if response and response.get('type') == 'text':
            return response.get('data')
        return None

    def cmd_leer_secuencia_detallada(self, sec_idx_str):
        # --- FUNCIÓN REESCRITA CON LA LÓGICA DE PARSEO CORRECTA ---
        try:
            sec_tab = self.ui.tabs['Secuencias']
        except KeyError:
            messagebox.showerror("Error", "La pestaña de Secuencias no está inicializada.")
            return

        sec_tab.clear_sequence_display()

        # 1. Leer la información básica de la secuencia
        respuesta_sec = self.cmd_leer_secuencia(sec_idx_str)
        if not respuesta_sec or "no existe" in respuesta_sec:
            messagebox.showinfo("Respuesta", "La secuencia no existe o está vacía.")
            return

        # 2. Extraer los índices de movimiento usando una expresión regular corregida
        #    re.IGNORECASE hace que no importe si es "MOV:" o "Mov:"
        match = re.search(r"MOV:\s*(.*)", respuesta_sec, re.IGNORECASE)
        if not match:
            messagebox.showerror("Error de Parseo", "No se pudo encontrar la lista de movimientos en la respuesta.")
            return
        
        indices_str = match.group(1).strip()
        if not indices_str: 
            messagebox.showinfo("Info", "La secuencia no tiene movimientos asignados.")
            return
            
        # Convierte la cadena de texto "1 2 3" a una lista de números [1, 2, 3]
        mov_indices = [int(idx) for idx in indices_str.split()]

        # 3. Itera sobre cada índice de movimiento y lo consulta
        for i, mov_idx in enumerate(mov_indices):
            if i >= 12: break # No mostrar más de 12 movimientos

            # Llama a la función que ya tenías para leer un movimiento individual
            respuesta_mov = self.cmd_leer_movimiento(str(mov_idx))
            if respuesta_mov:
                port_values = {}
                times = []

                # Parsea los valores de los puertos del movimiento
                mov_match = re.search(r"D:([0-9A-Fa-f]{2})\s+E:([0-9A-Fa-f]{2})\s+F:([0-9A-Fa-f]{2})\s+H:([0-9A-Fa-f]{2})\s+J:([0-9A-Fa-f]{2})", respuesta_mov)
                if mov_match:
                    ports_hex = mov_match.groups()
                    port_values = { 'D': int(ports_hex[0], 16), 'E': int(ports_hex[1], 16), 'F': int(ports_hex[2], 16), 'H': int(ports_hex[3], 16), 'J': int(ports_hex[4], 16) }

                # Parsea los valores de los tiempos del movimiento
                times_match = re.search(r"T:\[(.*?)\]", respuesta_mov)
                if times_match:
                    times_str = times_match.group(1).strip()
                    times_hex_list = times_str.split()
                    times = [int(t, 16) for t in times_hex_list]

                # 4. Llama a la función de la GUI para dibujar el movimiento en la columna 'i'
                sec_tab.update_movement_display(i, mov_idx, port_values, times)


    # === MÉTODOS DE PLANES ===
    def cmd_guardar_plan(self, plan_idx_str, tipo_dia_str, sec_idx_str, tsel_str, hora_str, min_str):
        vals = [
            validate_decimal(plan_idx_str, 0, 19),
            validate_decimal(tipo_dia_str, 0, 14),
            validate_decimal(sec_idx_str, 0, 7),
            validate_decimal(tsel_str, 0, 4),
            validate_decimal(hora_str, 0, 23),
            validate_decimal(min_str, 0, 59)
        ]
        if None in vals:
            messagebox.showerror("Error", "Todos los campos para guardar plan son requeridos y deben ser válidos.")
            return
        
        plan_index = vals[0]
        # Lógica de confirmación
        response = self.comm.send_command(0x40, bytes(vals))
        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", f"Plan {plan_index} guardado correctamente.")
        else:
            messagebox.showerror("Error", f"Fallo al guardar el plan {plan_index}.")
    
    def cmd_leer_plan_detallado(self, plan_idx_str):
        # --- FUNCIÓN REESCRITA CON LA LÓGICA DE PARSEO CORRECTA ---
        try:
            plan_tab = self.ui.tabs['Planes']
        except KeyError:
            messagebox.showerror("Error", "La pestaña de Planes no está inicializada.")
            return
    
        plan_tab.clear_display()
    
        plan_index = validate_decimal(plan_idx_str, 0, 19)
        if plan_index is None: 
            messagebox.showerror("Error", "Índice de plan inválido.")
            return
    
        # 1. Leer la información del Plan
        response_plan = self.comm.send_command(0x41, bytes([plan_index]))
        if not (response_plan and response_plan.get('type') == 'text' and response_plan.get('data')):
            plan_tab.display_plan_info(f"Plan [{plan_index}]: No se pudo leer o no existe.")
            return
        
        resp_plan_text = response_plan.get('data')
        plan_tab.display_plan_info(resp_plan_text) # Muestra la info del plan
    
        # 2. Extraer el ID de la secuencia del plan
        match_plan = re.search(r"Sec:(\d+)", resp_plan_text)
        if not match_plan: return
        sec_id = int(match_plan.group(1))
    
        # 3. Leer la información de la Secuencia
        resp_seq_text = self.cmd_leer_secuencia(str(sec_id))
        if not resp_seq_text or "no existe" in resp_seq_text: 
            plan_tab.display_sequence_info(f"Secuencia [{sec_id}]: No encontrada.")
            return
        plan_tab.display_sequence_info(resp_seq_text) # Muestra la info de la secuencia
    
        # 4. Extraer los índices de movimientos usando la expresión regular CORREGIDA
        match_seq = re.search(r"MOV:\s*(.*)", resp_seq_text, re.IGNORECASE)
        if not match_seq: return # Si no hay 'MOV:', no hay nada más que hacer
        mov_indices_str = match_seq.group(1).strip()
        if not mov_indices_str: return
        mov_indices = [int(idx) for idx in mov_indices_str.split()]
    
        # 5. Iterar, consultar y dibujar cada movimiento
        for i, mov_idx in enumerate(mov_indices):
            if i >= 12: break
            
            resp_mov_text = self.cmd_leer_movimiento(str(mov_idx))
            if resp_mov_text:
                port_values = {}
                times = []
                
                mov_match = re.search(r"D:([0-9A-Fa-f]{2})\s+E:([0-9A-Fa-f]{2})\s+F:([0-9A-Fa-f]{2})\s+H:([0-9A-Fa-f]{2})\s+J:([0-9A-Fa-f]{2})", resp_mov_text)
                if mov_match:
                    ports_hex = mov_match.groups()
                    port_values = { 'D': int(ports_hex[0], 16), 'E': int(ports_hex[1], 16), 'F': int(ports_hex[2], 16), 'H': int(ports_hex[3], 16), 'J': int(ports_hex[4], 16) }

                times_match = re.search(r"T:\[(.*?)\]", resp_mov_text)
                if times_match:
                    times_str = times_match.group(1).strip()
                    times_hex_list = times_str.split()
                    times = [int(t, 16) for t in times_hex_list]

                plan_tab.update_movement_display(i, mov_idx, port_values, times)
        
    def cmd_guardar_feriado(self, slot_str, dia_str, mes_str):
        vals = [
            validate_decimal(slot_str, 0, 19),
            validate_decimal(dia_str, 1, 31),
            validate_decimal(mes_str, 1, 12)
        ]
        if None in vals:
            messagebox.showerror("Error", "Todos los campos para guardar feriado son requeridos.")
            return
        
        slot_index = vals[0]
        # Lógica de confirmación
        response = self.comm.send_command(0x60, bytes(vals))
        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", f"Feriado en slot {slot_index} guardado correctamente.")
        else:
            messagebox.showerror("Error", f"Fallo al guardar el feriado en slot {slot_index}.")
        
    def cmd_leer_feriados(self):
        try:
            agenda_tab = self.ui.tabs['Agenda']
            agenda_tab.clear_holiday_display()
            
            response = self.comm.send_command(0x61)
            
            # Si la respuesta es de tipo texto, pásala a la GUI para mostrarla
            if response and response.get('type') == 'text':
                agenda_tab.display_holidays(response.get('data'))
        except KeyError:
            messagebox.showerror("Error", "La pestaña de Agenda no está inicializada.")
        except Exception as e:
            messagebox.showerror("Error", f"Ocurrió un error al consultar feriados: {e}")

    # === MÉTODOS DE INTERMITENCIAS ===
    def cmd_guardar_intermitencia(self, slot_str, plan_id_str, mov_id_str, mask_values):
        vals = [
            validate_decimal(slot_str, 0, 19), 
            validate_decimal(plan_id_str, 0, 19),
            validate_decimal(mov_id_str, 0, 59)
        ]
        if None in vals: 
            messagebox.showerror("Error", "Índices inválidos."); 
            return
        
        slot_index = vals[0]
        # Lógica de confirmación
        response = self.comm.send_command(0x50, bytes(vals + mask_values))
        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", f"Intermitencia en slot {slot_index} guardada correctamente.")
        else:
            messagebox.showerror("Error", f"Fallo al guardar la intermitencia en slot {slot_index}.")

    def cmd_leer_intermitencia(self, slot_str, display_labels):
        for (lbl, color) in display_labels.values():
            lbl.config(bg=COLOR_PIN_OFF, fg=COLOR_TEXT_OFF)
        
        slot_index = validate_decimal(slot_str, 0, 19)
        if slot_index is None: return

        response = self.comm.send_command(0x51, bytes([slot_index]))
        
        # Comprueba que la respuesta sea de tipo texto y contiene datos
        if response and response.get('type') == 'text' and response.get('data'):
            resp_text = response.get('data')
            match = re.search(r"MaskD:0x([0-9A-Fa-f]{2})\s+MaskE:0x([0-9A-Fa-f]{2})\s+MaskF:0x([0-9A-Fa-f]{2})", resp_text)
            if match:
                masks_hex = match.groups()
                mask_values = {
                    'D': int(masks_hex[0], 16),
                    'E': int(masks_hex[1], 16),
                    'F': int(masks_hex[2], 16)
                }
                for (port, pin), (lbl, color) in display_labels.items():
                    if port in mask_values and (mask_values[port] >> pin) & 1:
                        lbl.config(bg=color, fg=COLOR_TEXT_ON)

    def cmd_guardar_regla_flujo(self, rule_idx_str, seq_idx_str, orig_mov_str, type_str, demand_vars, dest_mov_str):
        rule_idx = validate_decimal(rule_idx_str, 0, 9)
        seq_idx = validate_decimal(seq_idx_str, 0, 7)
        orig_mov = validate_decimal(orig_mov_str, 0, 59)
        dest_mov = validate_decimal(dest_mov_str, 0, 59)
        
        # Extrae el valor numérico del tipo de regla (ej: "0: GOTO" -> 0)
        rule_type = int(type_str.split(':')[0])

        if None in [rule_idx, seq_idx, orig_mov, dest_mov]:
            messagebox.showerror("Error", "Todos los índices deben ser números válidos.")
            return
            
        demand_mask = 0
        for i, var in enumerate(demand_vars):
            if var == 1:
                demand_mask |= (1 << i)
                
        payload = bytes([rule_idx, seq_idx, orig_mov, rule_type, demand_mask, dest_mov])
        response = self.comm.send_command(0x70, payload)

        if response and response.get('type') == 'ack':
            messagebox.showinfo("Éxito", f"Regla de Flujo {rule_idx} guardada correctamente.")
        else:
            messagebox.showerror("Error", f"Fallo al guardar la regla {rule_idx}.")

    def cmd_leer_regla_flujo(self, rule_idx_str):
        rule_idx = validate_decimal(rule_idx_str, 0, 9)
        if rule_idx is None:
            messagebox.showerror("Error", "Índice de regla inválido.")
            return None
        
        response = self.comm.send_command(0x71, bytes([rule_idx]))
        if response and response.get('type') == 'text':
            return response.get('data')
        return None

    def cmd_erase_eeprom(self):
        if messagebox.askyesno(
            "Confirmar Restauración",
            "¡ADVERTENCIA!\n\n"
            "Esta acción restaurará el controlador a sus valores de fábrica.\n\n"
            "¿Estás seguro de que deseas continuar?"
        ):
            # Lógica de confirmación
            response = self.comm.send_command(0xF0)
            if response and response.get('type') == 'ack':
                # Mensaje de éxito mejorado
                messagebox.showinfo("Éxito", "Comando aceptado. El controlador se restaurará a los valores de fábrica.")
            else:
                messagebox.showerror("Error", "Fallo durante la restauración de fábrica.")


    def register_ui_callback(self, callback):
        """La GUI llama a esto para que el controller sepa a quién notificar."""
        if self.comm:
            self.comm.register_monitoring_callback(callback)

    def cmd_start_monitoring(self):
        # Envía el comando para activar la bandera de monitoreo en el firmware
        return self.comm.send_command(0x80)

    def cmd_stop_monitoring(self):
        # Envía el comando para desactivar la bandera de monitoreo
        return self.comm.send_command(0x81)