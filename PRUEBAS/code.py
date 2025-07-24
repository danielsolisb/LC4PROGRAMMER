import tkinter as tk
from tkinter import ttk
import serial
import serial.tools.list_ports
import collections
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import math
import time
import random

# --- CONFIGURACIÓN ---
DATA_POINTS = 120  # Puntos a mostrar en el gráfico (aprox. 2 minutos si es 1 dato/seg)
MIN_VAL = 0
MAX_VAL = 5

class DataVisualizer(tk.Tk):
    """
    Clase principal de la aplicación para visualizar datos de un puerto serie,
    incluyendo picos, valles y valores históricos max/min.
    """
    def __init__(self):
        super().__init__()
        self.title("Visualizador de Datos de Semáforo (V2 con Picos)")
        self.geometry("1200x850")

        # --- Variables de datos ---
        self.data = {'ROJO': 0.0, 'AMARILLO': 0.0, 'VERDE': 0.0, 'ofset': 0.0}
        self.history = {
            'ROJO': collections.deque([0]*DATA_POINTS, maxlen=DATA_POINTS),
            'AMARILLO': collections.deque([0]*DATA_POINTS, maxlen=DATA_POINTS),
            'VERDE': collections.deque([0]*DATA_POINTS, maxlen=DATA_POINTS),
            'ofset': collections.deque([0]*DATA_POINTS, maxlen=DATA_POINTS)
        }
        self.timestamps = collections.deque([0]*DATA_POINTS, maxlen=DATA_POINTS)
        
        # --- Variables para estadísticas (Max/Min históricos) ---
        self.stats = {
            'ROJO': {'max': -float('inf'), 'min': float('inf')},
            'AMARILLO': {'max': -float('inf'), 'min': float('inf')},
            'VERDE': {'max': -float('inf'), 'min': float('inf')}
        }
        
        self.serial_port = None
        # --- Se establece para usar datos reales del puerto serie ---
        self.use_mock_data = False  # True para usar datos simulados, False para puerto real

        # --- Configuración de la interfaz ---
        self._setup_ui()

        if self.use_mock_data:
            self.start_time = time.time()
            self.update_mock_data()
        else:
            # --- Se conecta al puerto COM10 ---
            self.connect_serial('COM10') 
            self.read_serial_data()
            
    def _setup_ui(self):
        """Configura los elementos gráficos de la ventana."""
        main_frame = ttk.Frame(self, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --- Frame para los Gauges ---
        gauges_frame = ttk.Frame(main_frame)
        gauges_frame.pack(fill=tk.X, pady=5)
        gauges_frame.columnconfigure((0, 1, 2, 3), weight=1)

        self.gauge_rojo = self.create_gauge(gauges_frame, "ROJO", "#e74c3c")
        self.gauge_rojo['frame'].grid(row=0, column=0, padx=5, pady=5, sticky="nsew")
        
        self.gauge_amarillo = self.create_gauge(gauges_frame, "AMARILLO", "#f1c40f")
        self.gauge_amarillo['frame'].grid(row=0, column=1, padx=5, pady=5, sticky="nsew")
        
        self.gauge_verde = self.create_gauge(gauges_frame, "VERDE", "#2ecc71")
        self.gauge_verde['frame'].grid(row=0, column=2, padx=5, pady=5, sticky="nsew")

        self.gauge_offset = self.create_gauge(gauges_frame, "OFFSET", "#3498db")
        self.gauge_offset['frame'].grid(row=0, column=3, padx=5, pady=5, sticky="nsew")

        # --- Frame para Estadísticas (Max/Min) ---
        stats_frame = ttk.LabelFrame(main_frame, text="Valores Históricos (Max/Min/Δ)", padding="10")
        stats_frame.pack(fill=tk.X, pady=10)
        stats_frame.columnconfigure((0, 1, 2), weight=1)
        self.stat_labels = self.create_stat_labels(stats_frame)

        # --- Frame para el Gráfico ---
        plot_frame = ttk.Frame(main_frame)
        plot_frame.pack(fill=tk.BOTH, expand=True, pady=10)

        self.fig = plt.Figure(figsize=(12, 6), dpi=100)
        self.ax = self.fig.add_subplot(111)
        
        self.canvas = FigureCanvasTkAgg(self.fig, master=plot_frame)
        self.canvas.get_tk_widget().pack(side=tk.TOP, fill=tk.BOTH, expand=True)
        
        self.update_plot()

    def create_gauge(self, parent, name, color):
        """Crea un widget de medidor (gauge)."""
        frame = ttk.Frame(parent)
        canvas = tk.Canvas(frame, width=200, height=150, bg=self.cget('bg'))
        canvas.pack()
        label = ttk.Label(frame, text=f"{name}: 0.000", font=("Helvetica", 12))
        label.pack()
        return {'frame': frame, 'canvas': canvas, 'label': label, 'color': color}
        
    def create_stat_labels(self, parent):
        """Crea las etiquetas para mostrar los valores máximos, mínimos y la diferencia."""
        labels = {}
        colors = {'ROJO': '#e74c3c', 'AMARILLO': '#f1c40f', 'VERDE': '#2ecc71'}
        col = 0
        for name, color in colors.items():
            frame = ttk.Frame(parent)
            frame.grid(row=0, column=col, sticky="nsew", padx=10)
            frame.columnconfigure(0, weight=1)
            
            title_label = ttk.Label(frame, text=name, font=("Helvetica", 12, "bold"), foreground=color)
            title_label.pack()
            
            max_label = ttk.Label(frame, text="Max: N/A", font=("Helvetica", 10))
            max_label.pack()
            
            min_label = ttk.Label(frame, text="Min: N/A", font=("Helvetica", 10))
            min_label.pack()
            
            # --- NUEVO: Etiqueta para la diferencia (Delta) ---
            diff_label = ttk.Label(frame, text="Δ: N/A", font=("Helvetica", 10, "italic"))
            diff_label.pack()
            
            labels[name] = {'max': max_label, 'min': min_label, 'diff': diff_label}
            col += 1
        return labels

    def update_gauge(self, gauge_dict, value):
        """Actualiza la apariencia de un gauge con un nuevo valor."""
        canvas = gauge_dict['canvas']
        label = gauge_dict['label']
        name = gauge_dict['label'].cget("text").split(':')[0]
        color = gauge_dict['color']
        canvas.delete("all")
        
        angle = 180 - (value / (MAX_VAL - MIN_VAL)) * 180
        canvas.create_arc(10, 10, 190, 190, start=0, extent=180, style=tk.ARC, outline="#bbbbbb", width=20)
        canvas.create_arc(10, 10, 190, 190, start=0, extent=180 - angle, style=tk.ARC, outline=color, width=22)
        
        center_x, center_y = 100, 100
        length = 80
        rad_angle = math.radians(180 - angle)
        end_x = center_x - length * math.cos(rad_angle)
        end_y = center_y - length * math.sin(rad_angle)
        canvas.create_line(center_x, center_y, end_x, end_y, width=3, fill="#555555")
        canvas.create_oval(95, 95, 105, 105, fill="#555555", outline="")
        canvas.create_text(20, 110, text=str(MIN_VAL), font=("Helvetica", 10))
        canvas.create_text(180, 110, text=str(MAX_VAL), font=("Helvetica", 10))
        label.config(text=f"{name}: {value:.3f}")

    def update_plot(self):
        """Limpia y redibuja el gráfico, añadiendo picos y valles."""
        self.ax.clear()
        
        # Dibuja las líneas de datos
        self.ax.plot(self.timestamps, self.history['ROJO'], label='ROJO', color='#e74c3c', zorder=5)
        self.ax.plot(self.timestamps, self.history['AMARILLO'], label='AMARILLO', color='#f1c40f', zorder=5)
        self.ax.plot(self.timestamps, self.history['VERDE'], label='VERDE', color='#2ecc71', zorder=5)
        self.ax.plot(self.timestamps, self.history['ofset'], label='OFFSET', color='#3498db', linestyle='--', zorder=4)

        # Añade anotaciones para picos y valles en la ventana actual
        for color, data_deque in self.history.items():
            if color == 'ofset': continue
            
            valid_data = [v for v in data_deque if v != 0]
            if not valid_data: continue

            max_val = max(valid_data)
            min_val = min(valid_data)
            
            try:
                max_idx = list(data_deque).index(max_val)
                min_idx = list(data_deque).index(min_val)

                x_max_coord = self.timestamps[max_idx]
                x_min_coord = self.timestamps[min_idx]

                # Anotación para el máximo
                self.ax.annotate(f'{max_val:.3f}', xy=(x_max_coord, max_val),
                                 xytext=(x_max_coord, max_val + 0.1),
                                 ha='center', color='black',
                                 arrowprops=dict(facecolor='black', shrink=0.05, width=1, headwidth=5),
                                 bbox=dict(boxstyle="round,pad=0.3", fc=self.gauge_rojo['color'] if color == 'ROJO' else (self.gauge_amarillo['color'] if color == 'AMARILLO' else self.gauge_verde['color']), alpha=0.7))

                # Anotación para el mínimo
                self.ax.annotate(f'{min_val:.3f}', xy=(x_min_coord, min_val),
                                 xytext=(x_min_coord, min_val - 0.1),
                                 ha='center', color='black',
                                 arrowprops=dict(facecolor='black', shrink=0.05, width=1, headwidth=5),
                                 bbox=dict(boxstyle="round,pad=0.3", fc=self.gauge_rojo['color'] if color == 'ROJO' else (self.gauge_amarillo['color'] if color == 'AMARILLO' else self.gauge_verde['color']), alpha=0.7))
            except ValueError:
                pass

        self.ax.set_title("Historial de Datos de Sensores (Últimos 2 Minutos)")
        # --- MODIFICADO: Etiqueta del eje Y actualizada ---
        self.ax.set_ylabel("Valor (Rango 1-4)")
        self.ax.set_xlabel("Tiempo (segundos transcurridos)")
        # --- MODIFICADO: Se ajusta el rango del eje Y para hacer "zoom" ---
        self.ax.set_ylim(1, 4)
        self.ax.legend()
        self.ax.grid(True)
        self.fig.tight_layout()
        self.canvas.draw()
        
    def process_data_line(self, line):
        """Parsea una línea de datos y actualiza el estado."""
        try:
            key, value_str = line.strip().split('=')
            key = key.strip()
            if key in self.data:
                value = float(value_str)
                self.data[key] = value
                
                if key in self.stats:
                    self.stats[key]['max'] = max(self.stats[key]['max'], value)
                    self.stats[key]['min'] = min(self.stats[key]['min'], value)

                if key == 'VERDE':
                    self.update_all_visuals()
        except (ValueError, IndexError):
            pass

    def update_all_visuals(self):
        """Actualiza todos los elementos visuales con los datos más recientes."""
        self.timestamps.append(time.time() - self.start_time)
        for key in self.history.keys():
            self.history[key].append(self.data[key])

        self.update_gauge(self.gauge_rojo, self.data['ROJO'])
        self.update_gauge(self.gauge_amarillo, self.data['AMARILLO'])
        self.update_gauge(self.gauge_verde, self.data['VERDE'])
        self.update_gauge(self.gauge_offset, self.data['ofset'])
        
        # --- MODIFICADO: Actualiza etiquetas de estadísticas, incluyendo la diferencia ---
        for name, labels in self.stat_labels.items():
            max_val = self.stats[name]['max']
            min_val = self.stats[name]['min']
            if max_val != -float('inf'):
                diff = max_val - min_val
                labels['max'].config(text=f"Max: {max_val:.3f}")
                labels['min'].config(text=f"Min: {min_val:.3f}")
                labels['diff'].config(text=f"Δ: {diff:.3f}")
        
        self.update_plot()

    def connect_serial(self, port, baudrate=9600):
        try:
            self.serial_port = serial.Serial(port, baudrate, timeout=1)
            print(f"Conectado a {port} a {baudrate} baudios.")
            self.start_time = time.time()
        except serial.SerialException as e:
            error_win = tk.Toplevel(self)
            error_win.title("Error de Conexión")
            ttk.Label(error_win, text=f"No se pudo conectar al puerto {port}.\n\n"
                                     f"Verifique que el dispositivo esté conectado y el puerto sea correcto.\n\n"
                                     f"Error: {e}", padding=20).pack()
            self.after(5000, self.destroy)

    def read_serial_data(self):
        if self.serial_port and self.serial_port.is_open and self.serial_port.in_waiting > 0:
            try:
                line = self.serial_port.readline().decode('utf-8').strip()
                if line:
                    self.process_data_line(line)
            except Exception as e:
                print(f"Error leyendo del puerto: {e}")
        
        self.after(100, self.read_serial_data)

    def update_mock_data(self):
        """
        Genera y procesa datos simulados para demostración.
        ESTA FUNCIÓN YA NO SE USA CUANDO use_mock_data ES False.
        """
        base_ofset = 2.502
        base_rojo = 2.484
        base_amarillo = 2.472
        base_verde = 2.485
        
        variacion = random.uniform(-0.05, 0.05)
        self.data['ofset'] = base_ofset + variacion
        self.data['ROJO'] = base_rojo + variacion
        self.data['AMARILLO'] = base_amarillo + variacion
        self.data['VERDE'] = base_verde + variacion

        for key in self.data:
            self.data[key] = max(MIN_VAL, min(MAX_VAL, self.data[key]))

        self.process_data_line(f"ofset={self.data['ofset']:.3f}")
        self.process_data_line(f"ROJO={self.data['ROJO']:.3f}")
        self.process_data_line(f"AMARILLO={self.data['AMARILLO']:.3f}")
        self.process_data_line(f"VERDE={self.data['VERDE']:.3f}")

        self.after(1000, self.update_mock_data)

if __name__ == "__main__":
    app = DataVisualizer()
    app.mainloop()
