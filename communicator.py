# communicator.py

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
                self.ser = serial.Serial(port, int(baudrate), timeout=1.5) # Aumentamos un poco el timeout por seguridad
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

    def _read_full_frame(self, timeout=1.5):
        """
        Lee una trama de datos binaria completa y validada desde el puerto serie.
        Retorna (cmd, payload) si es válida, o (None, None) si hay error/timeout.
        """
        STX = b'\x43\x53\x4F'
        ETX = b'\x03\xFF'
        start_time = time.time()

        while time.time() - start_time < timeout:
            if self.ser.read(1) == STX[0:1]:
                if self.ser.read(2) == STX[1:3]:
                    # STX encontrado, leemos encabezado (CMD + LEN)
                    header = self.ser.read(2)
                    if len(header) < 2: continue

                    cmd_byte, len_byte = header[0], header[1]
                    
                    # Leemos el resto (payload + checksum + ETX)
                    full_payload = self.ser.read(len_byte + 3)
                    if len(full_payload) < len_byte + 3: continue
                    
                    payload = full_payload[:len_byte]
                    checksum_received = full_payload[len_byte]
                    etx_received = full_payload[len_byte+1:]

                    if etx_received != ETX:
                        print("Error de Trama: ETX incorrecto.")
                        continue

                    checksum_calculated = (cmd_byte + len_byte + sum(payload)) % 256
                    if checksum_received != checksum_calculated:
                        print("Error de Trama: Checksum incorrecto.")
                        continue
                    
                    return cmd_byte, payload

        return None, None # Timeout

    def send_command(self, cmd_byte, data_payload=b''):
        if not self.is_connected:
            return {'status': 'error', 'message': 'No hay una conexión activa.'}

        WRITE_COMMANDS = {0x10, 0x22, 0x23, 0x30, 0x40, 0x50, 0x60, 0x70, 0xF0, 0x80, 0x81}
        CMD_ACK = 0x06
        CMD_NACK = 0x15

        with self.lock:
            frame = self._build_frame(cmd_byte, data_payload)
            try:
                self.ser.reset_input_buffer()
                self.ser.write(frame)
                print(f"Enviado: {frame.hex().upper()}")

                resp_cmd, resp_payload = self._read_full_frame()

                if resp_cmd is None:
                    return {'status': 'error', 'message': f'Timeout para el comando 0x{cmd_byte:02X}.'}

                if cmd_byte in WRITE_COMMANDS:
                    if resp_cmd == CMD_ACK:
                        print(f"Respuesta Recibida: ACK para comando 0x{cmd_byte:02X}")
                        return {'status': 'success', 'data': resp_payload}
                    else:
                        return {'status': 'error', 'message': f'Se esperaba ACK pero se recibió CMD 0x{resp_cmd:02X}.'}
                else: # Comandos de Lectura
                    expected_resp_cmd = cmd_byte | 0x80
                    if resp_cmd == expected_resp_cmd:
                        print(f"Respuesta Recibida: CMD 0x{resp_cmd:02X} con payload: {resp_payload.hex().upper()}")
                        return {'status': 'success', 'data': resp_payload}
                    elif resp_cmd == CMD_NACK:
                        print(f"Respuesta Recibida: NACK para el comando 0x{cmd_byte:02X}.")
                        return {'status': 'error', 'message': 'El controlador respondió con NACK (Dato no existe o es inválido).'}
                    else:
                        return {'status': 'error', 'message': f'Respuesta inesperada. Se esperaba 0x{expected_resp_cmd:02X} o NACK, pero se recibió 0x{resp_cmd:02X}.'}

            except serial.SerialException as e:
                return {'status': 'error', 'message': f'Error de comunicación: {e}'}