import serial
import time
import threading

class Communicator:
    """
    Gestiona la comunicación persistente con el puerto serie.
    """
    def __init__(self):
        self.ser = None
        self.lock = threading.Lock()

    def connect(self, port, baudrate):
        with self.lock:
            try:
                if self.ser and self.ser.is_open:
                    self.ser.close()
                self.ser = serial.Serial(port, int(baudrate), timeout=1)
                # Damos un pequeño respiro para que el puerto se estabilice
                time.sleep(0.1)
                return {'status': 'success'}
            except serial.SerialException as e:
                self.ser = None
                return {'status': 'error', 'message': str(e)}

    def disconnect(self):
        with self.lock:
            if self.ser and self.ser.is_open:
                self.ser.close()
                self.ser = None
            return {'status': 'success'}

    @property
    def is_connected(self):
        return self.ser is not None and self.ser.is_open

    def _build_frame(self, cmd_byte, data_payload=b''):
        STX = bytes([0x43, 0x53, 0x4F])
        ETX = bytes([0x03, 0xFF])
        len_byte = len(data_payload)
        checksum = (cmd_byte + len_byte + sum(data_payload)) % 256
        return STX + bytes([cmd_byte, len_byte]) + data_payload + bytes([checksum]) + ETX

    def send_command(self, cmd_byte, data_payload=b''):
        if not self.is_connected:
            return {'status': 'error', 'message': 'No hay una conexión activa.'}

        with self.lock:
            frame = self._build_frame(cmd_byte, data_payload)
            try:
                self.ser.reset_input_buffer()
                self.ser.write(frame)
                print(f"Enviado: {frame.hex().upper()}")
                time.sleep(0.06) 
                # --- SOLUCIÓN DE LECTURA ROBUSTA ---
                # Leemos hasta recibir un salto de línea, con un timeout de 1 segundo.
                # Esto es mucho más fiable que una pausa fija.
                response_bytes = self.ser.read_until(b'\n')
                
                if response_bytes:
                    # Limpiamos la respuesta de caracteres de control y la decodificamos
                    response_text = response_bytes.decode('ascii', errors='replace').strip()
                    print(f"Respuesta Recibida: {response_text}")
                    return {'status': 'success', 'data': response_text}
                else:
                    print(f"ADVERTENCIA: Timeout para el comando 0x{cmd_byte:02X}. No se recibió respuesta.")
                    return {'status': 'error', 'message': 'Timeout: No se recibió respuesta del dispositivo.'}

            except serial.SerialException as e:
                return {'status': 'error', 'message': f'Error de comunicación: {e}'}
