import serial
import time
import threading

class Communicator:
    def __init__(self):
        self.ser = None
        self.lock = threading.Lock()
        self.STX = bytes([0x43, 0x53, 0x4F])
        self.ETX = bytes([0x03, 0xFF])

    def connect(self, port, baudrate=9600):
        try:
            if self.ser and self.ser.is_open:
                self.ser.close()
            self.ser = serial.Serial(port, int(baudrate), timeout=0.5)
            print(f"Conectado a {port} a {baudrate} baud.")
            return {'status': 'success'}
        except serial.SerialException as e:
            print(f"Error de Conexión: {e}")
            return {'status': 'error', 'message': str(e)}

    def disconnect(self):
        if self.ser and self.ser.is_open:
            self.ser.close()
        print("Desconectado del puerto COM.")

    def _build_frame(self, cmd_byte, data_payload=b''):
        len_byte = len(data_payload)
        checksum = (cmd_byte + len_byte + sum(data_payload)) % 256
        return self.STX + bytes([cmd_byte, len_byte]) + data_payload + bytes([checksum]) + self.ETX

    def send_command(self, cmd_byte, data_payload=b''):
        if not (self.ser and self.ser.is_open):
            return {'status': 'error', 'message': 'No conectado a un puerto COM.'}
        
        with self.lock:
            frame = self._build_frame(cmd_byte, data_payload)
            try:
                self.ser.reset_input_buffer()
                self.ser.write(frame)
                print(f"Enviado: {frame.hex().upper()}")
                
                # --- CORRECCIÓN AQUÍ: Añadimos una pequeña pausa ---
                # Damos tiempo al controlador para procesar y responder.
                time.sleep(0.3)
                
                response_bytes = self.ser.read_until(self.ETX)
                
                if not response_bytes:
                    return {'status': 'error', 'message': 'Timeout: No se recibió respuesta.'}
                
                if response_bytes.startswith(self.STX) and response_bytes.endswith(self.ETX):
                    print(f"Recibida Trama: {response_bytes.hex().upper()}")
                    resp_cmd = response_bytes[3]
                    resp_payload = response_bytes[5:5+response_bytes[4]]
                    
                    if resp_cmd == 0x06: # ACK
                        return {'status': 'success', 'type': 'ack', 'data': resp_payload}
                    elif resp_cmd == 0x15: # NACK
                        return {'status': 'error', 'type': 'nack', 'message': f'Error NACK recibido: {resp_payload.hex()}'}
                
                response_text = response_bytes.decode('ascii', errors='replace').strip()
                print(f"Recibido Texto: {response_text}")
                return {'status': 'success', 'type': 'text', 'data': response_text}

            except serial.SerialException as e:
                return {'status': 'error', 'message': f'Error de comunicación: {e}'}
