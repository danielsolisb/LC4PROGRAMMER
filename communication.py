# communication.py
import serial
import time
from tkinter import messagebox
import threading 

class Communicator:
    def __init__(self, log_callback):
        self.ser = None
        self.log = log_callback
        self.is_running = False
        self.reader_thread = None
        self.lock = threading.Lock() # Lock para proteger el acceso al puerto serial
        self.monitoring_callback = None # Callback para enviar datos de monitoreo a la GUI

        self.STX = bytes([0x43, 0x53, 0x4F])
        self.ETX = bytes([0x03, 0xFF])

    def connect(self, port, baudrate=9600):
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
            self.ser = serial.Serial(port, baudrate, timeout=0.1) # Timeout bajo para el hilo
            self.is_running = True
            self.reader_thread = threading.Thread(target=self.read_from_port, daemon=True)
            self.reader_thread.start()
            self.log(f"Conectado a {port} y escuchando.")
            return True
        except serial.SerialException as e:
            messagebox.showerror("Error de Conexión", f"No se pudo conectar: {e}")
            return False

    def disconnect(self):
        self.is_running = False
        if self.reader_thread and self.reader_thread.is_alive():
            self.reader_thread.join()
        if self.ser and self.ser.is_open:
            self.ser.close()
        self.log("Desconectado del puerto COM.")
    
    def register_monitoring_callback(self, callback):
        self.monitoring_callback = callback
    
    def _build_frame(self, cmd_byte, data_payload):
        len_byte = len(data_payload)
        checksum = (cmd_byte + len_byte + sum(data_payload)) % 256
        return self.STX + bytes([cmd_byte, len_byte]) + data_payload + bytes([checksum]) + self.ETX

    def send_command(self, cmd_byte, data_payload=b''):
        if not (self.ser and self.ser.is_open):
            messagebox.showwarning("No Conectado", "Por favor, conecta a un puerto COM primero.")
            return None
        
        with self.lock: # Adquirir el lock para asegurar acceso exclusivo
            frame = self._build_frame(cmd_byte, data_payload)
            try:
                self.ser.reset_input_buffer()
                self.ser.write(frame)
                self.log(f"Enviado: {frame.hex().upper()}")
                
                # Pausa para dar tiempo a la respuesta
                time.sleep(0.3)
                
                if self.ser.in_waiting > 0:
                    response_bytes = self.ser.read(self.ser.in_waiting) # Leer todo lo disponible
                    
                    if response_bytes.startswith(self.STX) and response_bytes.endswith(self.ETX):
                        self.log(f"Recibida Trama: {response_bytes.hex().upper()}")
                        resp_cmd = response_bytes[3]
                        resp_len = response_bytes[4]
                        resp_payload = response_bytes[5:5+resp_len]
                        
                        if resp_cmd == 0x06: # ACK
                            return {'type': 'ack', 'cmd_ack': resp_payload[0]}
                        elif resp_cmd == 0x15: # NACK
                            return {'type': 'nack', 'cmd_nack': resp_payload[0], 'error_code': resp_payload[1]}
                    else:
                        response_text = response_bytes.decode('ascii', errors='replace').strip()
                        self.log(f"Recibido Texto:\n{response_text}")
                        return {'type': 'text', 'data': response_text}

                self.log("Timeout: No se recibió respuesta del controlador.")
                return {'type': 'timeout'}

            except serial.SerialException as e:
                messagebox.showerror("Error de Comunicación", f"Error al enviar/recibir: {e}")
                return None
    
    def read_from_port(self):
        """Hilo que escucha solo reportes de monitoreo (CMD 0x82)"""
        buffer = bytearray()
        while self.is_running:
            if not self.lock.locked(): # Solo leer si send_command no está usando el puerto
                try:
                    if self.ser.in_waiting > 0:
                        buffer.extend(self.ser.read(self.ser.in_waiting))
                    
                    # Buscar una trama completa en el buffer
                    start_index = buffer.find(self.STX)
                    if start_index != -1:
                        end_index = buffer.find(self.ETX, start_index)
                        if end_index != -1:
                            frame_end = end_index + len(self.ETX)
                            frame = buffer[start_index:frame_end]
                            
                            # Procesar solo si es un reporte de monitoreo (0x82)
                            if frame[3] == 0x82 and self.monitoring_callback:
                                self.log(f"Recibido Reporte Monitoreo: {frame.hex().upper()}")
                                # Llama al callback con el payload del reporte
                                self.monitoring_callback(frame[5:5+frame[4]]) 
                            
                            # Eliminar la trama procesada (o no) del buffer
                            buffer = buffer[frame_end:]
                except Exception:
                    # Ignorar errores de lectura para mantener el hilo vivo
                    pass
            time.sleep(0.05) # Pequeña pausa para no consumir todo el CPU