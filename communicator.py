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
                # El timeout de 1 segundo sigue siendo una buena salvaguarda.
                self.ser = serial.Serial(port, int(baudrate), timeout=1)
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

        WRITE_COMMANDS = {0x10, 0x22, 0x23, 0x30, 0x40, 0x50, 0x60, 0x70, 0xF0}
        
        with self.lock:
            frame = self._build_frame(cmd_byte, data_payload)
            try:
                self.ser.reset_input_buffer()
                self.ser.write(frame)
                print(f"Enviado: {frame.hex().upper()}")

                # --- INICIO DE LA SOLUCIÓN CORRECTA ---
                # Pausa estratégica para dar tiempo al controlador a procesar,
                # especialmente importante para comandos de escritura.
                if cmd_byte in WRITE_COMMANDS:
                    time.sleep(0.3)
                else:
                    time.sleep(0.08)
                # --- FIN DE LA SOLUCIÓN CORRECTA ---

                if self.ser.in_waiting > 0:
                    response_bytes = self.ser.read(self.ser.in_waiting)
                    
                    if cmd_byte in WRITE_COMMANDS:
                        # Para comandos de escritura, solo nos importa si se recibió un ACK.
                        if b'\x06' in response_bytes:
                            print("Respuesta Recibida: ACK (0x06) detectado.")
                            return {'status': 'success', 'data': '\x06'}
                        else:
                            print(f"ADVERTENCIA: Se esperaba ACK pero se recibió: {response_bytes.hex().upper()}")
                            return {'status': 'error', 'message': 'No se recibió ACK del dispositivo.'}
                    else:
                        # Para comandos de lectura, devolvemos el texto.
                        response_text = response_bytes.decode('ascii', errors='replace').strip()
                        print(f"Respuesta Recibida: {response_text}")
                        return {'status': 'success', 'data': response_text}
                else:
                    # Si después de la pausa no hay nada, es un timeout.
                    print(f"ADVERTENCIA: Timeout para el comando 0x{cmd_byte:02X}. No se recibió respuesta.")
                    return {'status': 'error', 'message': 'Timeout: No se recibió respuesta del dispositivo.'}

            except serial.SerialException as e:
                return {'status': 'error', 'message': f'Error de comunicación: {e}'}