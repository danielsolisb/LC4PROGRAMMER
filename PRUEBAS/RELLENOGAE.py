import mysql.connector
from datetime import datetime
import logging
import sys # Necesario para salir limpiamente

# --- Configuración del Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

# ==============================================================================
# TODO: CONFIGURACIÓN - ¡RELLENA TUS DATOS AQUÍ!
# ==============================================================================
DB_CONFIG = {
    'host': '34.170.90.73',  # O la IP de tu servidor de base de datos
    'user': 'root',
    'password': 'daniel586',
    'database': 'Gae'  # El nombre de tu base de datos
}

# --- Parámetros del Script ---
TABLE_NAME = "Measurements_measurements"
SENSOR_ID_PTUBING = 1
SENSOR_ID_PCASING = 2
SENSOR_ID_FLOWCOUNT = 3
START_TIME_STR = "2025-07-30 18:09:00"
END_TIME_STR = "2025-07-31 15:00:00"
FLOWCOUNT_CONSTANT = 255.5461

def backfill_flowcount():
    """
    Conecta a la base de datos, procesa los datos y escribe los resultados.
    Permite la interrupción con Ctrl+C para guardar el progreso.
    """
    connection = None
    records_inserted = 0
    
    try:
        log.info(f"Conectando a la base de datos '{DB_CONFIG['database']}'...")
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        log.info(f"Paso 1: Obteniendo datos de PCasing (ID {SENSOR_ID_PCASING}) entre {START_TIME_STR} y {END_TIME_STR}")
        
        query_pcasing = f"""
            SELECT timestamp, value FROM {TABLE_NAME}
            WHERE sensorID_id = %s AND timestamp BETWEEN %s AND %s
            ORDER BY timestamp ASC
        """
        cursor.execute(query_pcasing, (SENSOR_ID_PCASING, START_TIME_STR, END_TIME_STR))
        pcasing_records = cursor.fetchall()
        
        log.info(f"Se encontraron {len(pcasing_records)} registros de PCasing para procesar.")
        log.info("Para detener el proceso y guardar el progreso en cualquier momento, presiona Ctrl+C")

        # ==============================================================
        # --- INICIO DEL BLOQUE INTERRUMPIBLE ---
        # ==============================================================
        try:
            for pc_record in pcasing_records:
                pc_timestamp = pc_record['timestamp']
                pc_value = float(pc_record['value'])

                query_ptubing = f"""
                    SELECT value FROM {TABLE_NAME}
                    WHERE sensorID_id = %s AND timestamp <= %s
                    ORDER BY timestamp DESC
                    LIMIT 1
                """
                cursor.execute(query_ptubing, (SENSOR_ID_PTUBING, pc_timestamp))
                pt_record = cursor.fetchone()

                if not pt_record:
                    log.warning(f"No se encontró valor de PTubing para {pc_timestamp}. Omitiendo.")
                    continue

                pt_value = float(pt_record['value'])
                
                difference = pc_value - pt_value
                if difference >= 0:
                    flowcount_result = int(FLOWCOUNT_CONSTANT * difference)
                    
                    log.info(f"PC={pc_value:.2f}, PT={pt_value:.2f} @ {pc_timestamp} -> Calculando FlowCount: {flowcount_result}")
                    
                    insert_query = f"""
                        INSERT INTO {TABLE_NAME} (sensorID_id, value, timestamp)
                        VALUES (%s, %s, %s)
                    """
                    cursor.execute(insert_query, (SENSOR_ID_FLOWCOUNT, flowcount_result, pc_timestamp))
                    records_inserted += 1
                else:
                    log.warning(f"Cálculo omitido para {pc_timestamp}: Diferencia negativa ({difference:.2f}).")
        
        except KeyboardInterrupt:
            log.warning("\n\n>>> Interrupción por teclado (Ctrl+C) detectada. <<<")
            log.info("El bucle de procesamiento se detendrá de forma segura...")
        # ==============================================================
        # --- FIN DEL BLOQUE INTERRUMPIBLE ---
        # ==============================================================

        # Esta parte se ejecuta tanto si el bucle termina como si se interrumpe
        if records_inserted > 0:
            log.info(f"Confirmando {records_inserted} nuevas inserciones en la base de datos.")
            connection.commit()
        else:
            log.info("No se realizaron nuevas inserciones.")

    except mysql.connector.Error as err:
        log.error(f"Error de base de datos: {err}")
        if connection:
            log.info("Revirtiendo cambios (rollback)...")
            connection.rollback()
    finally:
        if connection and connection.is_connected():
            cursor.close()
            connection.close()
            log.info("Conexión a la base de datos cerrada.")

if __name__ == '__main__':
    backfill_flowcount()