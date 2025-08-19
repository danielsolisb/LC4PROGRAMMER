#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import threading
import queue
import time
import csv
import os
from datetime import datetime
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import serial
import serial.tools.list_ports
import pandas as pd
import matplotlib
matplotlib.use("TkAgg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

CSV_HEADER = [
    "timestamp_iso","hour","minute","second",
    "src","dst","seq",
    "rssi_dbm","snr_db",
    "device_ms","ping_ms"
]

def list_serial_ports():
    return [p.device for p in serial.tools.list_ports.comports()]

def parse_meas(line: str):
    # Espera: MEAS,src,dst,seq,rssi_dbm,snr_db,dev_ms,ping_ms
    if not line.startswith("MEAS,"):
        return None
    parts = line.strip().split(",")
    if len(parts) != 8:
        return None
    try:
        src     = int(parts[1])
        dst     = int(parts[2])
        seq     = int(parts[3])
        rssi    = float(parts[4])
        snr     = float(parts[5])
        dev_ms  = int(float(parts[6]))
        ping_ms = int(float(parts[7]))
    except ValueError:
        return None
    now = datetime.now()
    return {
        "timestamp_iso": now.isoformat(timespec="seconds"),
        "hour": now.hour, "minute": now.minute, "second": now.second,
        "src": src,"dst": dst,"seq": seq,
        "rssi_dbm": rssi,"snr_db": snr,
        "device_ms": dev_ms,"ping_ms": ping_ms
    }

class SerialReader(threading.Thread):
    def __init__(self, port, baud, out_q, stop_event):
        super().__init__(daemon=True)
        self.port = port
        self.baud = baud
        self.out_q = out_q
        self.stop_event = stop_event
        self.ser = None

    def run(self):
        try:
            self.ser = serial.Serial(self.port, self.baud, timeout=1)
            # limpiar buffer inicial
            time.sleep(1.0)
            self.ser.reset_input_buffer()
        except Exception as e:
            self.out_q.put(("error", f"No se pudo abrir {self.port}: {e}"))
            return

        self.out_q.put(("info", f"Escuchando {self.port} @ {self.baud}"))
        while not self.stop_event.is_set():
            try:
                raw = self.ser.readline()
            except Exception as e:
                self.out_q.put(("error", f"Error serial: {e}"))
                break
            if not raw:
                continue
            try:
                line = raw.decode("utf-8", errors="ignore").strip()
            except:
                continue
            # Entrega línea cruda para debug opcional
            # self.out_q.put(("raw", line))

            rec = parse_meas(line)
            if rec:
                self.out_q.put(("meas", rec))
        try:
            if self.ser:
                self.ser.close()
        except:
            pass
        self.out_q.put(("info", "Serial detenido"))

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("LoRa Logger – Heltec V3")
        self.geometry("1000x700")

        # Estado
        self.queue = queue.Queue()
        self.stop_event = threading.Event()
        self.reader = None
        self.data = []            # lista de dicts
        self.csv_path = tk.StringVar(value=f"lora_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

        # UI superior
        top = ttk.Frame(self)
        top.pack(side=tk.TOP, fill=tk.X, padx=8, pady=8)

        ttk.Label(top, text="Puerto:").pack(side=tk.LEFT)
        self.cmb_port = ttk.Combobox(top, values=list_serial_ports(), width=22)
        if self.cmb_port["values"]:
            self.cmb_port.current(0)
        self.cmb_port.pack(side=tk.LEFT, padx=4)
        ttk.Button(top, text="Actualizar", command=self.refresh_ports).pack(side=tk.LEFT, padx=4)

        ttk.Label(top, text="Baud:").pack(side=tk.LEFT, padx=(12,0))
        self.ent_baud = ttk.Entry(top, width=8)
        self.ent_baud.insert(0, "115200")
        self.ent_baud.pack(side=tk.LEFT, padx=4)

        ttk.Label(top, text="CSV:").pack(side=tk.LEFT, padx=(12,0))
        self.ent_csv = ttk.Entry(top, textvariable=self.csv_path, width=40)
        self.ent_csv.pack(side=tk.LEFT, padx=4)
        ttk.Button(top, text="…", command=self.pick_csv).pack(side=tk.LEFT)

        self.btn_start = ttk.Button(top, text="Iniciar", command=self.start_logging)
        self.btn_start.pack(side=tk.LEFT, padx=(12,4))
        self.btn_stop  = ttk.Button(top, text="Detener", command=self.stop_logging, state=tk.DISABLED)
        self.btn_stop.pack(side=tk.LEFT)

        # Panel info
        info = ttk.LabelFrame(self, text="Última medida")
        info.pack(side=tk.TOP, fill=tk.X, padx=8, pady=6)
        self.var_last = tk.StringVar(value="(sin datos)")
        ttk.Label(info, textvariable=self.var_last, font=("Consolas", 11)).pack(anchor="w", padx=8, pady=6)

        # Gráficos
        self.fig1 = plt.Figure(figsize=(9.5,3.2), dpi=100)
        self.ax1 = self.fig1.add_subplot(111)
        self.ax1.set_title("RSSI (dBm) vs Tiempo")
        self.ax1.set_xlabel("muestras")
        self.ax1.set_ylabel("RSSI (dBm)")
        self.ax1.grid(True)
        self.canvas1 = FigureCanvasTkAgg(self.fig1, master=self)
        self.canvas1.get_tk_widget().pack(fill=tk.BOTH, expand=False, padx=8, pady=(6,2))

        self.fig2 = plt.Figure(figsize=(9.5,3.2), dpi=100)
        self.ax2 = self.fig2.add_subplot(111)
        self.ax2.set_title("SNR (dB) vs Tiempo")
        self.ax2.set_xlabel("muestras")
        self.ax2.set_ylabel("SNR (dB)")
        self.ax2.grid(True)
        self.canvas2 = FigureCanvasTkAgg(self.fig2, master=self)
        self.canvas2.get_tk_widget().pack(fill=tk.BOTH, expand=False, padx=8, pady=(2,8))

        # Barra inferior
        bottom = ttk.Frame(self)
        bottom.pack(side=tk.BOTTOM, fill=tk.X, padx=8, pady=6)
        self.var_status = tk.StringVar(value="Listo")
        ttk.Label(bottom, textvariable=self.var_status).pack(side=tk.LEFT)
        ttk.Button(bottom, text="Cargar CSV y graficar…", command=self.load_csv_and_plot).pack(side=tk.RIGHT)

        # Programar polling de la cola
        self.after(100, self.process_queue)

    # --- UI helpers ---
    def refresh_ports(self):
        self.cmb_port["values"] = list_serial_ports()
        if self.cmb_port["values"]:
            self.cmb_port.current(0)

    def pick_csv(self):
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            filetypes=[("CSV files","*.csv"),("All files","*.*")]
        )
        if path:
            self.csv_path.set(path)

    def ensure_csv(self, path):
        if not os.path.exists(path):
            with open(path, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(CSV_HEADER)

    def start_logging(self):
        port = self.cmb_port.get().strip()
        if not port:
            messagebox.showerror("Error", "Selecciona un puerto.")
            return
        try:
            baud = int(self.ent_baud.get().strip())
        except:
            messagebox.showerror("Error", "Baud inválido.")
            return
        csv_path = self.csv_path.get().strip()
        if not csv_path:
            messagebox.showerror("Error", "Ruta CSV inválida.")
            return

        self.ensure_csv(csv_path)
        self.stop_event.clear()
        self.reader = SerialReader(port, baud, self.queue, self.stop_event)
        self.reader.start()
        self.btn_start.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.NORMAL)
        self.var_status.set(f"Grabando en {csv_path}")

    def stop_logging(self):
        self.stop_event.set()
        self.btn_start.config(state=tk.NORMAL)
        self.btn_stop.config(state=tk.DISABLED)
        self.var_status.set("Detenido. Generando gráficos...")
        self.after(100, self.final_plots)

    def append_csv(self, row):
        with open(self.csv_path.get(), "a", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow([row[h] for h in CSV_HEADER])

    def process_queue(self):
        try:
            while True:
                typ, payload = self.queue.get_nowait()
                if typ == "info":
                    self.var_status.set(payload)
                elif typ == "error":
                    messagebox.showerror("Serial", payload)
                    self.stop_logging()
                elif typ == "meas":
                    self.data.append(payload)
                    self.append_csv(payload)
                    self.update_last(payload)
                    self.update_plots()
                # elif typ == "raw":
                #     pass  # para depurar si quieres
        except queue.Empty:
            pass
        self.after(100, self.process_queue)

    def update_last(self, rec):
        txt = (f"{rec['timestamp_iso']} | src={rec['src']} dst={rec['dst']} "
               f"seq={rec['seq']} | RSSI={rec['rssi_dbm']:.1f} dBm  SNR={rec['snr_db']:.1f} dB")
        self.var_last.set(txt)

    def update_plots(self):
        # limita memoria si hay muchísimos puntos
        max_points = 3000
        data = self.data[-max_points:]

        xs = list(range(len(data)))
        rssi = [d["rssi_dbm"] for d in data]
        snr  = [d["snr_db"]   for d in data]

        self.ax1.clear()
        self.ax1.set_title("RSSI (dBm) vs Tiempo")
        self.ax1.set_xlabel("muestras")
        self.ax1.set_ylabel("RSSI (dBm)")
        self.ax1.grid(True)
        if xs:
            self.ax1.plot(xs, rssi, marker=".", linestyle="-")
        self.canvas1.draw_idle()

        self.ax2.clear()
        self.ax2.set_title("SNR (dB) vs Tiempo")
        self.ax2.set_xlabel("muestras")
        self.ax2.set_ylabel("SNR (dB)")
        self.ax2.grid(True)
        if xs:
            self.ax2.plot(xs, snr, marker=".", linestyle="-")
        self.canvas2.draw_idle()

    def load_csv_and_plot(self):
        path = filedialog.askopenfilename(
            title="Selecciona CSV",
            filetypes=[("CSV files","*.csv"),("All files","*.*")]
        )
        if not path:
            return
        try:
            df = pd.read_csv(path)
        except Exception as e:
            messagebox.showerror("Error", f"No se pudo leer CSV: {e}")
            return
        if df.empty:
            messagebox.showwarning("Atención", "CSV vacío.")
            return
        # Reemplaza data y refresca plots
        self.data = df.to_dict(orient="records")
        self.update_plots()
        self.var_status.set(f"Cargado {os.path.basename(path)}")

    def final_plots(self):
        if not self.data:
            self.var_status.set("Sin datos para graficar.")
            return
        df = pd.DataFrame(self.data)
        # timestamps relativos
        df["t"] = pd.to_datetime(df["timestamp_iso"], errors="coerce")
        t0 = df["t"].min()
        df["elapsed_s"] = (df["t"] - t0).dt.total_seconds()

        # RSSI vs tiempo
        plt.figure()
        plt.title("RSSI (dBm) vs Tiempo")
        plt.xlabel("Tiempo transcurrido (s)")
        plt.ylabel("RSSI (dBm)")
        plt.grid(True)
        plt.plot(df["elapsed_s"], df["rssi_dbm"], marker="o", linestyle="-")
        plt.tight_layout()
        plt.savefig("plot_rssi.png", dpi=150)

        # SNR vs tiempo
        plt.figure()
        plt.title("SNR (dB) vs Tiempo")
        plt.xlabel("Tiempo transcurrido (s)")
        plt.ylabel("SNR (dB)")
        plt.grid(True)
        plt.plot(df["elapsed_s"], df["snr_db"], marker="o", linestyle="-")
        plt.tight_layout()
        plt.savefig("plot_snr.png", dpi=150)

        # RSSI vs seq
        plt.figure()
        plt.title("RSSI (dBm) por Secuencia")
        plt.xlabel("Seq")
        plt.ylabel("RSSI (dBm)")
        plt.grid(True)
        plt.plot(df["seq"], df["rssi_dbm"], marker=".", linestyle="-")
        plt.tight_layout()
        plt.savefig("plot_rssi_seq.png", dpi=150)

        # Resumen
        rssi_min, rssi_med, rssi_max = df["rssi_dbm"].min(), df["rssi_dbm"].median(), df["rssi_dbm"].max()
        snr_min, snr_med, snr_max     = df["snr_db"].min(), df["snr_db"].median(), df["snr_db"].max()
        messagebox.showinfo(
            "Resumen",
            f"Registros: {len(df)}\n"
            f"RSSI dBm  -> min: {rssi_min:.1f}  mediana: {rssi_med:.1f}  max: {rssi_max:.1f}\n"
            f"SNR dB    -> min: {snr_min:.1f}   mediana: {snr_med:.1f}   max: {snr_max:.1f}\n"
            f"Guardado: plot_rssi.png, plot_snr.png, plot_rssi_seq.png"
        )
        self.var_status.set("Gráficos finales generados.")

if __name__ == "__main__":
    app = App()
    app.mainloop()
